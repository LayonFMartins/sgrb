import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';
import { ErroHttp } from '../middleware/erros.js';
import { autenticar, gerarToken } from '../middleware/auth.js';
import { obterPermissoes } from '../auth/permissoes.js';

export const authRouter = Router();

// POST /api/auth/login  { email, senha }
authRouter.post('/login', async (req, res) => {
  const { email, senha } = req.body ?? {};
  if (typeof email !== 'string' || typeof senha !== 'string' || !email.trim() || !senha) throw new ErroHttp(400, 'Informe e-mail e senha.');

  const { rows } = await pool.query(
    `SELECT id_usuario, nome, tipo, senha_hash, ativo
       FROM usuario
      WHERE lower(email) = lower($1)`,
    [email.trim()]
  );
  const usuario = rows[0];

  // Mesma mensagem para e-mail inexistente e senha errada (nao revela qual foi).
  if (!usuario || !(await bcrypt.compare(senha, usuario.senha_hash))) {
    throw new ErroHttp(401, 'E-mail ou senha incorretos.');
  }
  if (!usuario.ativo) throw new ErroHttp(403, 'Usuário inativo. Procure o proprietário.');

  const dados = {
    id: usuario.id_usuario, nome: usuario.nome, tipo: usuario.tipo,
    permissoes: obterPermissoes(usuario.tipo),
  };
  res.json({ token: gerarToken(dados), usuario: dados });
});

// GET /api/auth/me  -> quem esta logado
authRouter.get('/me', autenticar, (req, res) => {
  res.json(req.usuario);
});

// GET /api/auth/conta -> dados da propria conta (tela Configuracoes)
authRouter.get('/conta', autenticar, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id_usuario, nome, funcao, tipo, email FROM usuario WHERE id_usuario = $1',
    [req.usuario!.id]
  );
  if (!rows[0]) throw new ErroHttp(404, 'Usuário não encontrado.');
  res.json(rows[0]);
});

// Mesmas regras do cadastro de usuarios (routes/usuarios.ts).
const SENHA_MINIMA = 6;
const CUSTO_BCRYPT = 10;

// PUT /api/auth/senha  { senha_atual, nova_senha } -> o proprio usuario troca a senha
authRouter.put('/senha', autenticar, async (req, res) => {
  const { senha_atual, nova_senha } = req.body ?? {};
  if (typeof senha_atual !== 'string' || !senha_atual) throw new ErroHttp(400, 'Informe a senha atual.');
  if (typeof nova_senha !== 'string' || nova_senha.length < SENHA_MINIMA) {
    throw new ErroHttp(400, `A nova senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`);
  }
  if (nova_senha === senha_atual) throw new ErroHttp(400, 'A nova senha precisa ser diferente da atual.');

  const { rows } = await pool.query('SELECT senha_hash FROM usuario WHERE id_usuario = $1', [req.usuario!.id]);
  if (!rows[0]?.senha_hash || !(await bcrypt.compare(senha_atual, rows[0].senha_hash))) {
    throw new ErroHttp(400, 'A senha atual está incorreta.');
  }
  await pool.query('UPDATE usuario SET senha_hash = $1 WHERE id_usuario = $2',
    [await bcrypt.hash(nova_senha, CUSTO_BCRYPT), req.usuario!.id]);
  res.json({ mensagem: 'Senha alterada.' });
});
