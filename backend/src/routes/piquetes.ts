import { Router } from 'express';
import { pool } from '../db/pool.js';
import { idDaRota, numeroObrigatorio, textoObrigatorio } from '../db/campos.js';
import { ErroHttp } from '../middleware/erros.js';
import { exigirPermissao } from '../middleware/auth.js';

// Piquetes. A listagem usa a view vw_lotacao_piquete, que ja calcula
// lotacao, vagas e situacao (Em uso / Em descanso / Disponivel).
export const piquetesRouter = Router();

const NAO_ENCONTRADO = 'Piquete não encontrado.';

const SELECT_PIQUETE = `
  SELECT v.id_piquete, v.nome, v.area_ha, v.capacidade_max, p.descanso_min_dias,
         v.animais::int AS animais, v.ocupacao_pct, v.vagas::int AS vagas,
         v.situacao, v.data_liberacao
    FROM vw_lotacao_piquete v
    JOIN piquete p ON p.id_piquete = v.id_piquete`;

function lerPiquete(body: Record<string, unknown> | undefined) {
  const b = body ?? {};
  return {
    nome: textoObrigatorio(b.nome, 'Informe o nome do piquete.'),
    area_ha: numeroObrigatorio(b.area_ha, 'área (ha)'),
    capacidade_max: numeroObrigatorio(b.capacidade_max, 'capacidade máxima'),
    descanso_min_dias: numeroObrigatorio(b.descanso_min_dias, 'descanso mínimo (dias)'),
  };
}

// GET /api/piquetes?situacao=Disponível  -> lista com lotacao
// (no formulario de movimentacao, o front pode filtrar os que tem vaga)
piquetesRouter.get('/', exigirPermissao('piquetes.visualizar'), async (req, res) => {
  const situacao = req.query.situacao ? String(req.query.situacao) : null;
  const { rows } = await pool.query(
    `${SELECT_PIQUETE}
      WHERE $1::text IS NULL OR v.situacao = $1
      ORDER BY v.nome`,
    [situacao]
  );
  res.json(rows);
});

// GET /api/piquetes/:id  -> dados + animais que estao nele agora
piquetesRouter.get('/:id', exigirPermissao('piquetes.visualizar'), async (req, res) => {
  const id = idDaRota(req.params.id, NAO_ENCONTRADO);
  const piquete = await pool.query(`${SELECT_PIQUETE} WHERE v.id_piquete = $1`, [id]);
  if (!piquete.rows[0]) throw new ErroHttp(404, NAO_ENCONTRADO);

  const animais = await pool.query(
    `SELECT o.brinco, o.data_entrada, a.sexo, a.categoria
       FROM ocupa o
       JOIN vw_animal a ON a.brinco = o.brinco
      WHERE o.id_piquete = $1 AND o.data_saida IS NULL
      ORDER BY o.brinco`,
    [id]
  );
  res.json({ ...piquete.rows[0], animais_no_piquete: animais.rows });
});

// POST /api/piquetes
// { "nome": "P05 - Morro", "area_ha": 12.5, "capacidade_max": 30, "descanso_min_dias": 28 }
piquetesRouter.post('/', exigirPermissao('piquetes.criar'), async (req, res) => {
  const p = lerPiquete(req.body);
  const { rows } = await pool.query(
    `INSERT INTO piquete (nome, area_ha, capacidade_max, descanso_min_dias)
     VALUES ($1, $2, $3, $4)
     RETURNING id_piquete, nome, area_ha, capacidade_max, descanso_min_dias`,
    [p.nome, p.area_ha, p.capacidade_max, p.descanso_min_dias]
  );
  res.status(201).json(rows[0]);
});

// PUT /api/piquetes/:id
// Reduzir a capacidade abaixo da lotacao atual e barrado pelo banco (RI-09).
piquetesRouter.put('/:id', exigirPermissao('piquetes.editar'), async (req, res) => {
  const id = idDaRota(req.params.id, NAO_ENCONTRADO);
  const p = lerPiquete(req.body);
  const { rows } = await pool.query(
    `UPDATE piquete
        SET nome = $1, area_ha = $2, capacidade_max = $3, descanso_min_dias = $4
      WHERE id_piquete = $5
      RETURNING id_piquete, nome, area_ha, capacidade_max, descanso_min_dias`,
    [p.nome, p.area_ha, p.capacidade_max, p.descanso_min_dias, id]
  );
  if (!rows[0]) throw new ErroHttp(404, NAO_ENCONTRADO);
  res.json(rows[0]);
});

// DELETE /api/piquetes/:id
piquetesRouter.delete('/:id', exigirPermissao('piquetes.excluir'), async (req, res) => {
  const id = idDaRota(req.params.id, NAO_ENCONTRADO);
  // Piquete com historico de ocupacao nao pode sair (chave estrangeira).
  const { rowCount } = await pool.query('DELETE FROM piquete WHERE id_piquete = $1', [id]);
  if (!rowCount) throw new ErroHttp(404, NAO_ENCONTRADO);
  res.status(204).end();
});
