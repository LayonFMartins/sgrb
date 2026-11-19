import { Router } from 'express';
import { pool } from '../db/pool.js';
import { emTransacao } from '../db/transacao.js';
import { numeroObrigatorio, numeroOpcional } from '../db/campos.js';
import {
  dataBr, dataDaRota, dataObrigatoria, exigirAnimaisExistentes, exigirAnimalNoRebanho, exigirDataNaoFutura, listaDeBrincos,
} from '../db/manejos.js';
import { ErroHttp } from '../middleware/erros.js';
import { exigirPermissao } from '../middleware/auth.js';

// Movimentacao entre piquetes: tabela OCUPA (historico de onde cada animal ficou).
// Mover = fechar a ocupacao atual (data_saida) e abrir a nova (data_entrada), na
// mesma transacao. O banco confere: um piquete por vez (RI-08), lotacao (RI-09),
// descanso do piquete (RI-10), data depois do nascimento (RI-15) e animal sem baixa (RI-22).
export const movimentacoesRouter = Router();

// GET /api/movimentacoes?brinco=0101&id_piquete=5
// Historico de ocupacao (mais recentes primeiro). "atual" = ainda esta no piquete.
movimentacoesRouter.get('/', exigirPermissao('movimentacoes.visualizar'), async (req, res) => {
  const brinco = typeof req.query.brinco === 'string' && req.query.brinco.trim() ? req.query.brinco.trim() : null;
  const idPiquete = numeroOpcional(req.query.id_piquete, 'piquete');
  const { rows } = await pool.query(
    `SELECT o.brinco, o.id_piquete, pq.nome AS piquete, o.data_entrada, o.data_saida,
            (o.data_saida IS NULL) AS atual
       FROM ocupa o
       JOIN piquete pq ON pq.id_piquete = o.id_piquete
      WHERE ($1::varchar IS NULL OR o.brinco = $1)
        AND ($2::int IS NULL OR o.id_piquete = $2)
      ORDER BY o.data_entrada DESC, o.brinco
      LIMIT 500`,
    [brinco, idPiquete]
  );
  res.json(rows);
});

// POST /api/movimentacoes
// { "brincos": ["0001", "0002"], "id_piquete": 2, "data_movimentacao": "2026-11-10" }
// Animal sem piquete (recem-comprado sem destino, por exemplo) so entra no piquete.
movimentacoesRouter.post('/', exigirPermissao('movimentacoes.criar'), async (req, res) => {
  const b = req.body ?? {};
  const brincos = listaDeBrincos(b);
  const idPiquete = numeroObrigatorio(b.id_piquete, 'piquete de destino');
  const data = dataObrigatoria(b.data_movimentacao, 'Informe a data da movimentação.');

  const destino = await emTransacao(async (client) => {
    await exigirDataNaoFutura(client, data, 'da movimentação');
    await exigirAnimaisExistentes(client, brincos);

    const piquete = await client.query<{ nome: string }>(
      'SELECT nome FROM piquete WHERE id_piquete = $1', [idPiquete]);
    if (!piquete.rows[0]) throw new ErroHttp(404, 'Piquete de destino não encontrado.');
    const nomeDestino = piquete.rows[0].nome;

    // So animais do rebanho podem ser movidos.
    const fora = await client.query<{ brinco: string; situacao: string }>(
      `SELECT brinco, situacao FROM vw_animal
        WHERE brinco = ANY($1::varchar[]) AND situacao <> 'Ativo' ORDER BY brinco`, [brincos]);
    if (fora.rowCount) {
      const lista = fora.rows.map(r => `${r.brinco} (${r.situacao.toLocaleLowerCase('pt-BR')})`).join(', ');
      throw new ErroHttp(409, fora.rowCount === 1
        ? `O animal ${lista} já saiu do rebanho.`
        : `Os animais ${lista} já saíram do rebanho.`);
    }

    // Quem ja esta no piquete de destino nao precisa ser movido.
    const jaNoDestino = await client.query<{ brinco: string }>(
      `SELECT brinco FROM ocupa
        WHERE id_piquete = $1 AND data_saida IS NULL AND brinco = ANY($2::varchar[]) ORDER BY brinco`,
      [idPiquete, brincos]);
    if (jaNoDestino.rowCount) {
      const lista = jaNoDestino.rows.map(r => r.brinco).join(', ');
      throw new ErroHttp(409, jaNoDestino.rowCount === 1
        ? `O animal ${lista} já está no piquete ${nomeDestino}.`
        : `Os animais ${lista} já estão no piquete ${nomeDestino}.`);
    }

    // A nova entrada precisa ser DEPOIS da entrada mais recente do animal
    // (a chave de OCUPA e (brinco, data_entrada) e o periodo nao pode voltar no tempo).
    const recentes = await client.query<{ brinco: string; ultima: string }>(
      `SELECT brinco, max(data_entrada) AS ultima FROM ocupa
        WHERE brinco = ANY($1::varchar[]) GROUP BY brinco
       HAVING max(data_entrada) >= $2::date ORDER BY brinco`, [brincos, data]);
    if (recentes.rows[0]) {
      throw new ErroHttp(400,
        `O animal ${recentes.rows[0].brinco} teve a última entrada em piquete em ${dataBr(recentes.rows[0].ultima)}; ` +
        `a movimentação precisa ser em uma data posterior.`);
    }

    // 1) fecha a ocupacao atual de cada animal; 2) abre a nova.
    // Fechar todos antes de abrir libera as vagas na data da entrada (lotacao, RI-09).
    await client.query(
      'UPDATE ocupa SET data_saida = $2 WHERE brinco = ANY($1::varchar[]) AND data_saida IS NULL',
      [brincos, data]);
    for (const brinco of brincos) {
      await client.query(
        'INSERT INTO ocupa (brinco, data_entrada, id_piquete) VALUES ($1, $2, $3)',
        [brinco, data, idPiquete]);
    }
    return nomeDestino;
  });

  res.status(201).json({
    mensagem: brincos.length === 1
      ? `Animal ${brincos[0]} movido para o piquete ${destino}.`
      : `${brincos.length} animais movidos para o piquete ${destino}.`,
  });
});

