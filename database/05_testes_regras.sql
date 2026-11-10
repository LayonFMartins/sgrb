-- SGRB - testes das regras (nada é gravado)

-- RI-01: um animal nao pode ser mae de si mesmo
DO $$ BEGIN
    UPDATE animal SET brinco_mae = '0201' WHERE brinco = '0201';
    RAISE EXCEPTION 'FALHOU: RI-01 nao barrou';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK - RI-01: %', SQLERRM;
END $$;

-- RI-02: a mae precisa ser femea (0101 e macho)
DO $$ BEGIN
    INSERT INTO animal (brinco, sexo, data_nascimento, id_raca, brinco_mae)
    VALUES ('9001', 'M', CURRENT_DATE, 1, '0101');
    RAISE EXCEPTION 'FALHOU: RI-02 nao barrou';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK - %', SQLERRM;
END $$;

-- RI-02: a mae precisa ter nascido antes da cria
DO $$ BEGIN
    INSERT INTO animal (brinco, sexo, data_nascimento, id_raca, brinco_mae)
    VALUES ('9001', 'F', '2019-01-01', 1, '0001');
    RAISE EXCEPTION 'FALHOU: RI-02 nao barrou';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK - %', SQLERRM;
END $$;

-- RI-04: compra com fornecedor, mas sem data e valor
DO $$ BEGIN
    INSERT INTO animal (brinco, sexo, data_nascimento, id_raca, id_fornecedor)
    VALUES ('9001', 'M', '2025-01-01', 1, 1);
    RAISE EXCEPTION 'FALHOU: RI-04 nao barrou';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK - RI-04: %', SQLERRM;
END $$;

-- RI-05: compra anterior ao nascimento
DO $$ BEGIN
    INSERT INTO animal (brinco, sexo, data_nascimento, id_raca, id_fornecedor, data_compra, valor_compra)
    VALUES ('9001', 'M', '2025-01-01', 1, 1, '2024-12-01', 2500);
    RAISE EXCEPTION 'FALHOU: RI-05 nao barrou';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK - RI-05: %', SQLERRM;
END $$;

-- RI-06: animal comprado sem GTA de entrada (verificada no fim da transacao)
DO $$ BEGIN
    INSERT INTO animal (brinco, sexo, data_nascimento, id_raca, id_fornecedor, data_compra, valor_compra)
    VALUES ('9001', 'M', '2025-01-01', 1, 1, CURRENT_DATE, 2500);
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'FALHOU: RI-06 nao barrou';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK - %', SQLERRM;
END $$;

-- RI-07: saida do piquete anterior a entrada
DO $$ BEGIN
    UPDATE ocupa SET data_saida = data_entrada - 1
     WHERE brinco = '0001' AND data_saida IS NULL;
    RAISE EXCEPTION 'FALHOU: RI-07 nao barrou';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK - RI-07: %', SQLERRM;
END $$;

-- RI-08: o animal 0001 esta no P01; nao pode entrar no P02 sem sair do P01
DO $$ BEGIN
    INSERT INTO ocupa (brinco, data_entrada, id_piquete) VALUES ('0001', CURRENT_DATE, 2);
    RAISE EXCEPTION 'FALHOU: RI-08 nao barrou';
EXCEPTION WHEN exclusion_violation THEN RAISE NOTICE 'OK - RI-08: %', SQLERRM;
END $$;

-- RI-09: P06 com capacidade 3 recebe os 8 animais ativos; o 4o e barrado
DO $$ BEGIN
    UPDATE piquete SET capacidade_max = 3 WHERE id_piquete = 6;
    UPDATE ocupa SET data_saida = CURRENT_DATE WHERE data_saida IS NULL;
    INSERT INTO ocupa (brinco, data_entrada, id_piquete)
    SELECT a.brinco, CURRENT_DATE, 6 FROM animal a
     WHERE NOT EXISTS (SELECT 1 FROM baixa b WHERE b.brinco = a.brinco);
    RAISE EXCEPTION 'FALHOU: RI-09 nao barrou';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK - %', SQLERRM;
END $$;

-- RI-10: o P03 (so com a 0201) fica vazio hoje e entra em descanso de 25 dias
DO $$ BEGIN
    UPDATE ocupa SET data_saida = CURRENT_DATE
     WHERE data_saida IS NULL AND brinco = '0201';
    INSERT INTO ocupa (brinco, data_entrada, id_piquete) VALUES ('0201', CURRENT_DATE, 3);
    RAISE EXCEPTION 'FALHOU: RI-10 nao barrou';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK - %', SQLERRM;
