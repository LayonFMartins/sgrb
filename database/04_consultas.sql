-- SGRB - views das consultas

DROP VIEW IF EXISTS
    vw_linha_do_tempo, vw_campanhas_pendentes, vw_reforcos, vw_carencia,
    vw_gmd_por_fornecedor, vw_gmd_por_raca, vw_ranking_gmd, vw_gmd_pesagens,
    vw_lotacao_piquete, vw_animal
CASCADE;

-- Cadastro do animal com atributos derivados e situacao atual
CREATE VIEW vw_animal AS
SELECT a.brinco,
       a.sexo,
       r.nome                                                   AS raca,
       a.data_nascimento,
       fn_idade_meses(a.data_nascimento, COALESCE(b.data_baixa, CURRENT_DATE)) AS idade_meses,
       fn_categoria(a.sexo, fn_idade_meses(a.data_nascimento, COALESCE(b.data_baixa, CURRENT_DATE))) AS categoria,
       CASE WHEN a.id_fornecedor IS NOT NULL THEN 'Compra'
            WHEN a.brinco_mae    IS NOT NULL THEN 'Nascimento'
            ELSE 'Rebanho inicial' END                          AS origem,
       a.brinco_mae,
       f.nome_propriedade                                       AS fornecedor,
       a.data_compra,
       a.valor_compra,
       CASE b.motivo WHEN 'VENDA' THEN 'Vendido'
                     WHEN 'OBITO' THEN 'Óbito'
                     ELSE 'Ativo' END                           AS situacao,
       b.data_baixa,
       pq.nome                                                  AS piquete_atual,
       up.peso_kg                                               AS ultimo_peso_kg,
       up.data_pesagem                                          AS data_ultimo_peso
  FROM animal a
  JOIN raca r              ON r.id_raca = a.id_raca
  LEFT JOIN fornecedor f   ON f.id_fornecedor = a.id_fornecedor
  LEFT JOIN baixa b        ON b.brinco = a.brinco
  LEFT JOIN ocupa o        ON o.brinco = a.brinco AND o.data_saida IS NULL
  LEFT JOIN piquete pq     ON pq.id_piquete = o.id_piquete
  LEFT JOIN LATERAL (
        SELECT p.peso_kg, p.data_pesagem
          FROM pesagem p
         WHERE p.brinco = a.brinco
         ORDER BY p.data_pesagem DESC
         LIMIT 1) up ON TRUE;

-- Lotacao atual dos piquetes e piquetes em descanso
CREATE VIEW vw_lotacao_piquete AS
WITH resumo AS (
    SELECT pq.id_piquete, pq.nome, pq.area_ha, pq.capacidade_max, pq.descanso_min_dias,
           count(o.brinco) FILTER (WHERE o.data_saida IS NULL) AS animais,
           max(o.data_saida)                                   AS ultima_saida
      FROM piquete pq
      LEFT JOIN ocupa o ON o.id_piquete = pq.id_piquete
     GROUP BY pq.id_piquete
)
SELECT id_piquete,
       nome,
       area_ha,
       capacidade_max,
       animais,
       round(100.0 * animais / capacidade_max, 1)             AS ocupacao_pct,
       capacidade_max - animais                                AS vagas,
       CASE WHEN animais > 0 THEN 'Em uso'
            WHEN ultima_saida + descanso_min_dias > CURRENT_DATE THEN 'Em descanso'
            ELSE 'Disponível' END                              AS situacao,
       CASE WHEN animais = 0 AND ultima_saida + descanso_min_dias > CURRENT_DATE
            THEN ultima_saida + descanso_min_dias END          AS data_liberacao
  FROM resumo;

-- GMD entre pesagens consecutivas e ranking
CREATE VIEW vw_gmd_pesagens AS
SELECT brinco,
       data_pesagem,
       peso_kg,
       LAG(peso_kg)      OVER w                                AS peso_anterior_kg,
       data_pesagem - LAG(data_pesagem) OVER w                 AS dias,
       round((peso_kg - LAG(peso_kg) OVER w)
             / NULLIF(data_pesagem - LAG(data_pesagem) OVER w, 0), 3) AS gmd_kg_dia
  FROM pesagem
WINDOW w AS (PARTITION BY brinco ORDER BY data_pesagem);

