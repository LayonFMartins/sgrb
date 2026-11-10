import { useEffect, useState, type ReactNode } from 'react'
import { AuthContext } from './AuthContext'
import { AuthError, consultarUsuario, lerToken, limparToken, observarSessaoExpirada, salvarToken, type Usuario } from './auth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(lerToken)
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [tentativa, setTentativa] = useState(0)

  function sair() {
    limparToken()
    setToken(null)
    setUsuario(null)
    setErro('')
    setAviso('')
  }

  function entrar(novoToken: string, atual: Usuario, lembrar: boolean) {
    salvarToken(novoToken, lembrar)
    setUsuario(atual)
    setToken(novoToken)
    setErro('')
    setAviso('')
  }

  useEffect(() => observarSessaoExpirada(expirado => {
    if (expirado !== token) return
    limparToken()
    setToken(null)
    setUsuario(null)
    setErro('')
    setAviso('Sua sessão foi encerrada. Faça login novamente.')
  }), [token])

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
        if (!(error instanceof AuthError && error.status === 401)) {
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

  return <AuthContext.Provider value={{
    usuario, token, erro, aviso, verificando: Boolean(token && !usuario && !erro),
    entrar, sair, tentarNovamente: () => { setErro(''); setTentativa(value => value + 1) },
  }}>{children}</AuthContext.Provider>
}
