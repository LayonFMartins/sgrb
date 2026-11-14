import { Router } from 'express';
import type { PoolClient } from 'pg';
import { pool } from '../db/pool.js';
import { emTransacao } from '../db/transacao.js';
import { numeroObrigatorio, textoObrigatorio } from '../db/campos.js';
import { ErroHttp } from '../middleware/erros.js';
import { exigirPermissao } from '../middleware/auth.js';

// Saidas do rebanho: VENDA (com GTA de saida) e OBITO (com a causa).
// A baixa e dividida em tres tabelas (generalizacao): baixa + venda ou baixa + obito.
// O banco so confere as regras RI-18 (toda baixa tem venda ou obito), RI-19
// (carencia x venda para abate) e RI-20 (venda exige GTA de saida) no COMMIT,
// por isso cada registro roda inteiro numa transacao.
export const baixasRouter = Router();

const FINALIDADES = ['ABATE', 'ENGORDA', 'RECRIA', 'CRIA'];

// Uma linha por animal que saiu do rebanho, com os dados da venda ou do obito
// e a GTA de saida (LATERAL: o animal tambem tem a GTA de entrada, se foi comprado).
const SELECT_BAIXAS = `
  SELECT b.id_baixa, b.brinco, b.data_baixa, b.motivo,
         a.raca, a.categoria, a.sexo,
         v.comprador, v.peso_final_kg, v.valor_venda,
         o.causa,
         g.numero_gta, g.finalidade, g.destino
    FROM baixa b
    JOIN vw_animal a ON a.brinco = b.brinco
    LEFT JOIN venda v ON v.id_baixa = b.id_baixa
    LEFT JOIN obito o ON o.id_baixa = b.id_baixa
    LEFT JOIN LATERAL (
         SELECT g.numero_gta, g.finalidade, g.destino
           FROM transita_com t
           JOIN gta g ON g.numero_gta = t.numero_gta
          WHERE t.brinco = b.brinco AND g.tipo = 'SAIDA'
          ORDER BY g.data_emissao DESC
          LIMIT 1) g ON true`;

// GET /api/baixas?motivo=VENDA|OBITO  -> saidas registradas (mais recentes primeiro)
baixasRouter.get('/', exigirPermissao('baixas.visualizar'), async (req, res) => {
  const motivo = typeof req.query.motivo === 'string' ? req.query.motivo.toUpperCase() : null;
  if (motivo && motivo !== 'VENDA' && motivo !== 'OBITO') {
    throw new ErroHttp(400, 'Motivo inválido: use VENDA ou OBITO.');
  }
  const { rows } = await pool.query(
    `${SELECT_BAIXAS}
      WHERE $1::varchar IS NULL OR b.motivo = $1
      ORDER BY b.data_baixa DESC, b.brinco`,
    [motivo]
  );
  res.json(rows);
});

// Confere antes de gravar para dar uma mensagem clara (qual brinco, por que).
async function conferirAnimaisAtivos(client: PoolClient, brincos: string[]) {
  const { rows } = await client.query<{ brinco: string; situacao: string }>(
    'SELECT brinco, situacao FROM vw_animal WHERE brinco = ANY($1::varchar[])', [brincos]);
  const naoEncontrados = brincos.filter(b => !rows.some(r => r.brinco === b));
  if (naoEncontrados.length) throw new ErroHttp(404, `Animal não encontrado: ${naoEncontrados.join(', ')}.`);
  const fora = rows.filter(r => r.situacao !== 'Ativo');
  if (fora.length) {
    const lista = fora.map(r => `${r.brinco} (${r.situacao.toLocaleLowerCase('pt-BR')})`).join(', ');
    throw new ErroHttp(409, fora.length === 1
      ? `O animal ${lista} já saiu do rebanho.`
      : `Os animais ${lista} já saíram do rebanho.`);
  }
}

interface AnimalVendido {
  brinco: string;
  peso_final_kg: number;
  valor_venda: number;
}

