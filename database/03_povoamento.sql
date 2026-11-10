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
