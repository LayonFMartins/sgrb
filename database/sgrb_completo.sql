-- SGRB - criação das tabelas (PostgreSQL)

DROP TABLE IF EXISTS
    obito, venda, baixa, recebe, produto_sanitario, pesagem, funcionario, usuario,
    transita_com, gta, ocupa, piquete, animal, telefone_fornecedor,
    fornecedor, raca
CASCADE;

-- Necessaria para a restricao EXCLUDE de OCUPA (RI-08)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- RACA
CREATE TABLE raca (
    id_raca  INTEGER     GENERATED ALWAYS AS IDENTITY,
    nome     VARCHAR(50) NOT NULL,

    CONSTRAINT pk_raca      PRIMARY KEY (id_raca),
    CONSTRAINT uk_raca_nome UNIQUE (nome)
);

-- FORNECEDOR e TELEFONE_FORNECEDOR (atributo multivalorado)
CREATE TABLE fornecedor (
    id_fornecedor     INTEGER      GENERATED ALWAYS AS IDENTITY,
    nome_produtor     VARCHAR(100) NOT NULL,
    nome_propriedade  VARCHAR(100) NOT NULL,
    municipio         VARCHAR(60)  NOT NULL,
    uf                CHAR(2)      NOT NULL,

    CONSTRAINT pk_fornecedor PRIMARY KEY (id_fornecedor),
    CONSTRAINT ck_fornecedor_uf CHECK (uf IN (
        'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
        'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'))
);

CREATE TABLE telefone_fornecedor (
    id_fornecedor  INTEGER     NOT NULL,
    telefone       VARCHAR(20) NOT NULL,

    CONSTRAINT pk_telefone_fornecedor PRIMARY KEY (id_fornecedor, telefone),
    CONSTRAINT fk_telefone_fornecedor FOREIGN KEY (id_fornecedor)
        REFERENCES fornecedor (id_fornecedor) ON DELETE CASCADE
);

-- ANIMAL
CREATE TABLE animal (
    brinco           VARCHAR(20)   NOT NULL,
    sexo             CHAR(1)       NOT NULL,
    data_nascimento  DATE          NOT NULL,
    id_raca          INTEGER       NOT NULL,
    brinco_mae       VARCHAR(20),
    id_fornecedor    INTEGER,
    data_compra      DATE,
    valor_compra     NUMERIC(10,2),

    CONSTRAINT pk_animal PRIMARY KEY (brinco),
    CONSTRAINT fk_animal_raca FOREIGN KEY (id_raca)
        REFERENCES raca (id_raca),
    CONSTRAINT fk_animal_mae FOREIGN KEY (brinco_mae)
        REFERENCES animal (brinco) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_animal_fornecedor FOREIGN KEY (id_fornecedor)
        REFERENCES fornecedor (id_fornecedor),

    CONSTRAINT ck_animal_sexo  CHECK (sexo IN ('M', 'F')),
    CONSTRAINT ck_animal_valor CHECK (valor_compra > 0),
    -- RI-01: um animal nao e mae de si mesmo
    CONSTRAINT ck_animal_mae_propria CHECK (brinco_mae <> brinco),
    -- RI-04: dados da compra preenchidos juntos ou todos nulos
    CONSTRAINT ck_animal_compra_completa CHECK (
        (id_fornecedor IS NULL AND data_compra IS NULL AND valor_compra IS NULL)
     OR (id_fornecedor IS NOT NULL AND data_compra IS NOT NULL AND valor_compra IS NOT NULL)),
    -- RI-05: compra nao pode ser anterior ao nascimento
    CONSTRAINT ck_animal_data_compra CHECK (data_compra >= data_nascimento)
);

-- PIQUETE e OCUPA (relacionamento N:M com historico)
CREATE TABLE piquete (
    id_piquete         INTEGER      GENERATED ALWAYS AS IDENTITY,
    nome               VARCHAR(30)  NOT NULL,
    area_ha            NUMERIC(8,2) NOT NULL,
    capacidade_max     INTEGER      NOT NULL,
    descanso_min_dias  INTEGER      NOT NULL,

    CONSTRAINT pk_piquete PRIMARY KEY (id_piquete),
    CONSTRAINT uk_piquete_nome UNIQUE (nome),
    CONSTRAINT ck_piquete_area       CHECK (area_ha > 0),
    CONSTRAINT ck_piquete_capacidade CHECK (capacidade_max > 0),
    CONSTRAINT ck_piquete_descanso   CHECK (descanso_min_dias >= 0)
);

CREATE TABLE ocupa (
    brinco        VARCHAR(20) NOT NULL,
    data_entrada  DATE        NOT NULL,
    id_piquete    INTEGER     NOT NULL,
    data_saida    DATE,

    CONSTRAINT pk_ocupa PRIMARY KEY (brinco, data_entrada),
    CONSTRAINT fk_ocupa_animal  FOREIGN KEY (brinco)
        REFERENCES animal (brinco) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_ocupa_piquete FOREIGN KEY (id_piquete)
        REFERENCES piquete (id_piquete),
    -- RI-07: saida nula (ainda no piquete) ou posterior a entrada
    CONSTRAINT ck_ocupa_datas CHECK (data_saida IS NULL OR data_saida >= data_entrada),
    -- RI-08: um piquete por vez (periodos do mesmo animal nao se sobrepoem)
    CONSTRAINT ex_ocupa_um_piquete_por_vez EXCLUDE USING gist (
        brinco WITH =,
        daterange(data_entrada, data_saida, '[)') WITH &&)
);

