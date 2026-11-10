import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';
import { booleanoDaQuery, idDaRota, textoObrigatorio, textoOpcional } from '../db/campos.js';
import { ErroHttp } from '../middleware/erros.js';
import { exigirPermissao } from '../middleware/auth.js';
import { temPermissao } from '../auth/permissoes.js';

// Usuarios: quem faz login e/ou e responsavel pelos manejos.
// Usuario nao e excluido (aparece no historico de pesagens e aplicacoes):
// em vez disso, e desativado. Inativo nao entra e nao pode ser
// responsavel por novos manejos (RI-26).
export const usuariosRouter = Router();

const NAO_ENCONTRADO = 'Usuário não encontrado.';
const CUSTO_BCRYPT = 10; // mesmo custo dos hashes do povoamento
const SENHA_MINIMA = 6;

// Nunca devolver senha_hash.
const COLUNAS = `id_usuario, nome, funcao, tipo, email, ativo, (email IS NOT NULL) AS tem_login`;

async function gerarHash(senha: unknown): Promise<string> {
  if (typeof senha !== 'string' || senha.length < SENHA_MINIMA) {
    throw new ErroHttp(400, `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`);
  }
  return bcrypt.hash(senha, CUSTO_BCRYPT);
}

function lerUsuario(body: Record<string, unknown> | undefined) {
  const b = body ?? {};
  return {
    nome: textoObrigatorio(b.nome, 'Informe o nome.'),
    funcao: textoObrigatorio(b.funcao, 'Informe a função (ex.: Vaqueiro).'),
    tipo: textoObrigatorio(b.tipo, 'Informe o tipo (PROPRIETARIO ou FUNCIONARIO).').toUpperCase(),
    email: textoOpcional(b.email)?.toLowerCase() ?? null,
  };
}

// GET /api/usuarios?ativo=true  -> lista (o form de manejo usa ?ativo=true
// para escolher o responsavel). Funcionario nao ve e-mails.
usuariosRouter.get('/', exigirPermissao('usuarios.visualizar'), async (req, res) => {
  const ativo = booleanoDaQuery(req.query.ativo);
  const { rows } = await pool.query(
    `SELECT ${COLUNAS}
       FROM usuario
      WHERE $1::boolean IS NULL OR ativo = $1
      ORDER BY nome`,
    [ativo]
  );
  const verEmail = temPermissao(req.usuario?.permissoes, 'usuarios.editar');
  res.json(verEmail ? rows : rows.map(({ email: _email, ...resto }: Record<string, unknown>) => resto));
});

// GET /api/usuarios/:id  -> so o proprietario (tela de edicao)
usuariosRouter.get('/:id', exigirPermissao('usuarios.editar'), async (req, res) => {
  const id = idDaRota(req.params.id, NAO_ENCONTRADO);
  const { rows } = await pool.query(`SELECT ${COLUNAS} FROM usuario WHERE id_usuario = $1`, [id]);
  if (!rows[0]) throw new ErroHttp(404, NAO_ENCONTRADO);
  res.json(rows[0]);
});

// POST /api/usuarios
// Com login:  { "nome": "...", "funcao": "Vaqueiro", "tipo": "FUNCIONARIO",
//               "email": "joao@example.com", "senha": "segredo123" }
// Sem login (so responsavel pelos manejos): omitir email e senha.
usuariosRouter.post('/', exigirPermissao('usuarios.criar'), async (req, res) => {
  const u = lerUsuario(req.body);
  const senha = req.body?.senha;
  if (Boolean(u.email) !== Boolean(senha)) {
    throw new ErroHttp(400, 'RI-23: informe e-mail e senha juntos (ou nenhum dos dois).');
  }
  const hash = u.email ? await gerarHash(senha) : null;

  const { rows } = await pool.query(
    `INSERT INTO usuario (nome, funcao, tipo, email, senha_hash)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${COLUNAS}`,
    [u.nome, u.funcao, u.tipo, u.email, hash]
  );
  res.status(201).json(rows[0]);
});

// PUT /api/usuarios/:id
// "senha" e opcional: se vier, troca a senha; se nao vier, mantem a atual.
// Mandar email vazio remove o login (apaga a senha junto).
usuariosRouter.put('/:id', exigirPermissao('usuarios.editar'), async (req, res) => {
  const id = idDaRota(req.params.id, NAO_ENCONTRADO);
  const u = lerUsuario(req.body);
  const senha = req.body?.senha;
  const novoHash = u.email && senha ? await gerarHash(senha) : null;

  const { rows: atuais } = await pool.query('SELECT senha_hash FROM usuario WHERE id_usuario = $1', [id]);
  if (!atuais[0]) throw new ErroHttp(404, NAO_ENCONTRADO);
  if (u.email && !novoHash && !atuais[0].senha_hash) {
    throw new ErroHttp(400, 'RI-23: para dar acesso a este usuário, informe também uma senha.');
  }

  const { rows } = await pool.query(
    `UPDATE usuario
        SET nome = $1, funcao = $2, tipo = $3, email = $4::varchar,
            senha_hash = CASE WHEN $4::varchar IS NULL THEN NULL
                              ELSE coalesce($5, senha_hash) END
      WHERE id_usuario = $6
      RETURNING ${COLUNAS}`,
    [u.nome, u.funcao, u.tipo, u.email, novoHash, id]
  );
  res.json(rows[0]);
});

// PATCH /api/usuarios/:id/desativar
// O banco garante que sempre sobra um proprietario ativo (RI-25).
usuariosRouter.patch('/:id/desativar', exigirPermissao('usuarios.desativar'), async (req, res) => {
  const id = idDaRota(req.params.id, NAO_ENCONTRADO);
  if (id === req.usuario?.id) throw new ErroHttp(400, 'Você não pode desativar o seu próprio usuário.');
  const { rows } = await pool.query(
    `UPDATE usuario SET ativo = FALSE WHERE id_usuario = $1 RETURNING ${COLUNAS}`, [id]
  );
  if (!rows[0]) throw new ErroHttp(404, NAO_ENCONTRADO);
  res.json(rows[0]);
});

// PATCH /api/usuarios/:id/ativar  -> desfaz a desativacao
usuariosRouter.patch('/:id/ativar', exigirPermissao('usuarios.desativar'), async (req, res) => {
  const id = idDaRota(req.params.id, NAO_ENCONTRADO);
  const { rows } = await pool.query(
    `UPDATE usuario SET ativo = TRUE WHERE id_usuario = $1 RETURNING ${COLUNAS}`, [id]
  );
  if (!rows[0]) throw new ErroHttp(404, NAO_ENCONTRADO);
  res.json(rows[0]);
});