END $$;

-- RI-11: GTA sem nenhum animal (verificada no fim da transacao)
DO $$ BEGIN
    INSERT INTO gta (numero_gta, tipo, data_emissao, origem, destino, finalidade)
    VALUES ('TESTE-0001', 'SAIDA', CURRENT_DATE, 'Fazenda São Bento', 'Outra fazenda', 'RECRIA');
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'FALHOU: RI-11 nao barrou';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK - %', SQLERRM;
END $$;

-- RI-12: idade maxima menor que a minima
DO $$ BEGIN
    INSERT INTO produto_sanitario (nome, tipo, doenca_alvo, carencia_dias, num_doses, idade_min_meses, idade_max_meses)
    VALUES ('Produto teste', 'VACINA', 'Teste', 0, 1, 8, 3);
    RAISE EXCEPTION 'FALHOU: RI-12 nao barrou';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK - RI-12: %', SQLERRM;
END $$;

-- RI-14: brucelose (so femeas) aplicada em macho (0110)
DO $$ BEGIN
    INSERT INTO recebe (brinco, id_produto, data_aplicacao, id_usuario, num_dose, lote_medicamento)
    VALUES ('0110', 1, CURRENT_DATE, 3, 1, 'TESTE');
    RAISE EXCEPTION 'FALHOU: RI-14 nao barrou';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK - %', SQLERRM;
END $$;

-- RI-14: brucelose (3 a 8 meses) na 0201, que tem mais de 8 meses
DO $$ BEGIN
    INSERT INTO recebe (brinco, id_produto, data_aplicacao, id_usuario, num_dose, lote_medicamento)
    VALUES ('0201', 1, CURRENT_DATE, 3, 1, 'TESTE');
    RAISE EXCEPTION 'FALHOU: RI-14 nao barrou';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK - %', SQLERRM;
END $$;

-- RI-15: aplicacao antes do nascimento
DO $$ BEGIN
    INSERT INTO recebe (brinco, id_produto, data_aplicacao, id_usuario, num_dose, lote_medicamento)
    VALUES ('0207', 2, '2026-01-01', 3, 1, 'TESTE');
    RAISE EXCEPTION 'FALHOU: RI-15 nao barrou';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK - %', SQLERRM;
END $$;

-- RI-16: pesagem antes do nascimento
DO $$ BEGIN
    INSERT INTO pesagem (brinco, data_pesagem, peso_kg, id_usuario)
    VALUES ('0207', '2026-01-01', 30, 1);
    RAISE EXCEPTION 'FALHOU: RI-16 nao barrou';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK - %', SQLERRM;
END $$;

-- Entidade fraca: duas pesagens do mesmo animal na mesma data
DO $$ BEGIN
    INSERT INTO pesagem (brinco, data_pesagem, peso_kg, id_usuario)
    VALUES ('0101', '2026-10-14', 540, 1);
    RAISE EXCEPTION 'FALHOU: chave da PESAGEM nao barrou';
EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'OK - PESAGEM: %', SQLERRM;
END $$;

-- RI-17: baixa antes do nascimento
DO $$ BEGIN
    INSERT INTO baixa (brinco, data_baixa, motivo) VALUES ('0207', '2026-01-01', 'OBITO');
    RAISE EXCEPTION 'FALHOU: RI-17 nao barrou';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK - %', SQLERRM;
END $$;

-- TEM: um animal tem no maximo uma baixa (0107 ja foi vendido)
DO $$ BEGIN
    INSERT INTO baixa (brinco, data_baixa, motivo) VALUES ('0107', CURRENT_DATE, 'OBITO');
    RAISE EXCEPTION 'FALHOU: baixa unica nao barrou';
EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'OK - TEM: %', SQLERRM;
END $$;

-- RI-18: baixa por OBITO sem a causa
DO $$ BEGIN
    INSERT INTO baixa (brinco, data_baixa, motivo) VALUES ('0207', CURRENT_DATE, 'OBITO');
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'FALHOU: RI-18 nao barrou';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK - %', SQLERRM;
END $$;

-- RI-18: baixa com motivo VENDA nao pode ir para OBITO (disjuncao)
DO $$ BEGIN
    INSERT INTO obito (id_baixa, causa)
    SELECT id_baixa, 'Teste' FROM baixa WHERE brinco = '0107';
    RAISE EXCEPTION 'FALHOU: RI-18 nao barrou';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK - %', SQLERRM;
END $$;

