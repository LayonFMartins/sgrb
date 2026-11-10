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
