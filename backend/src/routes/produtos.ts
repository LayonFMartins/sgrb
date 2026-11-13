import { Router } from 'express';
import { pool } from '../db/pool.js';
import { idDaRota, numeroObrigatorio, numeroOpcional, textoObrigatorio, textoOpcional } from '../db/campos.js';
import { ErroHttp } from '../middleware/erros.js';
import { exigirPermissao } from '../middleware/auth.js';

// Produtos sanitarios (vacinas, vermifugos e antibioticos).
export const produtosRouter = Router();

const NAO_ENCONTRADO = 'Produto não encontrado.';

const COLUNAS = `id_produto, nome, tipo, doenca_alvo, carencia_dias, num_doses,
                 intervalo_reforco_dias, sexo_alvo, idade_min_meses, idade_max_meses`;

// Quantas aplicacoes do produto ja foram registradas (tabela recebe).
// Se for maior que zero, o banco nao deixa excluir (chave estrangeira).
const APLICACOES = `(SELECT count(*)::int FROM recebe r
                      WHERE r.id_produto = produto_sanitario.id_produto) AS aplicacoes`;

function lerProduto(body: Record<string, unknown> | undefined) {
  const b = body ?? {};
  const sexo = textoOpcional(b.sexo_alvo);
  return {
    nome: textoObrigatorio(b.nome, 'Informe o nome do produto.'),
    tipo: textoObrigatorio(b.tipo, 'Informe o tipo (VACINA, VERMIFUGO ou ANTIBIOTICO).').toUpperCase(),
    doenca_alvo: textoObrigatorio(b.doenca_alvo, 'Informe a doença alvo.'),
    carencia_dias: numeroObrigatorio(b.carencia_dias, 'carência (dias)'),
    num_doses: numeroObrigatorio(b.num_doses, 'número de doses'),
    intervalo_reforco_dias: numeroOpcional(b.intervalo_reforco_dias, 'intervalo de reforço (dias)'),
    sexo_alvo: sexo ? sexo.toUpperCase() : null,
    idade_min_meses: numeroOpcional(b.idade_min_meses, 'idade mínima (meses)'),
    idade_max_meses: numeroOpcional(b.idade_max_meses, 'idade máxima (meses)'),
  };
}

function valores(p: ReturnType<typeof lerProduto>) {
  return [p.nome, p.tipo, p.doenca_alvo, p.carencia_dias, p.num_doses,
          p.intervalo_reforco_dias, p.sexo_alvo, p.idade_min_meses, p.idade_max_meses];
}

// GET /api/produtos?tipo=VACINA  -> lista (usada no formulario de aplicacao)
produtosRouter.get('/', exigirPermissao('produtos.visualizar'), async (req, res) => {
  const tipo = req.query.tipo ? String(req.query.tipo).toUpperCase() : null;
  const { rows } = await pool.query(
    `SELECT ${COLUNAS}, ${APLICACOES}
       FROM produto_sanitario
      WHERE $1::text IS NULL OR tipo = $1
      ORDER BY nome`,
    [tipo]
  );
  res.json(rows);
});

// GET /api/produtos/:id
produtosRouter.get('/:id', exigirPermissao('produtos.visualizar'), async (req, res) => {
  const id = idDaRota(req.params.id, NAO_ENCONTRADO);
  const { rows } = await pool.query(`SELECT ${COLUNAS}, ${APLICACOES} FROM produto_sanitario WHERE id_produto = $1`, [id]);
  if (!rows[0]) throw new ErroHttp(404, NAO_ENCONTRADO);
  res.json(rows[0]);
});

// POST /api/produtos
// { "nome": "Aftosa X", "tipo": "VACINA", "doenca_alvo": "Febre aftosa", "carencia_dias": 0,
//   "num_doses": 2, "intervalo_reforco_dias": 30, "sexo_alvo": null,
//   "idade_min_meses": 3, "idade_max_meses": null }
produtosRouter.post('/', exigirPermissao('produtos.criar'), async (req, res) => {
  const p = lerProduto(req.body);
  const { rows } = await pool.query(
    `INSERT INTO produto_sanitario (nome, tipo, doenca_alvo, carencia_dias, num_doses,
                                    intervalo_reforco_dias, sexo_alvo, idade_min_meses, idade_max_meses)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING ${COLUNAS}`,
    valores(p)
  );
  res.status(201).json(rows[0]);
});

// PUT /api/produtos/:id
// Se a nova restricao (sexo/idade/carencia) conflitar com aplicacoes ja feitas,
// os triggers do banco barram a alteracao.
produtosRouter.put('/:id', exigirPermissao('produtos.editar'), async (req, res) => {
  const id = idDaRota(req.params.id, NAO_ENCONTRADO);
  const p = lerProduto(req.body);
  const { rows } = await pool.query(
    `UPDATE produto_sanitario
        SET nome = $1, tipo = $2, doenca_alvo = $3, carencia_dias = $4, num_doses = $5,
            intervalo_reforco_dias = $6, sexo_alvo = $7, idade_min_meses = $8, idade_max_meses = $9
      WHERE id_produto = $10
      RETURNING ${COLUNAS}`,
    [...valores(p), id]
  );
  if (!rows[0]) throw new ErroHttp(404, NAO_ENCONTRADO);
  res.json(rows[0]);
});

// DELETE /api/produtos/:id
produtosRouter.delete('/:id', exigirPermissao('produtos.excluir'), async (req, res) => {
  const id = idDaRota(req.params.id, NAO_ENCONTRADO);
  // Produto ja aplicado em algum animal nao pode sair (chave estrangeira).
  const { rowCount } = await pool.query('DELETE FROM produto_sanitario WHERE id_produto = $1', [id]);
  if (!rowCount) throw new ErroHttp(404, NAO_ENCONTRADO);
  res.status(204).end();
});
