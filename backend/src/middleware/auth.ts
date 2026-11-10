import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

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
export function autenticar(req: Request, res: Response, next: NextFunction) {
  const [tipo, token] = (req.headers.authorization ?? '').split(' ');
  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ erro: 'Faça login para continuar.' });
  }
  try {
    const { id, nome, tipo: perfil } = jwt.verify(token, segredo()) as UsuarioLogado;
    req.usuario = { id, nome, tipo: perfil };
    next();
  } catch {
    return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' });
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
