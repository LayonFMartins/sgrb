-- SGRB - regras de negócio (funções e triggers)

-- Idade em meses completos (atributo derivado IDADE)
CREATE OR REPLACE FUNCTION fn_idade_meses(p_nascimento DATE, p_referencia DATE)
RETURNS INTEGER
LANGUAGE sql IMMUTABLE AS $$
    SELECT (EXTRACT(YEAR  FROM age(p_referencia, p_nascimento)) * 12
          + EXTRACT(MONTH FROM age(p_referencia, p_nascimento)))::INTEGER;
$$;

-- Categoria zootecnica (atributo derivado CATEGORIA)
CREATE OR REPLACE FUNCTION fn_categoria(p_sexo CHAR, p_idade_meses INTEGER)
RETURNS VARCHAR
LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE
        WHEN p_idade_meses < 12 THEN CASE p_sexo WHEN 'M' THEN 'Bezerro' ELSE 'Bezerra' END
        WHEN p_idade_meses < 24 THEN CASE p_sexo WHEN 'M' THEN 'Garrote' ELSE 'Novilha' END
        ELSE                         CASE p_sexo WHEN 'M' THEN 'Boi'     ELSE 'Vaca'    END
    END;
$$;

-- Valida a data de um manejo (pesagem, aplicacao, ocupacao)
CREATE OR REPLACE FUNCTION fn_valida_data_manejo(p_brinco VARCHAR, p_data DATE, p_manejo TEXT)
RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
    v_nascimento DATE;
    v_baixa      DATE;
BEGIN
    SELECT data_nascimento INTO v_nascimento FROM animal WHERE brinco = p_brinco;
    IF v_nascimento IS NULL THEN
        RETURN;
    END IF;

    IF p_data < v_nascimento THEN
        RAISE EXCEPTION 'RI-15/16: % do animal % em % é anterior ao nascimento (%).',
            p_manejo, p_brinco, to_char(p_data, 'DD/MM/YYYY'), to_char(v_nascimento, 'DD/MM/YYYY')
            USING ERRCODE = 'check_violation';
    END IF;

    SELECT data_baixa INTO v_baixa FROM baixa WHERE brinco = p_brinco;
    IF v_baixa IS NOT NULL AND p_data > v_baixa THEN
        RAISE EXCEPTION 'RI-22: o animal % teve baixa em %; não pode receber % em %.',
            p_brinco, to_char(v_baixa, 'DD/MM/YYYY'), p_manejo, to_char(p_data, 'DD/MM/YYYY')
            USING ERRCODE = 'check_violation';
    END IF;
END;
$$;

-- ANIMAL

-- RI-02: a mae deve ser femea e ter nascido antes da cria
CREATE OR REPLACE FUNCTION fn_animal_valida_mae()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_sexo       CHAR(1);
    v_nascimento DATE;
BEGIN
    -- Sem mae, ou mae = o proprio animal (o CHECK do RI-01 acusa)
    IF NEW.brinco_mae IS NULL OR NEW.brinco_mae = NEW.brinco THEN
        RETURN NEW;
    END IF;

    SELECT sexo, data_nascimento INTO v_sexo, v_nascimento
      FROM animal WHERE brinco = NEW.brinco_mae;

    IF NOT FOUND THEN
        RETURN NEW;
    END IF;
    IF v_sexo <> 'F' THEN
        RAISE EXCEPTION 'RI-02: o animal % não pode ser mãe, pois é macho.', NEW.brinco_mae
            USING ERRCODE = 'check_violation';
    END IF;
    IF v_nascimento >= NEW.data_nascimento THEN
        RAISE EXCEPTION 'RI-02: a mãe % precisa ter nascido antes da cria %.', NEW.brinco_mae, NEW.brinco
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_animal_valida_mae
    BEFORE INSERT OR UPDATE OF brinco_mae, data_nascimento ON animal
    FOR EACH ROW EXECUTE FUNCTION fn_animal_valida_mae();

