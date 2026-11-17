import { Router } from 'express';
import { pool } from '../db/pool.js';
import { emTransacao } from '../db/transacao.js';
import { numeroObrigatorio, numeroOpcional } from '../db/campos.js';
import { dataBr, dataObrigatoria, exigirAnimaisExistentes, exigirDataNaoFutura, listaDeBrincos } from '../db/manejos.js';
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
