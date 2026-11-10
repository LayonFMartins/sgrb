import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { Button } from '../components/ui/Button'
import { LoginPage } from '../pages/Login/LoginPage'

function SessionStatus() {
  const { erro, sair, tentarNovamente } = useAuth()
  return <main className="session-page"><section className="session-card" aria-label="Verificação de sessão">
    <p role={erro ? 'alert' : 'status'}>{erro || 'Verificando sua sessão…'}</p>
    {erro && <Button onClick={tentarNovamente}>Tentar novamente</Button>}
    <button className="session-link" onClick={sair}>Voltar ao login</button>
  </section></main>
}

export function ProtectedRoute() {
  const { token, verificando, erro } = useAuth()
  const location = useLocation()
  if (!token) return <Navigate to="/login" state={{ from: location.pathname + location.search + location.hash }} replace />
  if (verificando || erro) return <SessionStatus />
  return <Outlet />
}

export function LoginRoute() {
  const { token, verificando, erro, aviso, entrar } = useAuth()
  const location = useLocation()
  const from: unknown = location.state?.from
  const destino = typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && from.split(/[?#]/)[0] !== '/login' ? from : '/'
  if (token && (verificando || erro)) return <SessionStatus />
  if (token) return <Navigate to={destino} replace />
  return <>
    {aviso && <p className="session-notice" role="alert">{aviso}</p>}
    <LoginPage onLogin={entrar} />
  </>
}