-- RI-19: 0110 esta em carencia e nao pode ser vendido para abate
DO $$
DECLARE v_id INTEGER;
BEGIN
    INSERT INTO gta (numero_gta, tipo, data_emissao, origem, destino, finalidade)
    VALUES ('TESTE-0002', 'SAIDA', CURRENT_DATE, 'Fazenda São Bento', 'Frigorífico Serra Azul', 'ABATE');
    INSERT INTO transita_com (brinco, numero_gta) VALUES ('0110', 'TESTE-0002');
    INSERT INTO baixa (brinco, data_baixa, motivo) VALUES ('0110', CURRENT_DATE, 'VENDA')
    RETURNING id_baixa INTO v_id;
    INSERT INTO venda (id_baixa, comprador, peso_final_kg, valor_venda)
    VALUES (v_id, 'Frigorífico Serra Azul Ltda', 560, 6100);
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'FALHOU: RI-19 nao barrou';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK - %', SQLERRM;
END $$;

-- RI-20: venda sem GTA de saida
DO $$
DECLARE v_id INTEGER;
BEGIN
    INSERT INTO baixa (brinco, data_baixa, motivo) VALUES ('0101', CURRENT_DATE, 'VENDA')
    RETURNING id_baixa INTO v_id;
    INSERT INTO venda (id_baixa, comprador, peso_final_kg, valor_venda)
    VALUES (v_id, 'Comprador teste', 540, 5900);
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'FALHOU: RI-20 nao barrou';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK - %', SQLERRM;
END $$;

-- RI-21: a baixa fecha a ocupacao atual (teste positivo, depois desfeito)
DO $$
DECLARE v_id INTEGER; v_saida DATE;
BEGIN
    INSERT INTO baixa (brinco, data_baixa, motivo) VALUES ('0207', CURRENT_DATE, 'OBITO')
    RETURNING id_baixa INTO v_id;
    INSERT INTO obito (id_baixa, causa) VALUES (v_id, 'Teste');
    SELECT data_saida INTO v_saida FROM ocupa WHERE brinco = '0207' AND id_piquete = 1;
    IF v_saida = CURRENT_DATE THEN
        RAISE NOTICE 'OK - RI-21: a ocupacao de 0207 no P01 foi encerrada em %', v_saida;
    ELSE
        RAISE EXCEPTION 'FALHOU: RI-21 nao encerrou a ocupacao';
    END IF;
    RAISE EXCEPTION USING ERRCODE = 'no_data_found';
EXCEPTION WHEN no_data_found THEN NULL;
END $$;

-- RI-22: pesagem depois da baixa (0107 foi vendido em 15/09/2026)
DO $$ BEGIN
    INSERT INTO pesagem (brinco, data_pesagem, peso_kg, id_usuario)
    VALUES ('0107', CURRENT_DATE, 610, 1);
    RAISE EXCEPTION 'FALHOU: RI-22 nao barrou';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK - %', SQLERRM;
END $$;

-- RI-22: baixa com data anterior a manejos ja registrados
DO $$ BEGIN
    INSERT INTO baixa (brinco, data_baixa, motivo) VALUES ('0101', '2026-01-01', 'OBITO');
    RAISE EXCEPTION 'FALHOU: RI-22 nao barrou';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK - %', SQLERRM;
END $$;

-- Edicao e exclusao

-- Exclusao bloqueada: a 0001 e mae da 0201
DO $$ BEGIN
    DELETE FROM animal WHERE brinco = '0001';
    RAISE EXCEPTION 'FALHOU: exclusao de mae nao barrou';
EXCEPTION WHEN foreign_key_violation THEN RAISE NOTICE 'OK - Exclusao: %', SQLERRM;
END $$;

-- Exclusao bloqueada: raca em uso por animais
DO $$ BEGIN
    DELETE FROM raca WHERE id_raca = 1;
    RAISE EXCEPTION 'FALHOU: exclusao de raca em uso nao barrou';
EXCEPTION WHEN foreign_key_violation THEN RAISE NOTICE 'OK - Exclusao de raca em uso: %', SQLERRM;
END $$;

