import { Router } from 'express';
import { pool } from '../db/pool.js';
import { ErroHttp } from '../middleware/erros.js';
import { exigirPermissao } from '../middleware/auth.js';

export const animaisRouter = Router();

// GET /api/animais?situacao=Ativo  -> rebanho com idade, categoria e piquete atual
animaisRouter.get('/', exigirPermissao('animais.visualizar'), async (req, res) => {
  const situacao = req.query.situacao ? String(req.query.situacao) : null;
  const { rows } = await pool.query(
    `SELECT brinco, sexo, raca, data_nascimento, idade_meses, categoria, origem,
            brinco_mae, fornecedor, situacao, piquete_atual, ultimo_peso_kg, data_ultimo_peso
       FROM vw_animal
      WHERE $1::text IS NULL OR situacao = $1
      ORDER BY brinco`,
    [situacao]
  );
  res.json(rows);
});

// GET /api/animais/:brinco  -> ficha completa (dados + linha do tempo)
animaisRouter.get('/:brinco', exigirPermissao('animais.visualizar'), async (req, res) => {
  const { brinco } = req.params;
  const animal = await pool.query('SELECT * FROM vw_animal WHERE brinco = $1', [brinco]);
  if (!animal.rows[0]) throw new ErroHttp(404, 'Animal não encontrado.');

  const historico = await pool.query(
    `SELECT data, evento, detalhe
       FROM vw_linha_do_tempo
      WHERE brinco = $1
      ORDER BY data, ordem`,
    [brinco]
  );
  res.json({ ...animal.rows[0], historico: historico.rows });
});

// GET /api/animais/:brinco/crias  -> crias de uma matriz
animaisRouter.get('/:brinco/crias', exigirPermissao('animais.visualizar'), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT brinco, sexo, data_nascimento, categoria, situacao
       FROM vw_animal
      WHERE brinco_mae = $1
      ORDER BY data_nascimento`,
    [req.params.brinco]
  );
  res.json(rows);
});

// POST /api/animais  -> animal nascido na fazenda ou do rebanho inicial.
// Animal comprado entra pela rota /api/compras, junto com a GTA.
animaisRouter.post('/', exigirPermissao('animais.criar'), async (req, res) => {
  const { brinco, sexo, data_nascimento, id_raca, brinco_mae } = req.body ?? {};
  if (!brinco || !sexo || !data_nascimento || !id_raca) {
    throw new ErroHttp(400, 'Informe brinco, sexo, data de nascimento e raça.');
  }

  const { rows } = await pool.query(
    `INSERT INTO animal (brinco, sexo, data_nascimento, id_raca, brinco_mae)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING brinco`,
    [brinco, sexo, data_nascimento, id_raca, brinco_mae || null]
  );
  res.status(201).json(rows[0]);
});

// PUT /api/animais/:brinco  -> edicao (inclusive correcao do brinco)
animaisRouter.put('/:brinco', exigirPermissao('animais.editar'), async (req, res) => {
  const { brinco, sexo, data_nascimento, id_raca, brinco_mae } = req.body ?? {};
  if (!brinco || !sexo || !data_nascimento || !id_raca) {
    throw new ErroHttp(400, 'Informe brinco, sexo, data de nascimento e raça.');
  }

  const { rows } = await pool.query(
    `UPDATE animal
        SET brinco = $1, sexo = $2, data_nascimento = $3, id_raca = $4, brinco_mae = $5
      WHERE brinco = $6
      RETURNING brinco`,
    [brinco, sexo, data_nascimento, id_raca, brinco_mae || null, req.params.brinco]
  );
  if (!rows[0]) throw new ErroHttp(404, 'Animal não encontrado.');
  res.json(rows[0]);
});

// DELETE /api/animais/:brinco  -> exclui o animal e todo o seu historico.
// O banco bloqueia se o animal for mae de outros animais.
animaisRouter.delete('/:brinco', exigirPermissao('animais.excluir'), async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM animal WHERE brinco = $1', [req.params.brinco]);
  if (!rowCount) throw new ErroHttp(404, 'Animal não encontrado.');
  res.status(204).end();
});