// DELETE /api/movimentacoes/:brinco/:data_entrada -> desfaz a última movimentação de um animal
// (só o proprietário): apaga a entrada atual e o animal volta para o piquete de onde saiu.
// Só a movimentação atual pode ser desfeita; a primeira entrada (compra ou nascimento) não,
// porque o animal ficaria sem piquete: nesse caso basta fazer uma nova movimentação.
movimentacoesRouter.delete('/:brinco/:data', exigirPermissao('movimentacoes.excluir'), async (req, res) => {
  const brinco = String(req.params.brinco);
  const data = dataDaRota(req.params.data, 'Movimentação não encontrada.');
  const resultado = await emTransacao(async (client) => {
    await exigirAnimalNoRebanho(client, brinco);
    const atual = await client.query<{ data_saida: string | null; destino: string }>(
      `SELECT o.data_saida, pq.nome AS destino FROM ocupa o JOIN piquete pq ON pq.id_piquete = o.id_piquete
        WHERE o.brinco = $1 AND o.data_entrada = $2 FOR UPDATE OF o`, [brinco, data]);
    if (!atual.rows[0]) throw new ErroHttp(404, 'Movimentação não encontrada.');
    if (atual.rows[0].data_saida !== null) {
      throw new ErroHttp(409, `O animal ${brinco} já saiu desse piquete depois; só a movimentação mais recente pode ser desfeita.`);
    }

    // Ocupação anterior: a que a movimentação fechou (saída = data desta entrada).
    const anterior = await client.query<{ data_entrada: string; id_piquete: number; nome: string; capacidade_max: number }>(
      `SELECT o.data_entrada, o.id_piquete, pq.nome, pq.capacidade_max
         FROM ocupa o JOIN piquete pq ON pq.id_piquete = o.id_piquete
        WHERE o.brinco = $1 AND o.data_saida = $2
        ORDER BY o.data_entrada DESC LIMIT 1`, [brinco, data]);
    const origem = anterior.rows[0];
    if (!origem) {
      throw new ErroHttp(409,
        `Esta é a primeira entrada do animal ${brinco} (chegada na compra ou no nascimento) e não pode ser desfeita. ` +
        'Para trocar o piquete, faça uma nova movimentação.');
    }

    // O trigger de lotação só roda na entrada; ao reabrir a ocupação anterior conferimos a vaga aqui,
    // com a mesma trava no piquete.
    await client.query('SELECT 1 FROM piquete WHERE id_piquete = $1 FOR UPDATE', [origem.id_piquete]);
    const lotacao = await client.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM ocupa WHERE id_piquete = $1 AND data_saida IS NULL', [origem.id_piquete]);
    if (lotacao.rows[0].n >= origem.capacidade_max) {
      throw new ErroHttp(409, `O piquete ${origem.nome}, de onde o animal ${brinco} saiu, está lotado agora; não dá para voltá-lo para lá.`);
    }

    await client.query('DELETE FROM ocupa WHERE brinco = $1 AND data_entrada = $2', [brinco, data]);
    await client.query('UPDATE ocupa SET data_saida = NULL WHERE brinco = $1 AND data_entrada = $2',
      [brinco, origem.data_entrada]);
    return { destino: atual.rows[0].destino, origem: origem.nome };
  });
  res.json({ mensagem: `Movimentação desfeita: o animal ${brinco} saiu de ${resultado.destino} e voltou para ${resultado.origem}.` });
});
