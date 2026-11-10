import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';
import { ErroHttp } from '../middleware/erros.js';
import { autenticar, gerarToken } from '../middleware/auth.js';

export const authRouter = Router();

// POST /api/auth/login  { email, senha }
authRouter.post('/login', async (req, res) => {
  const { email, senha } = req.body ?? {};
  if (!email || !senha) throw new ErroHttp(400, 'Informe e-mail e senha.');

  const { rows } = await pool.query(
    `SELECT id_usuario, nome, tipo, senha_hash, ativo
       FROM usuario
      WHERE lower(email) = lower($1)`,
    [email]
  );
  const usuario = rows[0];

  // Mesma mensagem para e-mail inexistente e senha errada (nao revela qual foi).
  if (!usuario || !(await bcrypt.compare(senha, usuario.senha_hash))) {
    throw new ErroHttp(401, 'E-mail ou senha incorretos.');
  }
  if (!usuario.ativo) throw new ErroHttp(403, 'Usuário inativo. Procure o proprietário.');

  const dados = { id: usuario.id_usuario, nome: usuario.nome, tipo: usuario.tipo };
  res.json({ token: gerarToken(dados), usuario: dados });
});

// GET /api/auth/me  -> quem esta logado
authRouter.get('/me', autenticar, (req, res) => {
  res.json(req.usuario);
});
