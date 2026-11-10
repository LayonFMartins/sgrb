import { Router } from 'express';
import { pool } from '../db/pool.js';
import { ErroHttp } from '../middleware/erros.js';
import { exigirPerfil } from '../middleware/auth.js';

// Modelo de CRUD simples: listar, buscar, cadastrar, editar e excluir.
export const racasRouter = Router();

// Listar e buscar: qualquer usuario logado
racasRouter.get('/', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT r.id_raca, r.nome, count(a.brinco)::int AS animais
       FROM raca r
       LEFT JOIN animal a ON a.id_raca = r.id_raca
      GROUP BY r.id_raca
      ORDER BY r.nome`
  );
  res.json(rows);
});

racasRouter.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT id_raca, nome FROM raca WHERE id_raca = $1', [req.params.id]);
  if (!rows[0]) throw new ErroHttp(404, 'Raça não encontrada.');
  res.json(rows[0]);
});

// Cadastrar, editar e excluir: so o proprietario
racasRouter.post('/', exigirPerfil('PROPRIETARIO'), async (req, res) => {
  const nome = String(req.body?.nome ?? '').trim();
  if (!nome) throw new ErroHttp(400, 'Informe o nome da raça.');

  const { rows } = await pool.query(
    'INSERT INTO raca (nome) VALUES ($1) RETURNING id_raca, nome',
    [nome]
  );
  res.status(201).json(rows[0]);
});

racasRouter.put('/:id', exigirPerfil('PROPRIETARIO'), async (req, res) => {
  const nome = String(req.body?.nome ?? '').trim();
  if (!nome) throw new ErroHttp(400, 'Informe o nome da raça.');

  const { rows } = await pool.query(
    'UPDATE raca SET nome = $1 WHERE id_raca = $2 RETURNING id_raca, nome',
    [nome, req.params.id]
  );
  if (!rows[0]) throw new ErroHttp(404, 'Raça não encontrada.');
  res.json(rows[0]);
});

racasRouter.delete('/:id', exigirPerfil('PROPRIETARIO'), async (req, res) => {
  // Se houver animais dessa raca, o banco bloqueia (chave estrangeira).
  const { rowCount } = await pool.query('DELETE FROM raca WHERE id_raca = $1', [req.params.id]);
  if (!rowCount) throw new ErroHttp(404, 'Raça não encontrada.');
  res.status(204).end();
});
