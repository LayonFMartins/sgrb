import { Router } from 'express';
import { pool } from '../db/pool.js';
import { ErroHttp } from '../middleware/erros.js';
import { exigirPermissao } from '../middleware/auth.js';

// Consultas e painel: somente leitura, sobre as views do banco
// (database/04_consultas.sql). Os calculos (idade, categoria, GMD,
// carencia, reforcos) ficam no banco; aqui so filtramos e ordenamos.
export const consultasRouter = Router();

const SQL_LOTACAO = `
  SELECT id_piquete, nome, area_ha, capacidade_max, animais::int, ocupacao_pct,
         vagas::int, situacao, data_liberacao
    FROM vw_lotacao_piquete
   ORDER BY nome`;

const SQL_CARENCIA = `
  SELECT brinco, produto, data_aplicacao, carencia_dias, data_liberacao, dias_restantes
    FROM vw_carencia
   ORDER BY data_liberacao`;

const SQL_REFORCOS_ATRASADOS = `
  SELECT brinco, produto, ultima_dose, data_ultima_dose, data_proxima_dose, dias_atraso
    FROM vw_reforcos
   WHERE situacao = 'Atrasado'
   ORDER BY dias_atraso DESC`;

const SQL_CAMPANHAS = `
  SELECT brinco, sexo, idade_meses, produto, idade_min_meses, idade_max_meses, prazo_final
    FROM vw_campanhas_pendentes
   ORDER BY prazo_final`;

// GET /api/consultas/painel -> resumo da tela inicial
consultasRouter.get('/painel', exigirPermissao('inicio.visualizar'), async (_req, res) => {
  const [rebanho, categorias, lotacao, carencia, reforcos, campanhas] = await Promise.all([
    pool.query(`
      SELECT count(*) FILTER (WHERE situacao = 'Ativo')::int   AS ativos,
             count(*) FILTER (WHERE situacao = 'Vendido')::int AS vendidos,
             count(*) FILTER (WHERE situacao = 'Óbito')::int   AS obitos
        FROM vw_animal`),
    pool.query(`
      SELECT categoria, count(*)::int AS total
        FROM vw_animal
       WHERE situacao = 'Ativo'
       GROUP BY categoria
       ORDER BY total DESC, categoria`),
    pool.query(SQL_LOTACAO),
    pool.query(SQL_CARENCIA),
    pool.query(SQL_REFORCOS_ATRASADOS),
    pool.query(SQL_CAMPANHAS),
  ]);

  res.json({
    rebanho: { ...rebanho.rows[0], por_categoria: categorias.rows },
    piquetes: lotacao.rows,
    carencia: carencia.rows,
    reforcos_atrasados: reforcos.rows,
    campanhas_pendentes: campanhas.rows,
  });
});

// GET /api/consultas/lotacao -> ocupacao de cada piquete e piquetes em descanso
consultasRouter.get('/lotacao', exigirPermissao('consultas.visualizar'), async (_req, res) => {
  const { rows } = await pool.query(SQL_LOTACAO);
  res.json(rows);
});

// GET /api/consultas/gmd?agrupar=animal|raca|fornecedor -> ranking de ganho medio diario
consultasRouter.get('/gmd', exigirPermissao('consultas.visualizar'), async (req, res) => {
  const agrupar = String(req.query.agrupar ?? 'animal');

  if (agrupar === 'animal') {
    const { rows } = await pool.query(`
      SELECT posicao::int, brinco, raca, categoria, fornecedor, situacao,
             peso_inicial, peso_final, dias, gmd_kg_dia
        FROM vw_ranking_gmd
       ORDER BY posicao, brinco`);
    return res.json(rows);
  }
  if (agrupar === 'raca') {
    const { rows } = await pool.query(`
      SELECT raca AS grupo, animais::int, gmd_medio_kg_dia
        FROM vw_gmd_por_raca
       ORDER BY gmd_medio_kg_dia DESC`);
    return res.json(rows);
  }
  if (agrupar === 'fornecedor') {
    const { rows } = await pool.query(`
      SELECT fornecedor AS grupo, animais::int, gmd_medio_kg_dia
        FROM vw_gmd_por_fornecedor
       ORDER BY gmd_medio_kg_dia DESC`);
    return res.json(rows);
  }
  throw new ErroHttp(400, 'Use agrupar=animal, raca ou fornecedor.');
});

// GET /api/consultas/carencia -> animais em carencia e data de liberacao para abate
consultasRouter.get('/carencia', exigirPermissao('consultas.visualizar'), async (_req, res) => {
  const { rows } = await pool.query(SQL_CARENCIA);
  res.json(rows);
});

// GET /api/consultas/reforcos?situacao=Atrasado|Em dia -> proximas doses
consultasRouter.get('/reforcos', exigirPermissao('consultas.visualizar'), async (req, res) => {
  const situacao = req.query.situacao ? String(req.query.situacao) : null;
  const { rows } = await pool.query(`
    SELECT brinco, produto, ultima_dose, data_ultima_dose, data_proxima_dose, situacao, dias_atraso
      FROM vw_reforcos
     WHERE $1::text IS NULL OR situacao = $1
     ORDER BY dias_atraso DESC, data_proxima_dose`,
    [situacao]);
  res.json(rows);
});

// GET /api/consultas/campanhas -> vacinacoes com janela de idade pendentes (ex.: brucelose)
consultasRouter.get('/campanhas', exigirPermissao('consultas.visualizar'), async (_req, res) => {
  const { rows } = await pool.query(SQL_CAMPANHAS);
  res.json(rows);
});