-- Alteracao de sexo ou nascimento de um animal ja cadastrado
CREATE OR REPLACE FUNCTION fn_animal_valida_alteracao()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_primeiro DATE;
BEGIN
    IF NEW.sexo = 'M' AND OLD.sexo = 'F'
       AND EXISTS (SELECT 1 FROM animal WHERE brinco_mae = NEW.brinco) THEN
        RAISE EXCEPTION 'RI-02: o animal % é mãe de outros animais e não pode ter o sexo alterado para macho.', NEW.brinco
            USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.data_nascimento <> OLD.data_nascimento THEN
        IF EXISTS (SELECT 1 FROM animal WHERE brinco_mae = NEW.brinco
                                          AND data_nascimento <= NEW.data_nascimento) THEN
            RAISE EXCEPTION 'RI-02: o animal % precisa ter nascido antes das suas crias.', NEW.brinco
                USING ERRCODE = 'check_violation';
        END IF;

        SELECT min(d) INTO v_primeiro FROM (
            SELECT data_pesagem   AS d FROM pesagem WHERE brinco = NEW.brinco
            UNION ALL SELECT data_aplicacao FROM recebe WHERE brinco = NEW.brinco
            UNION ALL SELECT data_entrada   FROM ocupa  WHERE brinco = NEW.brinco
            UNION ALL SELECT data_baixa     FROM baixa  WHERE brinco = NEW.brinco
        ) manejos;

        IF v_primeiro < NEW.data_nascimento THEN
            RAISE EXCEPTION 'RI-15/16/17: o animal % tem registro em %, antes da nova data de nascimento.',
                NEW.brinco, to_char(v_primeiro, 'DD/MM/YYYY')
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_animal_valida_alteracao
    BEFORE UPDATE OF sexo, data_nascimento ON animal
    FOR EACH ROW EXECUTE FUNCTION fn_animal_valida_alteracao();

-- Exclusao: uma mae nao pode ser excluida enquanto tiver crias
CREATE OR REPLACE FUNCTION fn_animal_antes_excluir()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_crias INTEGER;
BEGIN
    SELECT count(*) INTO v_crias FROM animal WHERE brinco_mae = OLD.brinco;
    IF v_crias > 0 THEN
        RAISE EXCEPTION 'O animal % é mãe de % animal(is) cadastrado(s) e não pode ser excluído.', OLD.brinco, v_crias
            USING ERRCODE = 'foreign_key_violation';
    END IF;
    RETURN OLD;
END;
$$;

CREATE TRIGGER trg_animal_antes_excluir
    BEFORE DELETE ON animal
    FOR EACH ROW EXECUTE FUNCTION fn_animal_antes_excluir();

-- OCUPA: datas, lotacao (RI-09) e descanso do piquete (RI-10)
CREATE OR REPLACE FUNCTION fn_ocupa_valida_entrada()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_capacidade  INTEGER;
    v_descanso    INTEGER;
    v_nome        VARCHAR(30);
    v_ocupacao    INTEGER;
    v_ultima      DATE;
