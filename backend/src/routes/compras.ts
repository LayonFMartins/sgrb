import { Router } from 'express';
import { emTransacao } from '../db/transacao.js';
import { ErroHttp } from '../middleware/erros.js';
import { exigirPermissao } from '../middleware/auth.js';

// Modelo de operacao com TRANSACAO: a compra grava os animais, a GTA de
// entrada e o vinculo entre eles. O banco so confere a regra RI-06
// ("animal comprado precisa de GTA de entrada") no COMMIT, por isso tudo
// tem que ir na mesma transacao.
export const comprasRouter = Router();

interface AnimalComprado {
  brinco: string;
  sexo: string;
  data_nascimento: string;
  id_raca: number;
  valor_compra: number;
  brinco_mae?: string;
}

// POST /api/compras
// {
//   "id_fornecedor": 1, "data_compra": "2026-11-05",
//   "id_piquete": 6,            (opcional: piquete onde os animais entram, ex.: quarentena)
//   "gta": { "numero_gta": "MG-26-0040001", "data_emissao": "2026-11-04",
//            "origem": "...", "destino": "...", "finalidade": "RECRIA" },
//   "animais": [ { "brinco": "0301", "sexo": "M", "data_nascimento": "2025-10-01",
//                  "id_raca": 1, "valor_compra": 2900 } ]
// }
comprasRouter.post('/', exigirPermissao('compras.criar'), async (req, res) => {
  const { id_fornecedor, data_compra, id_piquete, gta, animais } = req.body ?? {};
  if (!id_fornecedor || !data_compra || !gta?.numero_gta || !Array.isArray(animais) || animais.length === 0) {
    throw new ErroHttp(400, 'Informe fornecedor, data da compra, GTA e pelo menos um animal.');
  }
  const brincos = (animais as AnimalComprado[]).map(a => a.brinco);

  await emTransacao(async (client) => {
    // Confere antes de gravar para dizer exatamente o que ja existe
    // (o erro de chave duplicada do banco nao diz qual brinco foi).
    const gtaExistente = await client.query('SELECT 1 FROM gta WHERE numero_gta = $1', [gta.numero_gta]);
    if (gtaExistente.rowCount) throw new ErroHttp(409, `A GTA ${gta.numero_gta} já está cadastrada.`);

    const repetidos = await client.query<{ brinco: string }>(
      'SELECT brinco FROM animal WHERE brinco = ANY($1::varchar[]) ORDER BY brinco', [brincos]);
    if (repetidos.rowCount) {
      const lista = repetidos.rows.map(r => r.brinco).join(', ');
      throw new ErroHttp(409, repetidos.rowCount === 1
        ? `O brinco ${lista} já está cadastrado em outro animal.`
        : `Os brincos ${lista} já estão cadastrados em outros animais.`);
    }

    await client.query(
      `INSERT INTO gta (numero_gta, tipo, data_emissao, origem, destino, finalidade)
       VALUES ($1, 'ENTRADA', $2, $3, $4, $5)`,
      [gta.numero_gta, gta.data_emissao, gta.origem, gta.destino, gta.finalidade]
    );

    for (const a of animais as AnimalComprado[]) {
      await client.query(
        `INSERT INTO animal (brinco, sexo, data_nascimento, id_raca, brinco_mae,
                             id_fornecedor, data_compra, valor_compra)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [a.brinco, a.sexo, a.data_nascimento, a.id_raca, a.brinco_mae || null,
         id_fornecedor, data_compra, a.valor_compra]
      );
      await client.query(
        'INSERT INTO transita_com (brinco, numero_gta) VALUES ($1, $2)',
        [a.brinco, gta.numero_gta]
      );
      // Entrada no piquete no dia da compra. As regras do banco conferem
      // lotacao (RI-09) e descanso (RI-10); se falhar, a compra toda e desfeita.
      if (id_piquete) {
        await client.query(
          'INSERT INTO ocupa (brinco, data_entrada, id_piquete) VALUES ($1, $2, $3)',
          [a.brinco, data_compra, id_piquete]
        );
      }
    }
  });

  res.status(201).json({
    mensagem: `Compra registrada: ${animais.length} animal(is) com a GTA ${gta.numero_gta}.`,
  });
});
