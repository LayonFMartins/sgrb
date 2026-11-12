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

// Data opcional AAAA-MM-DD vinda da URL (?inicio=2026-01-01).
function dataOpcional(valor: unknown, campo: string): string | null {
  if (valor === undefined || valor === '') return null;
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw new ErroHttp(400, `Data ${campo} inválida: use o formato AAAA-MM-DD.`);
  }
  return valor;
}

// GET /api/consultas/gmd?agrupar=animal|raca|fornecedor&inicio=&fim=
// Ranking de ganho medio diario. O calculo fica na funcao fn_ranking_gmd do
// banco; sem periodo, usa todas as pesagens (igual a view vw_ranking_gmd).
consultasRouter.get('/gmd', exigirPermissao('consultas.visualizar'), async (req, res) => {
  const agrupar = String(req.query.agrupar ?? 'animal');
  const inicio = dataOpcional(req.query.inicio, 'inicial');
  const fim = dataOpcional(req.query.fim, 'final');
  if (inicio && fim && inicio > fim) throw new ErroHttp(400, 'A data inicial precisa ser anterior à final.');
  const periodo = [inicio, fim];

  if (agrupar === 'animal') {
    const { rows } = await pool.query(`
      SELECT posicao::int, brinco, raca, categoria, fornecedor, situacao,
             peso_inicial, peso_final, dias, gmd_kg_dia
        FROM fn_ranking_gmd($1, $2)
       ORDER BY posicao, brinco`, periodo);
    return res.json(rows);
  }
  if (agrupar === 'raca' || agrupar === 'fornecedor') {
    const { rows } = await pool.query(`
      -- agrupar só pode ser raca ou fornecedor (conferido no if), por isso pode ir direto no SQL
      SELECT ${agrupar} AS grupo, count(*)::int AS animais, round(avg(gmd_kg_dia), 3) AS gmd_medio_kg_dia
        FROM fn_ranking_gmd($1, $2)
       WHERE ${agrupar} IS NOT NULL
       GROUP BY ${agrupar}
       ORDER BY gmd_medio_kg_dia DESC`, periodo);
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

// GET /api/consultas/lotes -> lotes de medicamento aplicados (para escolher no rastreio)
consultasRouter.get('/lotes', exigirPermissao('consultas.visualizar'), async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT lote, produto, count(DISTINCT brinco)::int AS animais,
           min(data_aplicacao) AS primeira_aplicacao, max(data_aplicacao) AS ultima_aplicacao
      FROM vw_rastreio_lote
     GROUP BY lote, produto
     ORDER BY max(data_aplicacao) DESC, lote`);
  res.json(rows);
});

// GET /api/consultas/rastreio?lote=IVM-25-0815 -> animais que receberam o lote e onde estao
consultasRouter.get('/rastreio', exigirPermissao('consultas.visualizar'), async (req, res) => {
  const lote = typeof req.query.lote === 'string' ? req.query.lote.trim() : '';
  if (!lote) throw new ErroHttp(400, 'Informe o lote do medicamento.');
  const { rows } = await pool.query(`
    SELECT lote, produto, data_aplicacao, num_dose, responsavel, brinco, raca, categoria,
           situacao, piquete_atual, data_baixa, destino_final, gta_saida, destino_gta
      FROM vw_rastreio_lote
     WHERE upper(lote) = upper($1)
     ORDER BY data_aplicacao, brinco`, [lote]);
  res.json(rows);
});

// GET /api/consultas/vendas -> resultado de cada animal vendido
consultasRouter.get('/vendas', exigirPermissao('consultas.visualizar'), async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT brinco, raca, origem, fornecedor, data_entrada, data_venda, dias_na_fazenda,
           comprador, valor_compra, valor_venda, margem_bruta, peso_entrada, peso_saida,
           ganho_kg, valor_por_kg
      FROM vw_resultado_vendas
     ORDER BY data_venda DESC, brinco`);
  res.json(rows);
});
