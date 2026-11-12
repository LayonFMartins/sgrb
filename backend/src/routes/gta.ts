import { Router } from 'express';
import { pool } from '../db/pool.js';
import { ErroHttp } from '../middleware/erros.js';
import { exigirPermissao } from '../middleware/auth.js';

// Consulta das GTAs (guias de transito animal). As GTAs sao criadas junto
// com a compra (entrada) e com a venda (saida); aqui so se consulta.
export const gtaRouter = Router();

const SELECT_GTA = `
  SELECT g.numero_gta, g.tipo, g.data_emissao, g.origem, g.destino, g.finalidade,
         count(t.brinco)::int AS total_animais,
         COALESCE(array_agg(t.brinco ORDER BY t.brinco) FILTER (WHERE t.brinco IS NOT NULL), '{}') AS animais
    FROM gta g
    LEFT JOIN transita_com t ON t.numero_gta = g.numero_gta`;

// GET /api/gta?tipo=ENTRADA|SAIDA  -> GTAs com os brincos de cada uma
gtaRouter.get('/', exigirPermissao('gta.visualizar'), async (req, res) => {
  const tipo = typeof req.query.tipo === 'string' ? req.query.tipo.toUpperCase() : null;
  if (tipo && tipo !== 'ENTRADA' && tipo !== 'SAIDA') {
    throw new ErroHttp(400, 'Tipo de GTA inválido: use ENTRADA ou SAIDA.');
  }
  const { rows } = await pool.query(
    `${SELECT_GTA}
      WHERE ($1::varchar IS NULL OR g.tipo = $1)
      GROUP BY g.numero_gta
      ORDER BY g.data_emissao DESC, g.numero_gta`,
    [tipo]
  );
  res.json(rows);
});

// GET /api/gta/:numero  -> uma GTA
gtaRouter.get('/:numero', exigirPermissao('gta.visualizar'), async (req, res) => {
  const { rows } = await pool.query(
    `${SELECT_GTA}
      WHERE g.numero_gta = $1
      GROUP BY g.numero_gta`,
    [req.params.numero]
  );
  if (!rows[0]) throw new ErroHttp(404, 'GTA não encontrada.');
  res.json(rows[0]);
});