BEGIN
    PERFORM fn_valida_data_manejo(NEW.brinco, NEW.data_entrada, 'entrada em piquete');

    -- Trava o piquete para evitar duas entradas ao mesmo tempo
    SELECT capacidade_max, descanso_min_dias, nome
      INTO v_capacidade, v_descanso, v_nome
      FROM piquete WHERE id_piquete = NEW.id_piquete
       FOR UPDATE;

    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    -- Animais no piquete na data de entrada (sem contar a propria linha)
    SELECT count(*) INTO v_ocupacao
      FROM ocupa o
     WHERE o.id_piquete = NEW.id_piquete
       AND daterange(o.data_entrada, o.data_saida, '[)') @> NEW.data_entrada
       AND NOT (o.brinco = NEW.brinco AND o.data_entrada = NEW.data_entrada);

    -- RI-09: lotacao
    IF v_ocupacao >= v_capacidade THEN
        RAISE EXCEPTION 'RI-09: o piquete % está lotado (% de % cabeças).', v_nome, v_ocupacao, v_capacidade
            USING ERRCODE = 'check_violation';
    END IF;

    -- RI-10: piquete vazio esta em descanso ate ultima saida + descanso
    IF v_ocupacao = 0 THEN
        SELECT max(o.data_saida) INTO v_ultima
          FROM ocupa o
         WHERE o.id_piquete = NEW.id_piquete
           AND o.data_saida <= NEW.data_entrada
           AND NOT (o.brinco = NEW.brinco AND o.data_entrada = NEW.data_entrada);

        IF v_ultima IS NOT NULL AND NEW.data_entrada < v_ultima + v_descanso THEN
            RAISE EXCEPTION 'RI-10: o piquete % está em descanso até %.', v_nome,
                to_char(v_ultima + v_descanso, 'DD/MM/YYYY')
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ocupa_valida_entrada
    BEFORE INSERT OR UPDATE OF id_piquete, data_entrada ON ocupa
    FOR EACH ROW EXECUTE FUNCTION fn_ocupa_valida_entrada();

-- PESAGEM: RI-16 e RI-22
CREATE OR REPLACE FUNCTION fn_pesagem_valida()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    PERFORM fn_valida_data_manejo(NEW.brinco, NEW.data_pesagem, 'pesagem');
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pesagem_valida
    BEFORE INSERT OR UPDATE OF brinco, data_pesagem ON pesagem
    FOR EACH ROW EXECUTE FUNCTION fn_pesagem_valida();

-- RECEBE: RI-14 (restricao de sexo e idade), RI-15 e RI-22
CREATE OR REPLACE FUNCTION fn_recebe_valida()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_sexo        CHAR(1);
    v_nascimento  DATE;
    v_idade       INTEGER;
    p             produto_sanitario%ROWTYPE;
BEGIN
    PERFORM fn_valida_data_manejo(NEW.brinco, NEW.data_aplicacao, 'aplicacao sanitaria');

    SELECT sexo, data_nascimento INTO v_sexo, v_nascimento FROM animal WHERE brinco = NEW.brinco;
    SELECT * INTO p FROM produto_sanitario WHERE id_produto = NEW.id_produto;
    IF v_sexo IS NULL OR p.id_produto IS NULL THEN
        RETURN NEW;
    END IF;

    v_idade := fn_idade_meses(v_nascimento, NEW.data_aplicacao);

    IF p.sexo_alvo IS NOT NULL AND p.sexo_alvo <> v_sexo THEN
        RAISE EXCEPTION 'RI-14: o produto % é restrito a animais do sexo %; o animal % é do sexo %.',
            p.nome, p.sexo_alvo, NEW.brinco, v_sexo
            USING ERRCODE = 'check_violation';
    END IF;
    IF p.idade_min_meses IS NOT NULL AND v_idade < p.idade_min_meses THEN
        RAISE EXCEPTION 'RI-14: o produto % exige no mínimo % meses; o animal % tem % meses.',
            p.nome, p.idade_min_meses, NEW.brinco, v_idade
            USING ERRCODE = 'check_violation';
    END IF;
    IF p.idade_max_meses IS NOT NULL AND v_idade > p.idade_max_meses THEN
        RAISE EXCEPTION 'RI-14: o produto % permite no máximo % meses; o animal % tem % meses.',
            p.nome, p.idade_max_meses, NEW.brinco, v_idade
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_recebe_valida
    BEFORE INSERT OR UPDATE ON recebe
    FOR EACH ROW EXECUTE FUNCTION fn_recebe_valida();

