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
//   "gta": { "numero_gta": "MG-26-0040001", "data_emissao": "2026-11-04",
//            "origem": "...", "destino": "...", "finalidade": "RECRIA" },
//   "animais": [ { "brinco": "0301", "sexo": "M", "data_nascimento": "2025-10-01",
//                  "id_raca": 1, "valor_compra": 2900 } ]
// }
comprasRouter.post('/', exigirPermissao('compras.criar'), async (req, res) => {
  const { id_fornecedor, data_compra, gta, animais } = req.body ?? {};
  if (!id_fornecedor || !data_compra || !gta?.numero_gta || !Array.isArray(animais) || animais.length === 0) {
    throw new ErroHttp(400, 'Informe fornecedor, data da compra, GTA e pelo menos um animal.');
  }

  await emTransacao(async (client) => {
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
    }
  });

  res.status(201).json({
    mensagem: `Compra registrada: ${animais.length} animal(is) com a GTA ${gta.numero_gta}.`,
  });
});
