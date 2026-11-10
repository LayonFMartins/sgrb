import { useEffect, useState } from 'react'
import { LoginPage } from './pages/Login/LoginPage'
import { AuthError, consultarUsuario, lerToken, limparToken, type Usuario } from './auth/auth'
import { Button } from './components/ui/Button'
import './auth/session.css'

function App() {
  const [token, setToken] = useState(lerToken)
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [erro, setErro] = useState('')
  const [tentativa, setTentativa] = useState(0)
  const [aviso, setAviso] = useState('')

  function sair() {
    limparToken()
    setToken(null)
    setUsuario(null)
    setErro('')
    setAviso('')
  }

  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    let consultando = false
    async function validar() {
      if (consultando) return
      consultando = true
      try {
        const atual = await consultarUsuario(token!, controller.signal)
        if (!controller.signal.aborted) {
          setUsuario(atual)
          setErro('')
        }
      } catch (error) {
        if (controller.signal.aborted) return
        if (error instanceof AuthError && (error.status === 401 || error.status === 403)) {
          limparToken()
          setToken(null)
          setUsuario(null)
          setAviso(error.message)
          setErro('')
        } else {
          setErro(error instanceof Error ? error.message : 'Não foi possível verificar sua sessão.')
        }
      } finally {
        consultando = false
      }
    }
    void validar()
    const interval = window.setInterval(() => void validar(), 60_000)
    const aoFocar = () => void validar()
    window.addEventListener('focus', aoFocar)
    return () => {
      controller.abort()
      window.clearInterval(interval)
      window.removeEventListener('focus', aoFocar)
    }
  }, [token, tentativa])

  if (!token) return <>
    {aviso && <p className="session-notice" role="alert">{aviso}</p>}
    <LoginPage onLogin={(novoToken, atual) => {
      setAviso('')
      setErro('')
      setUsuario(atual)
      setToken(novoToken)
    }} />
  </>

  if (!usuario || erro) return <main className="session-page">
    <section className="session-card" aria-label="Verificação de sessão">
      <p role="status">{erro || 'Verificando sua sessão…'}</p>
      {erro && <Button onClick={() => { setErro(''); setTentativa(value => value + 1) }}>Tentar novamente</Button>}
      <button className="session-link" onClick={sair}>Voltar ao login</button>
    </section>
  </main>

  return <main className="session-page">
    <section className="session-card" aria-labelledby="inicio-titulo">
      <p className="session-brand">SGRB</p>
      <h1 id="inicio-titulo">Bem-vindo(a), {usuario.nome}</h1>
      <p>Perfil: <strong>{usuario.tipo === 'PROPRIETARIO' ? 'Proprietário' : 'Funcionário'}</strong></p>
      <p>{usuario.tipo === 'PROPRIETARIO' ? 'Seu perfil permite acessar todas as funcionalidades do sistema.' : 'Seu perfil permite acessar as funcionalidades autorizadas ao funcionário.'}</p>
      <Button onClick={sair}>Sair</Button>
    </section>
  </main>
}

export default App