-- GTA: RI-11 (diferida) - toda GTA acoberta pelo menos um animal
CREATE OR REPLACE FUNCTION fn_gta_exige_animal()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM transita_com WHERE numero_gta = NEW.numero_gta) THEN
        RAISE EXCEPTION 'RI-11: a GTA % precisa acobertar pelo menos um animal.', NEW.numero_gta
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_gta_exige_animal
    AFTER INSERT ON gta
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION fn_gta_exige_animal();

-- BAIXA

-- RI-17 e RI-22: baixa depois do nascimento e dos manejos ja registrados
CREATE OR REPLACE FUNCTION fn_baixa_valida()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_nascimento DATE;
    v_ultimo     DATE;
BEGIN
    SELECT data_nascimento INTO v_nascimento FROM animal WHERE brinco = NEW.brinco;
    IF NEW.data_baixa < v_nascimento THEN
        RAISE EXCEPTION 'RI-17: a baixa do animal % não pode ser anterior ao nascimento (%).',
            NEW.brinco, to_char(v_nascimento, 'DD/MM/YYYY')
            USING ERRCODE = 'check_violation';
    END IF;

    SELECT max(d) INTO v_ultimo FROM (
        SELECT data_pesagem   AS d FROM pesagem WHERE brinco = NEW.brinco
        UNION ALL
        SELECT data_aplicacao      FROM recebe  WHERE brinco = NEW.brinco
        UNION ALL
        SELECT data_entrada        FROM ocupa   WHERE brinco = NEW.brinco
    ) manejos;

    IF v_ultimo > NEW.data_baixa THEN
        RAISE EXCEPTION 'RI-22: o animal % tem manejo registrado em %, depois da data de baixa.',
            NEW.brinco, to_char(v_ultimo, 'DD/MM/YYYY')
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_baixa_valida
    BEFORE INSERT OR UPDATE OF brinco, data_baixa ON baixa
    FOR EACH ROW EXECUTE FUNCTION fn_baixa_valida();

-- RI-21: a baixa encerra a ocupacao atual do animal
CREATE OR REPLACE FUNCTION fn_baixa_encerra_ocupacao()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE ocupa
       SET data_saida = NEW.data_baixa
     WHERE brinco = NEW.brinco
       AND data_saida IS NULL;
    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_baixa_encerra_ocupacao
    AFTER INSERT ON baixa
    FOR EACH ROW EXECUTE FUNCTION fn_baixa_encerra_ocupacao();

-- RI-18 (diferida): toda baixa tem a linha da subclasse correspondente
CREATE OR REPLACE FUNCTION fn_baixa_exige_subclasse()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.motivo = 'VENDA' AND NOT EXISTS (SELECT 1 FROM venda WHERE id_baixa = NEW.id_baixa) THEN
        RAISE EXCEPTION 'RI-18: a baixa do animal % tem motivo venda, mas os dados da venda não foram informados.', NEW.brinco
            USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.motivo = 'OBITO' AND NOT EXISTS (SELECT 1 FROM obito WHERE id_baixa = NEW.id_baixa) THEN
        RAISE EXCEPTION 'RI-18: a baixa do animal % tem motivo óbito, mas a causa não foi informada.', NEW.brinco
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_baixa_exige_subclasse
    AFTER INSERT OR UPDATE OF motivo ON baixa
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION fn_baixa_exige_subclasse();

-- VENDA e OBITO

-- RI-18: a subclasse (VENDA/OBITO) precisa bater com o motivo da baixa
CREATE OR REPLACE FUNCTION fn_subclasse_confere_motivo()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_motivo   VARCHAR(5);
    v_esperado VARCHAR(5) := CASE TG_TABLE_NAME WHEN 'venda' THEN 'VENDA' ELSE 'OBITO' END;
BEGIN
    SELECT motivo INTO v_motivo FROM baixa WHERE id_baixa = NEW.id_baixa;
    IF v_motivo IS NOT NULL AND v_motivo <> v_esperado THEN
        RAISE EXCEPTION 'RI-18: a baixa % tem motivo %, então não pode ser registrada em %.',
            NEW.id_baixa, v_motivo, upper(TG_TABLE_NAME)
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_venda_confere_motivo
    BEFORE INSERT OR UPDATE OF id_baixa ON venda
    FOR EACH ROW EXECUTE FUNCTION fn_subclasse_confere_motivo();