// POST /api/baixas/vendas  -> venda em lote: uma GTA de saida para todos os animais
// {
//   "comprador": "Frigorífico Boi Bom", "data_venda": "2026-11-10",
//   "gta": { "numero_gta": "MG-26-0050001", "data_emissao": "2026-11-10",
//            "origem": "Fazenda São Bento - Itabira/MG", "destino": "Frigorífico Boi Bom",
//            "finalidade": "ABATE" },
//   "animais": [ { "brinco": "0105", "peso_final_kg": 540, "valor_venda": 10800 } ]
// }
baixasRouter.post('/vendas', exigirPermissao('vendas.criar'), async (req, res) => {
  const b = req.body ?? {};
  const comprador = textoObrigatorio(b.comprador, 'Informe o comprador.');
  const dataVenda = textoObrigatorio(b.data_venda, 'Informe a data da venda.');
  const g = b.gta ?? {};
  const gta = {
    numero_gta: textoObrigatorio(g.numero_gta, 'Informe o número da GTA de saída.').toUpperCase(),
    data_emissao: textoObrigatorio(g.data_emissao, 'Informe a data de emissão da GTA.'),
    origem: textoObrigatorio(g.origem, 'Informe a origem da GTA.'),
    destino: textoObrigatorio(g.destino, 'Informe o destino da GTA.'),
    finalidade: textoObrigatorio(g.finalidade, 'Informe a finalidade da GTA.').toUpperCase(),
  };
  if (!FINALIDADES.includes(gta.finalidade)) throw new ErroHttp(400, 'Finalidade inválida: use ABATE, ENGORDA, RECRIA ou CRIA.');
  if (!Array.isArray(b.animais) || b.animais.length === 0) throw new ErroHttp(400, 'Escolha pelo menos um animal.');

  const animais: AnimalVendido[] = b.animais.map((a: Record<string, unknown>, i: number) => ({
    brinco: textoObrigatorio(a?.brinco, `Animal ${i + 1}: informe o brinco.`),
    peso_final_kg: numeroObrigatorio(a?.peso_final_kg, `peso final do animal ${i + 1}`),
    valor_venda: numeroObrigatorio(a?.valor_venda, `valor de venda do animal ${i + 1}`),
  }));
  const brincos = animais.map(a => a.brinco);
  const repetido = brincos.find((x, i) => brincos.indexOf(x) !== i);
  if (repetido) throw new ErroHttp(400, `O animal ${repetido} aparece mais de uma vez na venda.`);

  await emTransacao(async (client) => {
    const existe = await client.query('SELECT 1 FROM gta WHERE numero_gta = $1', [gta.numero_gta]);
    if (existe.rowCount) throw new ErroHttp(409, `A GTA ${gta.numero_gta} já está cadastrada.`);
    await conferirAnimaisAtivos(client, brincos);

    await client.query(
      `INSERT INTO gta (numero_gta, tipo, data_emissao, origem, destino, finalidade)
       VALUES ($1, 'SAIDA', $2, $3, $4, $5)`,
      [gta.numero_gta, gta.data_emissao, gta.origem, gta.destino, gta.finalidade]
    );
    for (const a of animais) {
      // baixa (superclasse) -> venda (subclasse) -> vinculo com a GTA de saida
      const { rows } = await client.query<{ id_baixa: number }>(
        `INSERT INTO baixa (brinco, data_baixa, motivo) VALUES ($1, $2, 'VENDA') RETURNING id_baixa`,
        [a.brinco, dataVenda]
      );
      await client.query(
        'INSERT INTO venda (id_baixa, comprador, peso_final_kg, valor_venda) VALUES ($1, $2, $3, $4)',
        [rows[0].id_baixa, comprador, a.peso_final_kg, a.valor_venda]
      );
      await client.query('INSERT INTO transita_com (brinco, numero_gta) VALUES ($1, $2)', [a.brinco, gta.numero_gta]);
    }
    // No COMMIT o banco confere RI-18, RI-19 e RI-20; se algo falhar, nada fica gravado.
  });

  res.status(201).json({
    mensagem: animais.length === 1
      ? `Venda registrada: animal ${brincos[0]} com a GTA ${gta.numero_gta}.`
      : `Venda registrada: ${animais.length} animais com a GTA ${gta.numero_gta}.`,
  });
});

// POST /api/baixas/obitos  -> { "brinco": "0108", "data_obito": "2026-11-12", "causa": "Picada de cobra" }
baixasRouter.post('/obitos', exigirPermissao('obitos.criar'), async (req, res) => {
  const b = req.body ?? {};
  const brinco = textoObrigatorio(b.brinco, 'Escolha o animal.');
  const dataObito = textoObrigatorio(b.data_obito, 'Informe a data do óbito.');
  const causa = textoObrigatorio(b.causa, 'Informe a causa do óbito.');
  if (causa.length > 200) throw new ErroHttp(400, 'A causa pode ter no máximo 200 caracteres.');

  await emTransacao(async (client) => {
    await conferirAnimaisAtivos(client, [brinco]);
    const { rows } = await client.query<{ id_baixa: number }>(
      `INSERT INTO baixa (brinco, data_baixa, motivo) VALUES ($1, $2, 'OBITO') RETURNING id_baixa`,
      [brinco, dataObito]
    );
    await client.query('INSERT INTO obito (id_baixa, causa) VALUES ($1, $2)', [rows[0].id_baixa, causa]);
  });

  res.status(201).json({ mensagem: `Óbito do animal ${brinco} registrado.` });
});