CREATE INDEX ix_ocupa_piquete ON ocupa (id_piquete);

-- GTA e TRANSITA_COM (relacionamento N:M)
CREATE TABLE gta (
    numero_gta    VARCHAR(20)  NOT NULL,
    tipo          VARCHAR(7)   NOT NULL,
    data_emissao  DATE         NOT NULL,
    origem        VARCHAR(100) NOT NULL,
    destino       VARCHAR(100) NOT NULL,
    finalidade    VARCHAR(7)   NOT NULL,

    CONSTRAINT pk_gta PRIMARY KEY (numero_gta),
    CONSTRAINT ck_gta_tipo       CHECK (tipo IN ('ENTRADA', 'SAIDA')),
    CONSTRAINT ck_gta_finalidade CHECK (finalidade IN ('CRIA', 'RECRIA', 'ENGORDA', 'ABATE'))
);

CREATE TABLE transita_com (
    brinco      VARCHAR(20) NOT NULL,
    numero_gta  VARCHAR(20) NOT NULL,

    CONSTRAINT pk_transita_com PRIMARY KEY (brinco, numero_gta),
    CONSTRAINT fk_transita_animal FOREIGN KEY (brinco)
        REFERENCES animal (brinco) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_transita_gta    FOREIGN KEY (numero_gta)
        REFERENCES gta (numero_gta) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX ix_transita_gta ON transita_com (numero_gta);

-- USUARIO e PESAGEM (entidade fraca; REALIZA -> id_usuario)
CREATE TABLE usuario (
    id_usuario  INTEGER      GENERATED ALWAYS AS IDENTITY,
    nome        VARCHAR(100) NOT NULL,
    funcao      VARCHAR(50)  NOT NULL,
    tipo        VARCHAR(12)  NOT NULL,
    email       VARCHAR(120),
    senha_hash  CHAR(60),
    ativo       BOOLEAN      NOT NULL DEFAULT TRUE,

    CONSTRAINT pk_usuario PRIMARY KEY (id_usuario),
    CONSTRAINT ck_usuario_tipo  CHECK (tipo IN ('PROPRIETARIO', 'FUNCIONARIO')),
    CONSTRAINT ck_usuario_email CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
    -- RI-23: email e senha preenchidos juntos ou ambos nulos
    CONSTRAINT ck_usuario_login CHECK ((email IS NULL) = (senha_hash IS NULL)),
    -- RI-24: so o hash bcrypt da senha, nunca a senha em texto
    CONSTRAINT ck_usuario_senha_hash CHECK (senha_hash ~ '^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$')
);

-- email unico, sem diferenciar maiusculas de minusculas
CREATE UNIQUE INDEX uk_usuario_email ON usuario (lower(email));

CREATE TABLE pesagem (
    brinco          VARCHAR(20)  NOT NULL,
    data_pesagem    DATE         NOT NULL,
    peso_kg         NUMERIC(7,2) NOT NULL,
    id_usuario      INTEGER      NOT NULL,

    CONSTRAINT pk_pesagem PRIMARY KEY (brinco, data_pesagem),
    CONSTRAINT fk_pesagem_animal      FOREIGN KEY (brinco)
        REFERENCES animal (brinco) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_pesagem_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuario (id_usuario),
    CONSTRAINT ck_pesagem_peso CHECK (peso_kg > 0)
);

-- PRODUTO_SANITARIO (RESTRICAO composto -> sexo_alvo, idade_min/max)
CREATE TABLE produto_sanitario (
    id_produto              INTEGER     GENERATED ALWAYS AS IDENTITY,
    nome                    VARCHAR(80) NOT NULL,
    tipo                    VARCHAR(11) NOT NULL,
    doenca_alvo             VARCHAR(80) NOT NULL,
    carencia_dias           INTEGER     NOT NULL,
    num_doses               INTEGER     NOT NULL,
    intervalo_reforco_dias  INTEGER,
    sexo_alvo               CHAR(1),
    idade_min_meses         INTEGER,
    idade_max_meses         INTEGER,

    CONSTRAINT pk_produto_sanitario PRIMARY KEY (id_produto),
    CONSTRAINT uk_produto_nome UNIQUE (nome),
    CONSTRAINT ck_produto_tipo      CHECK (tipo IN ('VACINA', 'VERMIFUGO', 'ANTIBIOTICO')),
    CONSTRAINT ck_produto_carencia  CHECK (carencia_dias >= 0),
    CONSTRAINT ck_produto_doses     CHECK (num_doses >= 1),
    CONSTRAINT ck_produto_intervalo CHECK (intervalo_reforco_dias > 0),
    CONSTRAINT ck_produto_sexo      CHECK (sexo_alvo IN ('M', 'F')),
    CONSTRAINT ck_produto_idade_min CHECK (idade_min_meses >= 0),
    CONSTRAINT ck_produto_idade_max CHECK (idade_max_meses >= 0),
    -- RI-12: faixa etaria coerente
    CONSTRAINT ck_produto_faixa CHECK (idade_max_meses >= idade_min_meses)
);

-- RECEBE (relacionamento ternario ANIMAL x PRODUTO x USUARIO)
CREATE TABLE recebe (
    brinco            VARCHAR(20) NOT NULL,
    id_produto        INTEGER     NOT NULL,
    data_aplicacao    DATE        NOT NULL,
    id_usuario        INTEGER     NOT NULL,
    num_dose          INTEGER     NOT NULL,
    lote_medicamento  VARCHAR(30) NOT NULL,

    CONSTRAINT pk_recebe PRIMARY KEY (brinco, id_produto, data_aplicacao),
    CONSTRAINT fk_recebe_animal      FOREIGN KEY (brinco)
        REFERENCES animal (brinco) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_recebe_produto     FOREIGN KEY (id_produto)
        REFERENCES produto_sanitario (id_produto),
    CONSTRAINT fk_recebe_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuario (id_usuario),
    CONSTRAINT ck_recebe_dose CHECK (num_dose >= 1)
);

-- BAIXA (superclasse) e VENDA / OBITO (subclasses)
CREATE TABLE baixa (
    id_baixa    INTEGER     GENERATED ALWAYS AS IDENTITY,
    brinco      VARCHAR(20) NOT NULL,
    data_baixa  DATE        NOT NULL,
    motivo      VARCHAR(5)  NOT NULL,

    CONSTRAINT pk_baixa PRIMARY KEY (id_baixa),
    CONSTRAINT uk_baixa_animal UNIQUE (brinco),
    CONSTRAINT fk_baixa_animal FOREIGN KEY (brinco)
        REFERENCES animal (brinco) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT ck_baixa_motivo CHECK (motivo IN ('VENDA', 'OBITO'))
);

CREATE TABLE venda (
    id_baixa       INTEGER       NOT NULL,
    comprador      VARCHAR(100)  NOT NULL,
    peso_final_kg  NUMERIC(7,2)  NOT NULL,
    valor_venda    NUMERIC(10,2) NOT NULL,

    CONSTRAINT pk_venda PRIMARY KEY (id_baixa),
    CONSTRAINT fk_venda_baixa FOREIGN KEY (id_baixa)
        REFERENCES baixa (id_baixa) ON DELETE CASCADE,
    CONSTRAINT ck_venda_peso  CHECK (peso_final_kg > 0),
    CONSTRAINT ck_venda_valor CHECK (valor_venda > 0)
);

CREATE TABLE obito (
    id_baixa  INTEGER      NOT NULL,
    causa     VARCHAR(200) NOT NULL,

    CONSTRAINT pk_obito PRIMARY KEY (id_baixa),
    CONSTRAINT fk_obito_baixa FOREIGN KEY (id_baixa)
        REFERENCES baixa (id_baixa) ON DELETE CASCADE
);

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
        RAISE EXCEPTION 'RI-15/16: % do animal % em % e anterior ao nascimento (%).',
            p_manejo, p_brinco, to_char(p_data, 'DD/MM/YYYY'), to_char(v_nascimento, 'DD/MM/YYYY')
            USING ERRCODE = 'check_violation';
    END IF;

    SELECT data_baixa INTO v_baixa FROM baixa WHERE brinco = p_brinco;
    IF v_baixa IS NOT NULL AND p_data > v_baixa THEN
        RAISE EXCEPTION 'RI-22: o animal % teve baixa em %; nao pode receber % em %.',
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
        RAISE EXCEPTION 'RI-02: o animal % nao pode ser mae, pois e macho.', NEW.brinco_mae
            USING ERRCODE = 'check_violation';
    END IF;
    IF v_nascimento >= NEW.data_nascimento THEN
        RAISE EXCEPTION 'RI-02: a mae % precisa ter nascido antes da cria %.', NEW.brinco_mae, NEW.brinco
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
        RAISE EXCEPTION 'RI-02: o animal % e mae de outros animais e nao pode ter o sexo alterado para macho.', NEW.brinco
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
        RAISE EXCEPTION 'O animal % e mae de % animal(is) cadastrado(s) e nao pode ser excluido.', OLD.brinco, v_crias
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
        RAISE EXCEPTION 'RI-09: o piquete % esta lotado (% de % cabecas).', v_nome, v_ocupacao, v_capacidade
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
            RAISE EXCEPTION 'RI-10: o piquete % esta em descanso ate %.', v_nome,
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
        RAISE EXCEPTION 'RI-14: o produto % e restrito a animais do sexo %; o animal % e do sexo %.',
            p.nome, p.sexo_alvo, NEW.brinco, v_sexo
            USING ERRCODE = 'check_violation';
    END IF;
    IF p.idade_min_meses IS NOT NULL AND v_idade < p.idade_min_meses THEN
        RAISE EXCEPTION 'RI-14: o produto % exige no minimo % meses; o animal % tem % meses.',
            p.nome, p.idade_min_meses, NEW.brinco, v_idade
            USING ERRCODE = 'check_violation';
    END IF;
    IF p.idade_max_meses IS NOT NULL AND v_idade > p.idade_max_meses THEN
        RAISE EXCEPTION 'RI-14: o produto % permite no maximo % meses; o animal % tem % meses.',
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
        RAISE EXCEPTION 'RI-17: a baixa do animal % nao pode ser anterior ao nascimento (%).',
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
        RAISE EXCEPTION 'RI-18: a baixa do animal % tem motivo VENDA, mas os dados da venda nao foram informados.', NEW.brinco
            USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.motivo = 'OBITO' AND NOT EXISTS (SELECT 1 FROM obito WHERE id_baixa = NEW.id_baixa) THEN
        RAISE EXCEPTION 'RI-18: a baixa do animal % tem motivo OBITO, mas a causa nao foi informada.', NEW.brinco
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
        RAISE EXCEPTION 'RI-18: a baixa % tem motivo %, entao nao pode ser registrada em %.',
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
        RAISE EXCEPTION 'RI-20: a venda do animal % exige uma GTA de saida.', p_brinco
            USING ERRCODE = 'check_violation';
    END IF;

    -- RI-19
    IF v_abate THEN
        SELECT max(r.data_aplicacao + p.carencia_dias) INTO v_liberacao
          FROM recebe r
          JOIN produto_sanitario p ON p.id_produto = r.id_produto
         WHERE r.brinco = p_brinco;

        IF v_liberacao > v_data_venda THEN
            RAISE EXCEPTION 'RI-19: o animal % esta em carencia ate % e nao pode ser vendido para abate em %.',
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
        RAISE EXCEPTION 'RI-22: o animal % teve baixa em %; a saida do piquete nao pode ficar em aberto nem depois dessa data.',
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
        RAISE EXCEPTION 'RI-09: o piquete % tem % animais; a capacidade nao pode ser reduzida para %.',
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
        RAISE EXCEPTION 'RI-14: a nova restricao de % invalida a aplicacao ja registrada no animal %.',
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
        RAISE EXCEPTION 'RI-25: o sistema precisa ter pelo menos um proprietario ativo.'
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
        RAISE EXCEPTION 'RI-26: o usuario % esta inativo e nao pode ser responsavel por novos manejos.', v_nome
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

-- SGRB - dados de exemplo (fictícios)

BEGIN;

INSERT INTO raca (nome) VALUES
    ('Nelore'),
    ('Angus'),
    ('Brangus'),
    ('Senepol'),
    ('Guzerá');

INSERT INTO fornecedor (nome_produtor, nome_propriedade, municipio, uf) VALUES
    ('José Antônio Ribeiro', 'Fazenda Santa Luzia', 'Uberaba', 'MG'),
    ('Maria das Graças Teixeira', 'Fazenda Boa Vista', 'Rio Verde', 'GO'),
    ('Carlos Henrique Prado', 'Agropecuária Três Irmãos', 'Cáceres', 'MT');

INSERT INTO telefone_fornecedor (id_fornecedor, telefone) VALUES
    (1, '(34) 99812-4410'),
    (1, '(34) 3332-1875'),
    (2, '(64) 99645-2208'),
    (3, '(65) 99231-7764');

INSERT INTO usuario (nome, funcao, tipo, email, senha_hash) VALUES
    ('João Batista Souza', 'Vaqueiro', 'FUNCIONARIO', NULL, NULL),
    ('Pedro Henrique Lima', 'Capataz', 'FUNCIONARIO', 'pedro@example.com', '$2a$10$e2xpjDH5qUDgO3tDmhVJmeMkJulEvKGfVvBKNOSgJPvZszz.o4Li6'),
    ('Ana Paula Ferreira', 'Médica Veterinária', 'FUNCIONARIO', 'ana@example.com', '$2a$10$6XDxpDEnjkTZNLlZ5zwaFONYO1OKRlr7EUN5FKXr9mDGkTN/lvG6.'),
    ('Marcos Vinícius Rocha', 'Vaqueiro', 'FUNCIONARIO', NULL, NULL),
    ('Carlos Eduardo Mendes', 'Proprietário', 'PROPRIETARIO', 'proprietario@example.com', '$2a$10$kbU0UgN/cH8Y09dhoF6zUuiBE6B7neLnSbkKlJ7ulFA/47IiezAEC');

INSERT INTO piquete (nome, area_ha, capacidade_max, descanso_min_dias) VALUES
    ('P01 - Baixada', 14.5, 25, 28),
    ('P02 - Cerrado', 18.0, 30, 30),
    ('P03 - Represa', 9.8, 18, 25),
    ('P04 - Maternidade', 6.2, 12, 21),
    ('P05 - Engorda', 21.0, 40, 35),
    ('P06 - Quarentena', 2.5, 8, 15);

INSERT INTO produto_sanitario (nome, tipo, doenca_alvo, carencia_dias, num_doses, intervalo_reforco_dias, sexo_alvo, idade_min_meses, idade_max_meses) VALUES
    ('Vacina Brucelose B19', 'VACINA', 'Brucelose', 0, 1, NULL, 'F', 3, 8),
    ('Vacina Antirrábica', 'VACINA', 'Raiva', 0, 1, 365, NULL, NULL, NULL),
    ('Vacina Clostridioses Polivalente', 'VACINA', 'Clostridioses', 21, 2, 30, NULL, NULL, NULL),
    ('Ivermectina 1%', 'VERMIFUGO', 'Verminoses e ectoparasitas', 35, 1, 120, NULL, NULL, NULL),
    ('Oxitetraciclina LA', 'ANTIBIOTICO', 'Tristeza parasitária e pneumonia', 28, 1, NULL, NULL, NULL, NULL),
    ('Ivermectina 3,15% Longa Ação', 'VERMIFUGO', 'Verminoses e ectoparasitas', 122, 1, 180, NULL, NULL, NULL);

INSERT INTO animal (brinco, sexo, data_nascimento, id_raca, brinco_mae, id_fornecedor, data_compra, valor_compra) VALUES
    ('0001', 'F', '2019-10-05', 1, NULL, NULL, NULL, NULL),
    ('0002', 'F', '2020-03-14', 1, NULL, NULL, NULL, NULL),
    ('0003', 'F', '2021-02-11', 5, NULL, NULL, NULL, NULL);

INSERT INTO ocupa (brinco, data_entrada, id_piquete, data_saida) VALUES
    ('0001', '2025-01-06', 1, '2025-03-10'),
    ('0002', '2025-01-06', 1, '2025-03-10'),
    ('0003', '2025-01-06', 1, '2025-03-10');

INSERT INTO recebe (brinco, id_produto, data_aplicacao, id_usuario, num_dose, lote_medicamento) VALUES
    ('0001', 2, '2025-02-10', 3, 1, 'RAB-24-1187'),
    ('0002', 2, '2025-02-10', 3, 1, 'RAB-24-1187'),
    ('0003', 2, '2025-02-10', 3, 1, 'RAB-24-1187');

INSERT INTO ocupa (brinco, data_entrada, id_piquete, data_saida) VALUES
    ('0001', '2025-03-10', 2, '2025-06-01'),
    ('0002', '2025-03-10', 2, '2025-06-01'),
    ('0003', '2025-03-10', 2, '2025-06-01');

INSERT INTO animal (brinco, sexo, data_nascimento, id_raca, brinco_mae, id_fornecedor, data_compra, valor_compra) VALUES
    ('0101', 'M', '2024-03-02', 1, NULL, 1, '2025-03-15', 2850),
    ('0103', 'M', '2024-04-05', 2, NULL, 1, '2025-03-15', 3150);

INSERT INTO gta (numero_gta, tipo, data_emissao, origem, destino, finalidade) VALUES
    ('MG-25-0004517', 'ENTRADA', '2025-03-14', 'Fazenda Santa Luzia - Uberaba/MG', 'Fazenda São Bento - Itabira/MG', 'RECRIA');

INSERT INTO transita_com (brinco, numero_gta) VALUES
    ('0101', 'MG-25-0004517'),
    ('0103', 'MG-25-0004517');

INSERT INTO ocupa (brinco, data_entrada, id_piquete, data_saida) VALUES
    ('0101', '2025-03-15', 6, '2025-04-14'),
    ('0103', '2025-03-15', 6, '2025-04-14');

INSERT INTO pesagem (brinco, data_pesagem, peso_kg, id_usuario) VALUES
    ('0101', '2025-03-15', 262.0, 1),
    ('0103', '2025-03-15', 274.0, 1);

INSERT INTO recebe (brinco, id_produto, data_aplicacao, id_usuario, num_dose, lote_medicamento) VALUES
    ('0101', 4, '2025-03-15', 1, 1, 'IVM-24-5521'),
    ('0103', 4, '2025-03-15', 1, 1, 'IVM-24-5521');

INSERT INTO recebe (brinco, id_produto, data_aplicacao, id_usuario, num_dose, lote_medicamento) VALUES
    ('0101', 2, '2025-03-20', 3, 1, 'RAB-24-1187'),
    ('0103', 2, '2025-03-20', 3, 1, 'RAB-24-1187');

INSERT INTO ocupa (brinco, data_entrada, id_piquete, data_saida) VALUES
    ('0101', '2025-04-14', 3, '2025-11-01'),
    ('0103', '2025-04-14', 3, '2025-11-01');

INSERT INTO ocupa (brinco, data_entrada, id_piquete, data_saida) VALUES
    ('0001', '2025-06-01', 1, NULL),
    ('0002', '2025-06-01', 1, NULL),
    ('0003', '2025-06-01', 1, NULL);

INSERT INTO pesagem (brinco, data_pesagem, peso_kg, id_usuario) VALUES
    ('0001', '2025-06-01', 468.0, 1),
    ('0002', '2025-06-01', 472.0, 1),
    ('0003', '2025-06-01', 498.0, 1);

INSERT INTO recebe (brinco, id_produto, data_aplicacao, id_usuario, num_dose, lote_medicamento) VALUES
    ('0001', 4, '2025-06-01', 4, 1, 'IVM-24-5521'),
    ('0002', 4, '2025-06-01', 4, 1, 'IVM-24-5521'),
    ('0003', 4, '2025-06-01', 4, 1, 'IVM-24-5521');

INSERT INTO pesagem (brinco, data_pesagem, peso_kg, id_usuario) VALUES
    ('0101', '2025-07-15', 322.0, 4),
    ('0103', '2025-07-15', 346.5, 4);

INSERT INTO animal (brinco, sexo, data_nascimento, id_raca, brinco_mae, id_fornecedor, data_compra, valor_compra) VALUES
    ('0107', 'M', '2023-10-10', 3, NULL, 2, '2025-08-20', 4120),
    ('0110', 'M', '2024-02-08', 4, NULL, 2, '2025-08-20', 3820);

INSERT INTO gta (numero_gta, tipo, data_emissao, origem, destino, finalidade) VALUES
    ('GO-25-0102233', 'ENTRADA', '2025-08-19', 'Fazenda Boa Vista - Rio Verde/GO', 'Fazenda São Bento - Itabira/MG', 'ENGORDA');

INSERT INTO transita_com (brinco, numero_gta) VALUES
    ('0107', 'GO-25-0102233'),
    ('0110', 'GO-25-0102233');

INSERT INTO ocupa (brinco, data_entrada, id_piquete, data_saida) VALUES
    ('0107', '2025-08-20', 6, '2025-09-19'),
    ('0110', '2025-08-20', 6, '2025-09-19');

INSERT INTO pesagem (brinco, data_pesagem, peso_kg, id_usuario) VALUES
    ('0107', '2025-08-20', 388.0, 1),
    ('0110', '2025-08-20', 366.0, 1);

INSERT INTO recebe (brinco, id_produto, data_aplicacao, id_usuario, num_dose, lote_medicamento) VALUES
    ('0107', 4, '2025-08-20', 1, 1, 'IVM-25-0815'),
    ('0110', 6, '2025-08-20', 3, 1, 'ILA-25-0302');

INSERT INTO recebe (brinco, id_produto, data_aplicacao, id_usuario, num_dose, lote_medicamento) VALUES
    ('0107', 2, '2025-08-25', 3, 1, 'RAB-25-0410'),
    ('0110', 2, '2025-08-25', 3, 1, 'RAB-25-0410');

INSERT INTO animal (brinco, sexo, data_nascimento, id_raca, brinco_mae, id_fornecedor, data_compra, valor_compra) VALUES
    ('0201', 'F', '2025-09-12', 1, '0001', NULL, NULL, NULL);

INSERT INTO ocupa (brinco, data_entrada, id_piquete, data_saida) VALUES
    ('0201', '2025-09-12', 1, '2026-05-12');

INSERT INTO pesagem (brinco, data_pesagem, peso_kg, id_usuario) VALUES
    ('0201', '2025-09-12', 33.0, 1);

INSERT INTO ocupa (brinco, data_entrada, id_piquete, data_saida) VALUES
    ('0107', '2025-09-19', 5, NULL),
    ('0110', '2025-09-19', 5, NULL);

INSERT INTO ocupa (brinco, data_entrada, id_piquete, data_saida) VALUES
    ('0101', '2025-11-01', 5, NULL),
    ('0103', '2025-11-01', 5, NULL);

INSERT INTO pesagem (brinco, data_pesagem, peso_kg, id_usuario) VALUES
    ('0101', '2025-11-14', 369.0, 2),
    ('0103', '2025-11-14', 402.0, 2);

INSERT INTO recebe (brinco, id_produto, data_aplicacao, id_usuario, num_dose, lote_medicamento) VALUES
    ('0101', 4, '2025-11-14', 1, 1, 'IVM-25-1180'),
    ('0103', 4, '2025-11-14', 1, 1, 'IVM-25-1180');

INSERT INTO pesagem (brinco, data_pesagem, peso_kg, id_usuario) VALUES
    ('0107', '2025-12-18', 448.5, 4),
    ('0110', '2025-12-18', 421.5, 4);

INSERT INTO animal (brinco, sexo, data_nascimento, id_raca, brinco_mae, id_fornecedor, data_compra, valor_compra) VALUES
    ('0204', 'M', '2026-01-08', 1, '0002', NULL, NULL, NULL);

INSERT INTO ocupa (brinco, data_entrada, id_piquete, data_saida) VALUES
    ('0204', '2026-01-08', 1, NULL);

INSERT INTO pesagem (brinco, data_pesagem, peso_kg, id_usuario) VALUES
    ('0204', '2026-01-08', 34.0, 1);

INSERT INTO pesagem (brinco, data_pesagem, peso_kg, id_usuario) VALUES
    ('0201', '2026-01-10', 121.0, 4);

INSERT INTO recebe (brinco, id_produto, data_aplicacao, id_usuario, num_dose, lote_medicamento) VALUES
    ('0201', 3, '2026-01-12', 3, 1, 'CLO-25-2201');

INSERT INTO recebe (brinco, id_produto, data_aplicacao, id_usuario, num_dose, lote_medicamento) VALUES
    ('0201', 3, '2026-02-11', 3, 2, 'CLO-25-2201');

INSERT INTO recebe (brinco, id_produto, data_aplicacao, id_usuario, num_dose, lote_medicamento) VALUES
    ('0001', 2, '2026-02-12', 3, 2, 'RAB-25-0932'),
    ('0002', 2, '2026-02-12', 3, 2, 'RAB-25-0932'),
    ('0003', 2, '2026-02-12', 3, 2, 'RAB-25-0932');

INSERT INTO recebe (brinco, id_produto, data_aplicacao, id_usuario, num_dose, lote_medicamento) VALUES
    ('0201', 1, '2026-02-15', 3, 1, 'B19-25-0077'),
    ('0107', 4, '2026-02-15', 1, 1, 'IVM-25-1180');

INSERT INTO pesagem (brinco, data_pesagem, peso_kg, id_usuario) VALUES
    ('0204', '2026-02-20', 63.0, 4);

INSERT INTO recebe (brinco, id_produto, data_aplicacao, id_usuario, num_dose, lote_medicamento) VALUES
    ('0201', 2, '2026-03-12', 3, 1, 'RAB-25-0932');

INSERT INTO pesagem (brinco, data_pesagem, peso_kg, id_usuario) VALUES
    ('0101', '2026-03-16', 447.5, 1),
    ('0103', '2026-03-16', 494.5, 1);

INSERT INTO recebe (brinco, id_produto, data_aplicacao, id_usuario, num_dose, lote_medicamento) VALUES
    ('0101', 4, '2026-03-16', 4, 1, 'IVM-25-1180'),
    ('0103', 4, '2026-03-16', 4, 1, 'IVM-25-1180');

INSERT INTO recebe (brinco, id_produto, data_aplicacao, id_usuario, num_dose, lote_medicamento) VALUES
    ('0101', 2, '2026-03-18', 3, 2, 'RAB-25-0932'),
    ('0103', 2, '2026-03-18', 3, 2, 'RAB-25-0932');

INSERT INTO recebe (brinco, id_produto, data_aplicacao, id_usuario, num_dose, lote_medicamento) VALUES
    ('0204', 5, '2026-03-28', 3, 1, 'OXI-26-0119');

INSERT INTO baixa (brinco, data_baixa, motivo) VALUES ('0204', '2026-04-02', 'OBITO');
INSERT INTO obito (id_baixa, causa) VALUES (currval(pg_get_serial_sequence('baixa', 'id_baixa')), 'Tristeza parasitária bovina (babesiose)');

INSERT INTO pesagem (brinco, data_pesagem, peso_kg, id_usuario) VALUES
    ('0107', '2026-04-17', 524.0, 2),
    ('0110', '2026-04-17', 484.5, 2);

INSERT INTO pesagem (brinco, data_pesagem, peso_kg, id_usuario) VALUES
    ('0001', '2026-05-05', 484.0, 4),
    ('0002', '2026-05-05', 487.0, 4),
    ('0003', '2026-05-05', 512.5, 4);

INSERT INTO recebe (brinco, id_produto, data_aplicacao, id_usuario, num_dose, lote_medicamento) VALUES
    ('0001', 4, '2026-05-05', 4, 1, 'IVM-26-0640'),
    ('0002', 4, '2026-05-05', 4, 1, 'IVM-26-0640'),
    ('0003', 4, '2026-05-05', 4, 1, 'IVM-26-0640');

INSERT INTO ocupa (brinco, data_entrada, id_piquete, data_saida) VALUES
    ('0201', '2026-05-12', 3, NULL);

INSERT INTO pesagem (brinco, data_pesagem, peso_kg, id_usuario) VALUES
    ('0201', '2026-05-12', 214.5, 2);

INSERT INTO recebe (brinco, id_produto, data_aplicacao, id_usuario, num_dose, lote_medicamento) VALUES
    ('0201', 4, '2026-05-12', 1, 1, 'IVM-25-1180');

INSERT INTO animal (brinco, sexo, data_nascimento, id_raca, brinco_mae, id_fornecedor, data_compra, valor_compra) VALUES
    ('0207', 'F', '2026-06-05', 5, '0003', NULL, NULL, NULL);

INSERT INTO ocupa (brinco, data_entrada, id_piquete, data_saida) VALUES
    ('0207', '2026-06-05', 1, NULL);

INSERT INTO pesagem (brinco, data_pesagem, peso_kg, id_usuario) VALUES
    ('0207', '2026-06-05', 32.0, 1);

INSERT INTO recebe (brinco, id_produto, data_aplicacao, id_usuario, num_dose, lote_medicamento) VALUES
    ('0107', 4, '2026-06-10', 4, 1, 'IVM-26-0640');

INSERT INTO pesagem (brinco, data_pesagem, peso_kg, id_usuario) VALUES
    ('0101', '2026-07-15', 504.5, 4),
    ('0103', '2026-07-15', 562.5, 4);

INSERT INTO recebe (brinco, id_produto, data_aplicacao, id_usuario, num_dose, lote_medicamento) VALUES
    ('0101', 4, '2026-07-15', 4, 1, 'IVM-26-0640'),
    ('0103', 4, '2026-07-15', 4, 1, 'IVM-26-0640');

INSERT INTO pesagem (brinco, data_pesagem, peso_kg, id_usuario) VALUES
    ('0107', '2026-08-14', 574.5, 1),
    ('0110', '2026-08-14', 525.5, 1);

INSERT INTO pesagem (brinco, data_pesagem, peso_kg, id_usuario) VALUES
    ('0201', '2026-09-09', 262.0, 1);

INSERT INTO recebe (brinco, id_produto, data_aplicacao, id_usuario, num_dose, lote_medicamento) VALUES
    ('0201', 4, '2026-09-09', 1, 1, 'IVM-26-0640');

INSERT INTO gta (numero_gta, tipo, data_emissao, origem, destino, finalidade) VALUES
    ('MG-26-0031874', 'SAIDA', '2026-09-14', 'Fazenda São Bento - Itabira/MG', 'Frigorífico Serra Azul - Sete Lagoas/MG', 'ABATE');

INSERT INTO transita_com (brinco, numero_gta) VALUES
    ('0107', 'MG-26-0031874');

INSERT INTO baixa (brinco, data_baixa, motivo) VALUES ('0107', '2026-09-15', 'VENDA');
INSERT INTO venda (id_baixa, comprador, peso_final_kg, valor_venda) VALUES (currval(pg_get_serial_sequence('baixa', 'id_baixa')), 'Frigorífico Serra Azul Ltda', 586, 6460.06);

INSERT INTO pesagem (brinco, data_pesagem, peso_kg, id_usuario) VALUES
    ('0207', '2026-10-03', 68.5, 4);

INSERT INTO recebe (brinco, id_produto, data_aplicacao, id_usuario, num_dose, lote_medicamento) VALUES
    ('0110', 6, '2026-10-10', 3, 1, 'ILA-26-0517');

INSERT INTO pesagem (brinco, data_pesagem, peso_kg, id_usuario) VALUES
    ('0101', '2026-10-14', 534.5, 2),
    ('0103', '2026-10-14', 598.0, 2);

INSERT INTO pesagem (brinco, data_pesagem, peso_kg, id_usuario) VALUES
    ('0110', '2026-10-16', 545.5, 4);

INSERT INTO recebe (brinco, id_produto, data_aplicacao, id_usuario, num_dose, lote_medicamento) VALUES
    ('0103', 5, '2026-10-20', 3, 1, 'OXI-26-0450');

UPDATE usuario SET ativo = FALSE WHERE email = 'pedro@example.com';

COMMIT;

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

-- Linha do tempo de rastreabilidade (ficha completa do animal)
CREATE VIEW vw_linha_do_tempo AS
SELECT a.brinco, a.data_nascimento AS data, 1 AS ordem, 'Nascimento' AS evento,
       CASE WHEN a.brinco_mae IS NOT NULL THEN 'Mãe: ' || a.brinco_mae
            ELSE 'Mãe não registrada' END AS detalhe
  FROM animal a
UNION ALL
SELECT a.brinco, a.data_compra, 2, 'Compra',
       f.nome_propriedade || ' (' || f.municipio || '/' || f.uf || ') - R$ ' || a.valor_compra
  FROM animal a JOIN fornecedor f ON f.id_fornecedor = a.id_fornecedor
UNION ALL
SELECT t.brinco, g.data_emissao, 3, 'GTA de ' || lower(g.tipo),
       g.numero_gta || ': ' || g.origem || ' -> ' || g.destino || ' (' || lower(g.finalidade) || ')'
  FROM transita_com t JOIN gta g ON g.numero_gta = t.numero_gta
UNION ALL
SELECT o.brinco, o.data_entrada, 4, 'Entrada em piquete',
       pq.nome || COALESCE(' até ' || to_char(o.data_saida, 'DD/MM/YYYY'), ' (atual)')
  FROM ocupa o JOIN piquete pq ON pq.id_piquete = o.id_piquete
UNION ALL
SELECT p.brinco, p.data_pesagem, 5, 'Pesagem',
       p.peso_kg || ' kg - ' || u.nome
  FROM pesagem p JOIN usuario u ON u.id_usuario = p.id_usuario
UNION ALL
SELECT r.brinco, r.data_aplicacao, 6, 'Aplicação sanitária',
       ps.nome || ' - dose ' || r.num_dose || ' - lote ' || r.lote_medicamento || ' - ' || u.nome
  FROM recebe r
  JOIN produto_sanitario ps ON ps.id_produto = r.id_produto
  JOIN usuario u            ON u.id_usuario = r.id_usuario
UNION ALL
SELECT b.brinco, b.data_baixa, 7, 'Baixa (' || lower(b.motivo) || ')',
       COALESCE(v.comprador || ' - ' || v.peso_final_kg || ' kg - R$ ' || v.valor_venda, o.causa)
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
