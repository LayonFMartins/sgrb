import { Router } from 'express';
import { pool } from '../db/pool.js';
import { emTransacao } from '../db/transacao.js';
import { numeroObrigatorio, textoObrigatorio } from '../db/campos.js';
import { dataObrigatoria, exigirAnimaisExistentes, exigirDataNaoFutura, exigirResponsavel } from '../db/manejos.js';
import { ErroHttp } from '../middleware/erros.js';
import { exigirPermissao } from '../middleware/auth.js';

// Pesagens. Uma pesagem e (animal + data) com o peso e o responsavel.
// O responsavel NAO e o usuario logado: os vaqueiros nao tem login, entao
// quem esta no sistema registra e escolhe o responsavel (id_usuario) no formulario.
// O banco confere: data depois do nascimento (RI-16), animal sem baixa antes
// da data (RI-22) e responsavel ativo (RI-26).
export const pesagensRouter = Router();

// GET /api/pesagens?brinco=0101  -> historico (mais recentes primeiro), com o GMD
// desde a pesagem anterior (vw_gmd_pesagens). Sem filtro, traz as 500 mais recentes.
pesagensRouter.get('/', exigirPermissao('pesagens.visualizar'), async (req, res) => {
  const brinco = typeof req.query.brinco === 'string' && req.query.brinco.trim() ? req.query.brinco.trim() : null;
  const { rows } = await pool.query(
    `SELECT p.brinco, p.data_pesagem, p.peso_kg, p.id_usuario, u.nome AS responsavel,
            g.peso_anterior_kg, g.dias, g.gmd_kg_dia
       FROM pesagem p
       JOIN usuario u ON u.id_usuario = p.id_usuario
       LEFT JOIN vw_gmd_pesagens g ON g.brinco = p.brinco AND g.data_pesagem = p.data_pesagem
      WHERE $1::varchar IS NULL OR p.brinco = $1
      ORDER BY p.data_pesagem DESC, p.brinco
      LIMIT 500`,
    [brinco]
  );
  res.json(rows);
});

interface ItemPesagem {
  brinco: string;
  peso_kg: number;
}

// POST /api/pesagens  -> um animal:
// { "brinco": "0001", "data_pesagem": "2026-11-10", "peso_kg": 520, "id_usuario": 4 }
// ou varios animais na mesma data e com o mesmo responsavel (pesagem no curral):
// { "data_pesagem": "2026-11-10", "id_usuario": 4,
//   "pesagens": [ { "brinco": "0001", "peso_kg": 520 }, { "brinco": "0002", "peso_kg": 498.5 } ] }
pesagensRouter.post('/', exigirPermissao('pesagens.criar'), async (req, res) => {
  const b = req.body ?? {};
  const data = dataObrigatoria(b.data_pesagem, 'Informe a data da pesagem.');
  const idUsuario = numeroObrigatorio(b.id_usuario, 'responsável');
  const bruto: unknown[] = Array.isArray(b.pesagens) ? b.pesagens : [{ brinco: b.brinco, peso_kg: b.peso_kg }];
  if (bruto.length === 0) throw new ErroHttp(400, 'Informe pelo menos uma pesagem.');

  const itens: ItemPesagem[] = bruto.map((p, i) => {
    const item = (p ?? {}) as Record<string, unknown>;
    const quem = bruto.length > 1 ? `Animal ${i + 1}: ` : '';
    const peso = numeroObrigatorio(item.peso_kg, `peso${bruto.length > 1 ? ` do animal ${i + 1}` : ''}`);
    if (peso <= 0) throw new ErroHttp(400, `${quem}o peso deve ser maior que zero.`);
    return { brinco: textoObrigatorio(item.brinco, `${quem}informe o brinco.`), peso_kg: peso };
  });
  const brincos = itens.map(i => i.brinco);
  const repetido = brincos.find((x, i) => brincos.indexOf(x) !== i);
  if (repetido) throw new ErroHttp(400, `O animal ${repetido} aparece mais de uma vez.`);

  await emTransacao(async (client) => {
    await exigirDataNaoFutura(client, data, 'da pesagem');
    await exigirResponsavel(client, idUsuario);
    await exigirAnimaisExistentes(client, brincos);

    // A chave da pesagem e (brinco, data): confere antes para dizer qual animal.
    const jaPesados = await client.query<{ brinco: string }>(
      'SELECT brinco FROM pesagem WHERE data_pesagem = $1 AND brinco = ANY($2::varchar[]) ORDER BY brinco',
      [data, brincos]);
    if (jaPesados.rowCount) {
      const lista = jaPesados.rows.map(r => r.brinco).join(', ');
      throw new ErroHttp(409, jaPesados.rowCount === 1
        ? `O animal ${lista} já tem pesagem nessa data.`
        : `Os animais ${lista} já têm pesagem nessa data.`);
    }

    for (const item of itens) {
      await client.query(
        'INSERT INTO pesagem (brinco, data_pesagem, peso_kg, id_usuario) VALUES ($1, $2, $3, $4)',
        [item.brinco, data, item.peso_kg, idUsuario]
      );
    }
  });

  res.status(201).json({
    mensagem: itens.length === 1
      ? `Pesagem registrada: animal ${itens[0].brinco} com ${itens[0].peso_kg.toLocaleString('pt-BR')} kg.`
      : `${itens.length} pesagens registradas.`,
  });
});