-- Exclusao permitida: excluir o 0103 apaga o historico dele (desfeito no fim)
DO $$
DECLARE v_hist INTEGER; v_gta INTEGER;
BEGIN
    DELETE FROM animal WHERE brinco = '0103';
    SET CONSTRAINTS ALL IMMEDIATE;
    SELECT (SELECT count(*) FROM pesagem WHERE brinco = '0103')
         + (SELECT count(*) FROM recebe  WHERE brinco = '0103')
         + (SELECT count(*) FROM ocupa   WHERE brinco = '0103') INTO v_hist;
    SELECT count(*) INTO v_gta FROM gta WHERE numero_gta = 'MG-25-0004517';
    IF v_hist = 0 AND v_gta = 1 THEN
        RAISE NOTICE 'OK - Exclusao do animal 0103: historico apagado e GTA do lote mantida';
    ELSE
        RAISE EXCEPTION 'FALHOU: exclusao do animal 0103';
    END IF;
    RAISE EXCEPTION USING ERRCODE = 'no_data_found';
EXCEPTION WHEN no_data_found THEN NULL;
END $$;

-- Exclusao de GTA: a GTA de entrada do 0110 nao pode ser apagada (RI-06)
DO $$ BEGIN
    DELETE FROM gta WHERE numero_gta = 'GO-25-0102233';
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'FALHOU: exclusao da GTA de entrada nao barrou';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK - %', SQLERRM;
END $$;

-- Edicao de vinculo: trocar a GTA de entrada do 0101 por uma de saida (RI-06)
DO $$ BEGIN
    UPDATE transita_com SET numero_gta = 'MG-26-0031874' WHERE brinco = '0101';
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'FALHOU: troca de GTA nao barrou';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK - %', SQLERRM;
END $$;

-- Exclusao parcial: apagar so a VENDA deixaria a baixa incompleta (RI-18)
DO $$ BEGIN
    DELETE FROM venda WHERE id_baixa = (SELECT id_baixa FROM baixa WHERE brinco = '0107');
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'FALHOU: exclusao parcial da venda nao barrou';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK - %', SQLERRM;
END $$;

-- Exclusao permitida: desfazer a baixa do 0107 apaga junto os dados da venda
DO $$
DECLARE v_id INTEGER;
BEGIN
    SELECT id_baixa INTO v_id FROM baixa WHERE brinco = '0107';
    DELETE FROM baixa WHERE brinco = '0107';
    SET CONSTRAINTS ALL IMMEDIATE;
    IF NOT EXISTS (SELECT 1 FROM venda WHERE id_baixa = v_id) THEN
        RAISE NOTICE 'OK - Baixa do 0107 desfeita junto com os dados da venda';
    ELSE
        RAISE EXCEPTION 'FALHOU: a venda ficou sem baixa';
    END IF;
    RAISE EXCEPTION USING ERRCODE = 'no_data_found';
EXCEPTION WHEN no_data_found THEN NULL;
END $$;

-- Edicao do brinco: corrigir 0101 para 0101A atualiza todo o historico
DO $$
DECLARE v_pes INTEGER;
BEGIN
    UPDATE animal SET brinco = '0101A' WHERE brinco = '0101';
    SET CONSTRAINTS ALL IMMEDIATE;
    SELECT count(*) INTO v_pes FROM pesagem WHERE brinco = '0101A';
    IF v_pes > 0 THEN
        RAISE NOTICE 'OK - Brinco corrigido: % pesagens agora estao em 0101A', v_pes;
    ELSE
        RAISE EXCEPTION 'FALHOU: correcao do brinco nao propagou';
    END IF;
    RAISE EXCEPTION USING ERRCODE = 'no_data_found';
EXCEPTION WHEN no_data_found THEN NULL;
END $$;

-- Edicao bloqueada: a 0001 tem cria e nao pode virar macho (RI-02)
DO $$ BEGIN
    UPDATE animal SET sexo = 'M' WHERE brinco = '0001';
    RAISE EXCEPTION 'FALHOU: troca de sexo da mae nao barrou';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK - %', SQLERRM;
END $$;

-- Edicao bloqueada: nascimento depois de pesagens ja registradas
DO $$ BEGIN
    UPDATE animal SET data_nascimento = '2026-10-01' WHERE brinco = '0207';
    RAISE EXCEPTION 'FALHOU: alteracao do nascimento nao barrou';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK - %', SQLERRM;
END $$;

-- Edicao bloqueada: capacidade do P01 abaixo da lotacao atual (RI-09)
DO $$ BEGIN
    UPDATE piquete SET capacidade_max = 2 WHERE id_piquete = 1;
    RAISE EXCEPTION 'FALHOU: reducao de capacidade nao barrou';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK - %', SQLERRM;
END $$;