CREATE TRIGGER trg_obito_confere_motivo
    BEFORE INSERT OR UPDATE OF id_baixa ON obito
    FOR EACH ROW EXECUTE FUNCTION fn_subclasse_confere_motivo();

-- RI-18: nao pode sobrar baixa sem VENDA ou OBITO
CREATE OR REPLACE FUNCTION fn_subclasse_removida()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_baixa baixa%ROWTYPE;
BEGIN
    SELECT * INTO v_baixa FROM baixa WHERE id_baixa = OLD.id_baixa;
    IF FOUND
       AND NOT EXISTS (SELECT 1 FROM venda WHERE id_baixa = OLD.id_baixa)
       AND NOT EXISTS (SELECT 1 FROM obito WHERE id_baixa = OLD.id_baixa) THEN
        RAISE EXCEPTION 'RI-18: a baixa do animal % ficaria sem os dados de %; exclua a baixa inteira.',
            v_baixa.brinco, lower(v_baixa.motivo)
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_venda_removida
    AFTER DELETE ON venda
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION fn_subclasse_removida();

CREATE CONSTRAINT TRIGGER trg_obito_removido
    AFTER DELETE ON obito
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION fn_subclasse_removida();

-- RASTREABILIDADE (diferida): RI-06, RI-20 e RI-19
CREATE OR REPLACE FUNCTION fn_verifica_rastreio(p_brinco VARCHAR)
RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
    v_comprado   BOOLEAN;
    v_data_venda DATE;
    v_saida      BOOLEAN;
    v_abate      BOOLEAN;
    v_liberacao  DATE;
BEGIN
    SELECT id_fornecedor IS NOT NULL INTO v_comprado FROM animal WHERE brinco = p_brinco;
    IF NOT FOUND THEN
        RETURN;
    END IF;

    SELECT bool_or(g.tipo = 'SAIDA'),
           bool_or(g.tipo = 'SAIDA' AND g.finalidade = 'ABATE')
      INTO v_saida, v_abate
      FROM transita_com t
      JOIN gta g ON g.numero_gta = t.numero_gta
     WHERE t.brinco = p_brinco;

    -- RI-06
    IF v_comprado AND NOT EXISTS (
        SELECT 1 FROM transita_com t JOIN gta g ON g.numero_gta = t.numero_gta
         WHERE t.brinco = p_brinco AND g.tipo = 'ENTRADA') THEN
        RAISE EXCEPTION 'RI-06: o animal % foi comprado e precisa estar vinculado a uma GTA de entrada.', p_brinco
            USING ERRCODE = 'check_violation';
    END IF;

    SELECT b.data_baixa INTO v_data_venda
      FROM baixa b JOIN venda v ON v.id_baixa = b.id_baixa
     WHERE b.brinco = p_brinco;
    IF v_data_venda IS NULL THEN
        RETURN;
    END IF;

    -- RI-20
    IF NOT COALESCE(v_saida, FALSE) THEN
        RAISE EXCEPTION 'RI-20: a venda do animal % exige uma GTA de saída.', p_brinco
            USING ERRCODE = 'check_violation';
    END IF;

    -- RI-19
    IF v_abate THEN
        SELECT max(r.data_aplicacao + p.carencia_dias) INTO v_liberacao
          FROM recebe r
          JOIN produto_sanitario p ON p.id_produto = r.id_produto
         WHERE r.brinco = p_brinco;

        IF v_liberacao > v_data_venda THEN
            RAISE EXCEPTION 'RI-19: o animal % está em carência até % e não pode ser vendido para abate em %.',
                p_brinco, to_char(v_liberacao, 'DD/MM/YYYY'), to_char(v_data_venda, 'DD/MM/YYYY')
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;
END;
$$;

