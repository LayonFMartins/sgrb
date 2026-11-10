import type { ReactNode } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { usePermissions, type Permissao } from './permissions'

// Usado dentro de ProtectedRoute: autenticação e autorização são responsabilidades separadas.
export function PermissionGuard({ permissao, children }: { permissao: Permissao; children?: ReactNode }) {
  const { pode } = usePermissions()
  if (!pode(permissao)) return <section className="content-card">
    <h1>Acesso negado</h1><p>Seu perfil não tem permissão para acessar esta página.</p>
    <Link to="/">Voltar ao início</Link>
  </section>
  return children ?? <Outlet />
}