-- GMD de cada animal no periodo todo (primeira ate ultima pesagem)
CREATE VIEW vw_ranking_gmd AS
WITH extremos AS (
    SELECT brinco,
           min(data_pesagem) AS data_inicial,
           max(data_pesagem) AS data_final,
           (array_agg(peso_kg ORDER BY data_pesagem ASC))[1]  AS peso_inicial,
           (array_agg(peso_kg ORDER BY data_pesagem DESC))[1] AS peso_final,
           count(*) AS pesagens
      FROM pesagem
     GROUP BY brinco
    HAVING count(*) >= 2
)
SELECT RANK() OVER (ORDER BY (e.peso_final - e.peso_inicial) / (e.data_final - e.data_inicial) DESC) AS posicao,
       e.brinco,
       va.raca,
       va.categoria,
       va.fornecedor,
       va.situacao,
       e.peso_inicial,
       e.peso_final,
       e.data_final - e.data_inicial                                        AS dias,
       round((e.peso_final - e.peso_inicial) / (e.data_final - e.data_inicial), 3) AS gmd_kg_dia
  FROM extremos e
  JOIN vw_animal va ON va.brinco = e.brinco
  JOIN animal a     ON a.brinco  = e.brinco
 WHERE fn_idade_meses(a.data_nascimento, e.data_inicial) < 24;

CREATE VIEW vw_gmd_por_raca AS
SELECT raca,
       count(*)                 AS animais,
       round(avg(gmd_kg_dia), 3) AS gmd_medio_kg_dia
  FROM vw_ranking_gmd
 GROUP BY raca;

CREATE VIEW vw_gmd_por_fornecedor AS
SELECT fornecedor,
       count(*)                 AS animais,
       round(avg(gmd_kg_dia), 3) AS gmd_medio_kg_dia
  FROM vw_ranking_gmd
 WHERE fornecedor IS NOT NULL
 GROUP BY fornecedor;

-- Animais em carencia e data de liberacao para abate
CREATE VIEW vw_carencia AS
SELECT DISTINCT ON (r.brinco)
       r.brinco,
       p.nome                              AS produto,
       r.data_aplicacao,
       p.carencia_dias,
       r.data_aplicacao + p.carencia_dias  AS data_liberacao,
       (r.data_aplicacao + p.carencia_dias) - CURRENT_DATE AS dias_restantes
  FROM recebe r
  JOIN produto_sanitario p ON p.id_produto = r.id_produto
 WHERE r.data_aplicacao + p.carencia_dias > CURRENT_DATE
   AND NOT EXISTS (SELECT 1 FROM baixa b WHERE b.brinco = r.brinco)
 ORDER BY r.brinco, r.data_aplicacao + p.carencia_dias DESC;

-- Proxima dose / reforco de cada produto (RI-13)
CREATE VIEW vw_reforcos AS
WITH ultima AS (
    SELECT DISTINCT ON (r.brinco, r.id_produto)
           r.brinco, r.id_produto, r.data_aplicacao, r.num_dose
      FROM recebe r
     ORDER BY r.brinco, r.id_produto, r.data_aplicacao DESC
)
SELECT u.brinco,
       p.nome                                         AS produto,
       u.num_dose                                     AS ultima_dose,
       u.data_aplicacao                               AS data_ultima_dose,
       u.data_aplicacao + p.intervalo_reforco_dias    AS data_proxima_dose,
       CASE WHEN u.data_aplicacao + p.intervalo_reforco_dias < CURRENT_DATE
            THEN 'Atrasado' ELSE 'Em dia' END         AS situacao,
       GREATEST(CURRENT_DATE - (u.data_aplicacao + p.intervalo_reforco_dias), 0) AS dias_atraso
  FROM ultima u
  JOIN produto_sanitario p ON p.id_produto = u.id_produto
 WHERE p.intervalo_reforco_dias IS NOT NULL
   AND (u.num_dose < p.num_doses OR p.num_doses = 1)
   AND NOT EXISTS (SELECT 1 FROM baixa b WHERE b.brinco = u.brinco);

