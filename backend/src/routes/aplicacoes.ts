import { Router } from 'express';
import { pool } from '../db/pool.js';
import { emTransacao } from '../db/transacao.js';
import { numeroObrigatorio, numeroOpcional, textoObrigatorio } from '../db/campos.js';
import {
  dataBr, dataObrigatoria, exigirAnimaisExistentes, exigirDataNaoFutura, exigirResponsavel, listaDeBrincos,
} from '../db/manejos.js';
import { ErroHttp } from '../middleware/erros.js';
import { exigirPermissao } from '../middleware/auth.js';

// Aplicacoes sanitarias (vacina, vermifugo, antibiotico): tabela RECEBE.
// Uma aplicacao e (animal + produto + data) com dose, lote e responsavel.
// Como a vacinacao e feita em lote, o POST aceita varios animais de uma vez.
// O banco confere: restricao de sexo e idade do produto (RI-14), data depois do
// nascimento (RI-15), animal sem baixa antes da data (RI-22) e responsavel ativo (RI-26).
export const aplicacoesRouter = Router();

// GET /api/aplicacoes?brinco=0101&id_produto=4
// Historico (mais recentes primeiro) com a data em que o animal sai da carencia.
aplicacoesRouter.get('/', exigirPermissao('aplicacoes.visualizar'), async (req, res) => {
  const brinco = typeof req.query.brinco === 'string' && req.query.brinco.trim() ? req.query.brinco.trim() : null;
  const idProduto = numeroOpcional(req.query.id_produto, 'produto');
  const { rows } = await pool.query(
    `SELECT r.brinco, r.data_aplicacao, r.id_produto, p.nome AS produto, p.tipo,
            r.num_dose, p.num_doses, r.lote_medicamento,
            r.id_usuario, u.nome AS responsavel,
            p.carencia_dias, r.data_aplicacao + p.carencia_dias AS data_liberacao
       FROM recebe r
       JOIN produto_sanitario p ON p.id_produto = r.id_produto
       JOIN usuario u ON u.id_usuario = r.id_usuario
      WHERE ($1::varchar IS NULL OR r.brinco = $1)
        AND ($2::int IS NULL OR r.id_produto = $2)
      ORDER BY r.data_aplicacao DESC, r.brinco
      LIMIT 500`,
    [brinco, idProduto]
  );
  res.json(rows);
});

// POST /api/aplicacoes
// {
//   "brincos": ["0001", "0002", "0003"],   (ou "brinco": "0001" para um so)
//   "id_produto": 2, "data_aplicacao": "2026-11-10",
//   "id_usuario": 3,                        (responsavel escolhido no formulario)
//   "lote_medicamento": "RAB-26-0101",
//   "num_dose": 1                           (opcional: sem ele, o sistema calcula a proxima dose)
// }
aplicacoesRouter.post('/', exigirPermissao('aplicacoes.criar'), async (req, res) => {
  const b = req.body ?? {};
  const brincos = listaDeBrincos(b);
  const idProduto = numeroObrigatorio(b.id_produto, 'produto');
  const data = dataObrigatoria(b.data_aplicacao, 'Informe a data da aplicação.');
  const idUsuario = numeroObrigatorio(b.id_usuario, 'responsável');
  const lote = textoObrigatorio(b.lote_medicamento, 'Informe o lote do medicamento.');
  if (lote.length > 30) throw new ErroHttp(400, 'O lote pode ter no máximo 30 caracteres.');
  const doseInformada = numeroOpcional(b.num_dose, 'dose');

  const resultado = await emTransacao(async (client) => {
    await exigirDataNaoFutura(client, data, 'da aplicação');
    await exigirResponsavel(client, idUsuario);
    await exigirAnimaisExistentes(client, brincos);

    // liberacao = data + carencia: ate la os animais nao podem ser vendidos para abate (RI-19).
    const produto = await client.query<{ nome: string; num_doses: number; carencia_dias: number; liberacao: string }>(
      `SELECT nome, num_doses, carencia_dias, ($2::date + carencia_dias) AS liberacao
         FROM produto_sanitario WHERE id_produto = $1`, [idProduto, data]);
    if (!produto.rows[0]) throw new ErroHttp(404, 'Produto sanitário não encontrado.');
    const { nome, num_doses, carencia_dias, liberacao } = produto.rows[0];

    if (doseInformada !== null && (!Number.isInteger(doseInformada) || doseInformada < 1 || doseInformada > num_doses)) {
      throw new ErroHttp(400, num_doses === 1
        ? `O produto ${nome} tem uma única dose.`
        : `A dose deve ser um número de 1 a ${num_doses} (o produto ${nome} tem ${num_doses} doses).`);
    }

    // A chave da aplicacao e (brinco, produto, data).
    const repetidas = await client.query<{ brinco: string }>(
      `SELECT brinco FROM recebe
        WHERE id_produto = $1 AND data_aplicacao = $2 AND brinco = ANY($3::varchar[]) ORDER BY brinco`,
      [idProduto, data, brincos]);
    if (repetidas.rowCount) {
      const lista = repetidas.rows.map(r => r.brinco).join(', ');
      throw new ErroHttp(409, repetidas.rowCount === 1
        ? `O animal ${lista} já recebeu ${nome} em ${dataBr(data)}.`
        : `Os animais ${lista} já receberam ${nome} em ${dataBr(data)}.`);
    }

    // Dose automatica: produto de dose unica = 1; esquema de varias doses = ultima dose + 1;
    // se o esquema ja terminou, comeca um novo ciclo na dose 1.
    const ultimas = await client.query<{ brinco: string; num_dose: number }>(
      `SELECT DISTINCT ON (brinco) brinco, num_dose FROM recebe
        WHERE id_produto = $1 AND brinco = ANY($2::varchar[])
        ORDER BY brinco, data_aplicacao DESC`, [idProduto, brincos]);
    const ultimaDose = new Map(ultimas.rows.map(r => [r.brinco, r.num_dose]));
    const proximaDose = (brinco: string) => {
      const ultima = ultimaDose.get(brinco);
      if (num_doses === 1 || ultima === undefined || ultima >= num_doses) return 1;
      return ultima + 1;
    };

    for (const brinco of brincos) {
      await client.query(
        `INSERT INTO recebe (brinco, id_produto, data_aplicacao, id_usuario, num_dose, lote_medicamento)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [brinco, idProduto, data, idUsuario, doseInformada ?? proximaDose(brinco), lote]
      );
    }
    return { nome, carencia_dias, liberacao };
  });

  const carencia = resultado.carencia_dias > 0
    ? ` Carência de ${resultado.carencia_dias} dia(s): liberados para abate a partir de ${dataBr(resultado.liberacao)}.`
    : '';
  res.status(201).json({
    mensagem: `Aplicação registrada: ${resultado.nome} em ${brincos.length === 1
      ? `o animal ${brincos[0]}` : `${brincos.length} animais`}.${carencia}`,
  });
});