-- Funcao de trigger: descobre o(s) animal(is) afetado(s) em cada tabela
CREATE OR REPLACE FUNCTION fn_trg_verifica_rastreio()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_brinco VARCHAR(20);
BEGIN
    IF TG_TABLE_NAME IN ('animal', 'recebe', 'baixa') THEN
        PERFORM fn_verifica_rastreio(NEW.brinco);
    ELSIF TG_TABLE_NAME = 'transita_com' THEN
        PERFORM fn_verifica_rastreio(OLD.brinco);
        IF TG_OP = 'UPDATE' THEN
            PERFORM fn_verifica_rastreio(NEW.brinco);
        END IF;
    ELSIF TG_TABLE_NAME = 'venda' THEN
        PERFORM fn_verifica_rastreio((SELECT brinco FROM baixa WHERE id_baixa = NEW.id_baixa));
    ELSIF TG_TABLE_NAME = 'gta' THEN
        FOR v_brinco IN SELECT brinco FROM transita_com WHERE numero_gta = NEW.numero_gta LOOP
            PERFORM fn_verifica_rastreio(v_brinco);
        END LOOP;
    END IF;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_animal_rastreio
    AFTER INSERT OR UPDATE OF id_fornecedor ON animal
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION fn_trg_verifica_rastreio();

CREATE CONSTRAINT TRIGGER trg_transita_rastreio
    AFTER DELETE OR UPDATE ON transita_com
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION fn_trg_verifica_rastreio();

CREATE CONSTRAINT TRIGGER trg_gta_rastreio
    AFTER UPDATE OF tipo, finalidade ON gta
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION fn_trg_verifica_rastreio();

CREATE CONSTRAINT TRIGGER trg_venda_rastreio
    AFTER INSERT OR UPDATE ON venda
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION fn_trg_verifica_rastreio();

CREATE CONSTRAINT TRIGGER trg_baixa_rastreio
    AFTER UPDATE OF data_baixa ON baixa
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION fn_trg_verifica_rastreio();

CREATE CONSTRAINT TRIGGER trg_recebe_rastreio
    AFTER INSERT OR UPDATE ON recebe
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION fn_trg_verifica_rastreio();

-- RI-11: GTA que fica sem nenhum animal e removida
CREATE OR REPLACE FUNCTION fn_gta_remove_orfa()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM gta g
     WHERE g.numero_gta = OLD.numero_gta
       AND NOT EXISTS (SELECT 1 FROM transita_com t WHERE t.numero_gta = g.numero_gta);
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_gta_remove_orfa
    AFTER DELETE OR UPDATE ON transita_com
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION fn_gta_remove_orfa();

-- EDICOES QUE AFETAM REGISTROS JA FEITOS

-- RI-22: nao reabrir ocupacao de animal que ja teve baixa
CREATE OR REPLACE FUNCTION fn_ocupa_valida_saida()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_baixa DATE;
BEGIN
    SELECT data_baixa INTO v_baixa FROM baixa WHERE brinco = NEW.brinco;
    IF v_baixa IS NOT NULL AND (NEW.data_saida IS NULL OR NEW.data_saida > v_baixa) THEN
        RAISE EXCEPTION 'RI-22: o animal % teve baixa em %; a saída do piquete não pode ficar em aberto nem depois dessa data.',
            NEW.brinco, to_char(v_baixa, 'DD/MM/YYYY')
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ocupa_valida_saida
    BEFORE UPDATE OF data_saida ON ocupa
    FOR EACH ROW EXECUTE FUNCTION fn_ocupa_valida_saida();

