import { Router } from 'express';
import type { PoolClient } from 'pg';
import { pool } from '../db/pool.js';
import { emTransacao } from '../db/transacao.js';
import { idDaRota, textoObrigatorio } from '../db/campos.js';
import { ErroHttp } from '../middleware/erros.js';
import { exigirPermissao } from '../middleware/auth.js';

// Fornecedor + telefones (atributo multivalorado em telefone_fornecedor).
// Criar e editar mexem nas duas tabelas, entao rodam em transacao.
export const fornecedoresRouter = Router();

const NAO_ENCONTRADO = 'Fornecedor não encontrado.';

// Fornecedor com a lista de telefones e quantos animais foram comprados dele.
const SELECT_FORNECEDOR = `
  SELECT f.id_fornecedor, f.nome_produtor, f.nome_propriedade, f.municipio, f.uf,
         coalesce((SELECT array_agg(t.telefone ORDER BY t.telefone)
                     FROM telefone_fornecedor t
                    WHERE t.id_fornecedor = f.id_fornecedor), '{}') AS telefones,
         (SELECT count(*)::int FROM animal a WHERE a.id_fornecedor = f.id_fornecedor) AS animais
    FROM fornecedor f`;

interface DadosFornecedor {
  nome_produtor: string;
  nome_propriedade: string;
  municipio: string;
  uf: string;
  telefones: string[];
}

function lerFornecedor(body: Record<string, unknown> | undefined): DadosFornecedor {
  const b = body ?? {};
  const telefones = b.telefones ?? [];
  if (!Array.isArray(telefones)) throw new ErroHttp(400, 'Os telefones devem ser enviados em uma lista.');

  // Remove vazios e repetidos (a chave primaria nao aceita telefone duplicado).
  const limpos = [...new Set(telefones.map((t) => String(t ?? '').trim()).filter(Boolean))];
  if (limpos.some((t) => t.length > 20)) throw new ErroHttp(400, 'Telefone com mais de 20 caracteres.');

  return {
    nome_produtor: textoObrigatorio(b.nome_produtor, 'Informe o nome do produtor.'),
    nome_propriedade: textoObrigatorio(b.nome_propriedade, 'Informe o nome da propriedade.'),
    municipio: textoObrigatorio(b.municipio, 'Informe o município.'),
    uf: textoObrigatorio(b.uf, 'Informe a UF.').toUpperCase(),
    telefones: limpos,
  };
}

async function gravarTelefones(client: PoolClient, id: number, telefones: string[]) {
  await client.query('DELETE FROM telefone_fornecedor WHERE id_fornecedor = $1', [id]);
  if (telefones.length) {
    await client.query(
      `INSERT INTO telefone_fornecedor (id_fornecedor, telefone)
       SELECT $1, unnest($2::varchar[])`,
      [id, telefones]
    );
  }
}

// GET /api/fornecedores  -> lista (usada no formulario de compra)
fornecedoresRouter.get('/', exigirPermissao('fornecedores.visualizar'), async (_req, res) => {
  const { rows } = await pool.query(`${SELECT_FORNECEDOR} ORDER BY f.nome_produtor`);
  res.json(rows);
});

// GET /api/fornecedores/:id
fornecedoresRouter.get('/:id', exigirPermissao('fornecedores.visualizar'), async (req, res) => {
  const id = idDaRota(req.params.id, NAO_ENCONTRADO);
  const { rows } = await pool.query(`${SELECT_FORNECEDOR} WHERE f.id_fornecedor = $1`, [id]);
  if (!rows[0]) throw new ErroHttp(404, NAO_ENCONTRADO);
  res.json(rows[0]);
});

// POST /api/fornecedores
// { "nome_produtor": "...", "nome_propriedade": "...", "municipio": "...", "uf": "MG",
//   "telefones": ["(31) 99999-0000"] }
fornecedoresRouter.post('/', exigirPermissao('fornecedores.criar'), async (req, res) => {
  const f = lerFornecedor(req.body);
  const id = await emTransacao(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO fornecedor (nome_produtor, nome_propriedade, municipio, uf)
       VALUES ($1, $2, $3, $4)
       RETURNING id_fornecedor`,
      [f.nome_produtor, f.nome_propriedade, f.municipio, f.uf]
    );
    await gravarTelefones(client, rows[0].id_fornecedor, f.telefones);
    return rows[0].id_fornecedor as number;
  });
  const { rows } = await pool.query(`${SELECT_FORNECEDOR} WHERE f.id_fornecedor = $1`, [id]);
  res.status(201).json(rows[0]);
});

// PUT /api/fornecedores/:id  -> a lista de telefones enviada substitui a anterior
fornecedoresRouter.put('/:id', exigirPermissao('fornecedores.editar'), async (req, res) => {
  const id = idDaRota(req.params.id, NAO_ENCONTRADO);
  const f = lerFornecedor(req.body);
  await emTransacao(async (client) => {
    const { rowCount } = await client.query(
      `UPDATE fornecedor
          SET nome_produtor = $1, nome_propriedade = $2, municipio = $3, uf = $4
        WHERE id_fornecedor = $5`,
      [f.nome_produtor, f.nome_propriedade, f.municipio, f.uf, id]
    );
    if (!rowCount) throw new ErroHttp(404, NAO_ENCONTRADO);
    await gravarTelefones(client, id, f.telefones);
  });
  const { rows } = await pool.query(`${SELECT_FORNECEDOR} WHERE f.id_fornecedor = $1`, [id]);
  res.json(rows[0]);
});

// DELETE /api/fornecedores/:id
fornecedoresRouter.delete('/:id', exigirPermissao('fornecedores.excluir'), async (req, res) => {
  const id = idDaRota(req.params.id, NAO_ENCONTRADO);
  // Os telefones saem junto (ON DELETE CASCADE).
  // Se algum animal foi comprado dele, o banco bloqueia (chave estrangeira).
  const { rowCount } = await pool.query('DELETE FROM fornecedor WHERE id_fornecedor = $1', [id]);
  if (!rowCount) throw new ErroHttp(404, NAO_ENCONTRADO);
  res.status(204).end();
});