-- Edicao bloqueada: brucelose so para machos, mas ja aplicada em femeas (RI-14)
DO $$ BEGIN
    UPDATE produto_sanitario SET sexo_alvo = 'M' WHERE id_produto = 1;
    RAISE EXCEPTION 'FALHOU: alteracao de restricao nao barrou';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK - %', SQLERRM;
END $$;

-- Edicao bloqueada: carencia maior deixaria a venda do 0107 irregular (RI-19)
DO $$ BEGIN
    UPDATE produto_sanitario SET carencia_dias = 200 WHERE nome = 'Ivermectina 1%';
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'FALHOU: aumento de carencia nao barrou';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK - %', SQLERRM;
END $$;

-- Edicao bloqueada: reabrir a ocupacao de um animal ja vendido (RI-22)
DO $$ BEGIN
    UPDATE ocupa SET data_saida = NULL
     WHERE brinco = '0107' AND data_saida = (SELECT data_baixa FROM baixa WHERE brinco = '0107');
    RAISE EXCEPTION 'FALHOU: reabertura da ocupacao nao barrou';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK - %', SQLERRM;
END $$;

-- Usuarios
-- RI-23: email sem senha
DO $$ BEGIN
    INSERT INTO usuario (nome, funcao, tipo, email) VALUES ('Teste', 'Vaqueiro', 'FUNCIONARIO', 'teste@example.com');
    RAISE EXCEPTION 'FALHOU: RI-23 nao barrou';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK - RI-23: %', SQLERRM;
END $$;

-- RI-24: senha gravada em texto puro
DO $$ BEGIN
    INSERT INTO usuario (nome, funcao, tipo, email, senha_hash)
    VALUES ('Teste', 'Vaqueiro', 'FUNCIONARIO', 'teste@example.com', 'minhasenha123');
    RAISE EXCEPTION 'FALHOU: RI-24 nao barrou';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK - RI-24: %', SQLERRM;
END $$;

-- Email repetido (mesmo com letras maiusculas)
DO $$ BEGIN
    INSERT INTO usuario (nome, funcao, tipo, email, senha_hash)
    SELECT 'Teste', 'Vaqueiro', 'FUNCIONARIO', 'ANA@EXAMPLE.COM', senha_hash FROM usuario WHERE email = 'ana@example.com';
    RAISE EXCEPTION 'FALHOU: email unico nao barrou';
EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'OK - Email unico: %', SQLERRM;
END $$;

-- RI-25: desativar o unico proprietario
DO $$ BEGIN
    UPDATE usuario SET ativo = FALSE WHERE tipo = 'PROPRIETARIO';
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'FALHOU: RI-25 nao barrou';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK - %', SQLERRM;
END $$;

-- RI-25: transformar o unico proprietario em funcionario
DO $$ BEGIN
    UPDATE usuario SET tipo = 'FUNCIONARIO' WHERE tipo = 'PROPRIETARIO';
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'FALHOU: RI-25 nao barrou';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK - %', SQLERRM;
END $$;

-- RI-26: Pedro saiu da fazenda (inativo) e nao pode registrar pesagem
DO $$ BEGIN
    INSERT INTO pesagem (brinco, data_pesagem, peso_kg, id_usuario)
    SELECT '0101', CURRENT_DATE, 560, id_usuario FROM usuario WHERE email = 'pedro@example.com';
    RAISE EXCEPTION 'FALHOU: RI-26 nao barrou';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK - %', SQLERRM;
END $$;

-- Exclusao bloqueada: usuario com manejos registrados (deve ser desativado)
DO $$ BEGIN
    DELETE FROM usuario WHERE email = 'ana@example.com';
    RAISE EXCEPTION 'FALHOU: exclusao de usuario com historico nao barrou';
EXCEPTION WHEN foreign_key_violation THEN RAISE NOTICE 'OK - Exclusao de usuario: %', SQLERRM;
END $$;

-- Desativacao permitida: o historico continua mostrando quem fez cada manejo
DO $$
DECLARE v_pes INTEGER;
BEGIN
    UPDATE usuario SET ativo = FALSE WHERE email = 'ana@example.com';
    SET CONSTRAINTS ALL IMMEDIATE;
    SELECT count(*) INTO v_pes FROM recebe r JOIN usuario u USING (id_usuario) WHERE u.email = 'ana@example.com';
    RAISE NOTICE 'OK - Ana desativada; suas % aplicacoes continuam no historico', v_pes;
    RAISE EXCEPTION USING ERRCODE = 'no_data_found';   -- desfaz o teste
EXCEPTION WHEN no_data_found THEN NULL;
END $$;