-- RI-09: a capacidade nao pode ficar abaixo da lotacao atual
CREATE OR REPLACE FUNCTION fn_piquete_valida_capacidade()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_ocupacao INTEGER;
BEGIN
    SELECT count(*) INTO v_ocupacao
      FROM ocupa WHERE id_piquete = NEW.id_piquete AND data_saida IS NULL;
    IF v_ocupacao > NEW.capacidade_max THEN
        RAISE EXCEPTION 'RI-09: o piquete % tem % animais; a capacidade não pode ser reduzida para %.',
            NEW.nome, v_ocupacao, NEW.capacidade_max
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_piquete_valida_capacidade
    BEFORE UPDATE OF capacidade_max ON piquete
    FOR EACH ROW EXECUTE FUNCTION fn_piquete_valida_capacidade();

-- RI-14: mudar a restricao nao pode invalidar aplicacoes antigas
CREATE OR REPLACE FUNCTION fn_produto_valida_restricao()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_brinco VARCHAR(20);
BEGIN
    SELECT r.brinco INTO v_brinco
      FROM recebe r
      JOIN animal a ON a.brinco = r.brinco
     WHERE r.id_produto = NEW.id_produto
       AND (   (NEW.sexo_alvo IS NOT NULL AND a.sexo <> NEW.sexo_alvo)
            OR fn_idade_meses(a.data_nascimento, r.data_aplicacao) < COALESCE(NEW.idade_min_meses, 0)
            OR fn_idade_meses(a.data_nascimento, r.data_aplicacao) > COALESCE(NEW.idade_max_meses, 9999))
     LIMIT 1;

    IF v_brinco IS NOT NULL THEN
        RAISE EXCEPTION 'RI-14: a nova restrição de % invalida a aplicação já registrada no animal %.',
            NEW.nome, v_brinco
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_produto_valida_restricao
    BEFORE UPDATE OF sexo_alvo, idade_min_meses, idade_max_meses ON produto_sanitario
    FOR EACH ROW EXECUTE FUNCTION fn_produto_valida_restricao();

-- RI-19 (diferida): aumentar a carencia nao pode invalidar vendas para abate
CREATE OR REPLACE FUNCTION fn_produto_valida_carencia()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_brinco VARCHAR(20);
BEGIN
    FOR v_brinco IN SELECT DISTINCT brinco FROM recebe WHERE id_produto = NEW.id_produto LOOP
        PERFORM fn_verifica_rastreio(v_brinco);
    END LOOP;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_produto_valida_carencia
    AFTER UPDATE OF carencia_dias ON produto_sanitario
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION fn_produto_valida_carencia();

-- USUARIO
-- RI-25 (diferida): sempre pelo menos um proprietario ativo
CREATE OR REPLACE FUNCTION fn_usuario_exige_proprietario()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM usuario WHERE tipo = 'PROPRIETARIO' AND ativo) THEN
        RAISE EXCEPTION 'RI-25: o sistema precisa ter pelo menos um proprietário ativo.'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_usuario_exige_proprietario
    AFTER INSERT OR UPDATE OF tipo, ativo OR DELETE ON usuario
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION fn_usuario_exige_proprietario();

-- RI-26: usuario inativo nao pode ser responsavel por novos manejos
CREATE OR REPLACE FUNCTION fn_manejo_exige_usuario_ativo()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_nome  VARCHAR(100);
    v_ativo BOOLEAN;
BEGIN
    SELECT nome, ativo INTO v_nome, v_ativo FROM usuario WHERE id_usuario = NEW.id_usuario;
    IF v_ativo = FALSE THEN
        RAISE EXCEPTION 'RI-26: o usuário % está inativo e não pode ser responsavel por novos manejos.', v_nome
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pesagem_usuario_ativo
    BEFORE INSERT OR UPDATE OF id_usuario ON pesagem
    FOR EACH ROW EXECUTE FUNCTION fn_manejo_exige_usuario_ativo();

CREATE TRIGGER trg_recebe_usuario_ativo
    BEFORE INSERT OR UPDATE OF id_usuario ON recebe
    FOR EACH ROW EXECUTE FUNCTION fn_manejo_exige_usuario_ativo();