-- Vacinacoes com janela de idade ainda nao aplicadas (ex.: brucelose)
CREATE VIEW vw_campanhas_pendentes AS
SELECT a.brinco,
       a.sexo,
       fn_idade_meses(a.data_nascimento, CURRENT_DATE)              AS idade_meses,
       p.nome                                                       AS produto,
       p.idade_min_meses,
       p.idade_max_meses,
       (a.data_nascimento + make_interval(months => p.idade_max_meses + 1) - INTERVAL '1 day')::DATE AS prazo_final
  FROM animal a
  JOIN produto_sanitario p
    ON (p.sexo_alvo IS NULL OR p.sexo_alvo = a.sexo)
   AND fn_idade_meses(a.data_nascimento, CURRENT_DATE)
       BETWEEN COALESCE(p.idade_min_meses, 0) AND COALESCE(p.idade_max_meses, 999)
 WHERE (p.idade_min_meses IS NOT NULL OR p.idade_max_meses IS NOT NULL)
   AND NOT EXISTS (SELECT 1 FROM baixa b  WHERE b.brinco = a.brinco)
   AND NOT EXISTS (SELECT 1 FROM recebe r WHERE r.brinco = a.brinco AND r.id_produto = p.id_produto);

-- Formatacao de numeros no padrao brasileiro (468.5 -> '468,5 kg'; 3150 -> 'R$ 3.150,00').
-- O formato usa ',' e '.' literais e troca depois, para nao depender do idioma do servidor.
CREATE OR REPLACE FUNCTION fn_kg(p_valor NUMERIC) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
    SELECT translate(to_char(p_valor, 'FM999,990.0'), ',.', '.,') || ' kg';
$$;

CREATE OR REPLACE FUNCTION fn_reais(p_valor NUMERIC) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
    SELECT 'R$ ' || translate(to_char(p_valor, 'FM999,999,990.00'), ',.', '.,');
$$;

-- Linha do tempo de rastreabilidade (ficha completa do animal)
CREATE VIEW vw_linha_do_tempo AS
SELECT a.brinco, a.data_nascimento AS data, 1 AS ordem, 'Nascimento' AS evento,
       CASE WHEN a.brinco_mae IS NOT NULL THEN 'Mãe: ' || a.brinco_mae
            ELSE 'Mãe não registrada' END AS detalhe
  FROM animal a
UNION ALL
SELECT a.brinco, a.data_compra, 2, 'Compra',
       f.nome_propriedade || ' (' || f.municipio || '/' || f.uf || ') - ' || fn_reais(a.valor_compra)
  FROM animal a JOIN fornecedor f ON f.id_fornecedor = a.id_fornecedor
UNION ALL
SELECT t.brinco, g.data_emissao, 3, CASE g.tipo WHEN 'SAIDA' THEN 'GTA de saída' ELSE 'GTA de entrada' END,
       g.numero_gta || ': ' || g.origem || ' -> ' || g.destino || ' (' || lower(g.finalidade) || ')'
  FROM transita_com t JOIN gta g ON g.numero_gta = t.numero_gta
UNION ALL
SELECT o.brinco, o.data_entrada, 4, 'Entrada em piquete',
       pq.nome || COALESCE(' até ' || to_char(o.data_saida, 'DD/MM/YYYY'), ' (atual)')
  FROM ocupa o JOIN piquete pq ON pq.id_piquete = o.id_piquete
UNION ALL
SELECT p.brinco, p.data_pesagem, 5, 'Pesagem',
       fn_kg(p.peso_kg) || ' - ' || u.nome
  FROM pesagem p JOIN usuario u ON u.id_usuario = p.id_usuario
UNION ALL
SELECT r.brinco, r.data_aplicacao, 6, 'Aplicação sanitária',
       ps.nome || ' - dose ' || r.num_dose || ' - lote ' || r.lote_medicamento || ' - ' || u.nome
  FROM recebe r
  JOIN produto_sanitario ps ON ps.id_produto = r.id_produto
  JOIN usuario u            ON u.id_usuario = r.id_usuario
UNION ALL
SELECT b.brinco, b.data_baixa, 7, CASE b.motivo WHEN 'VENDA' THEN 'Baixa (venda)' ELSE 'Baixa (óbito)' END,
       COALESCE(v.comprador || ' - ' || fn_kg(v.peso_final_kg) || ' - ' || fn_reais(v.valor_venda), o.causa)
  FROM baixa b
  LEFT JOIN venda v ON v.id_baixa = b.id_baixa
  LEFT JOIN obito o ON o.id_baixa = b.id_baixa;

-- Exemplos de uso

-- Rebanho ativo

-- Ficha completa de rastreabilidade de um animal

-- Lotacao dos piquetes e piquetes em descanso

-- Ranking de GMD por animal, raca e fornecedor

-- Animais em carencia

-- Reforcos atrasados e vacinacoes obrigatorias pendentes

-- Crias de uma matriz
