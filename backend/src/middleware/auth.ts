import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';

export type TipoUsuario = 'PROPRIETARIO' | 'FUNCIONARIO';

export interface UsuarioLogado {
  id: number;
  nome: string;
  tipo: TipoUsuario;
}

// Disponibiliza req.usuario nas rotas protegidas.
declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioLogado;
    }
  }
}

function segredo(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET não configurado.');
  return s;
}

export function gerarToken(usuario: UsuarioLogado): string {
  return jwt.sign(usuario, segredo(), { expiresIn: '8h' });
}

// Exige login: o front envia o cabecalho "Authorization: Bearer <token>".
export async function autenticar(req: Request, res: Response, next: NextFunction) {
  const [tipo, token] = (req.headers.authorization ?? '').split(' ');
  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ erro: 'Faça login para continuar.' });
  }
  let id: number;
  try {
    const payload = jwt.verify(token, segredo(), { algorithms: ['HS256'] });
    if (typeof payload === 'string' || !Number.isInteger(payload.id)) throw new Error('Token inválido');
    id = payload.id;
  } catch {
    return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT id_usuario AS id, nome, tipo, ativo FROM usuario WHERE id_usuario = $1', [id]
    );
    const usuario = rows[0];
    if (!usuario || !usuario.ativo) {
      return res.status(401).json({ erro: 'Sessão encerrada. Faça login novamente.' });
    }
    req.usuario = { id: usuario.id, nome: usuario.nome, tipo: usuario.tipo };
    next();
  } catch (erro) {
    next(erro);
  }
}

// Restringe a rota a determinados perfis (ex.: so o proprietario).
export function exigirPerfil(...perfis: TipoUsuario[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.usuario || !perfis.includes(req.usuario.tipo)) {
      return res.status(403).json({ erro: 'Seu perfil não tem permissão para esta ação.' });
    }
    next();
  };
}
