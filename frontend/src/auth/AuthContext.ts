import { createContext, useContext } from 'react'
import type { Usuario } from './auth'

interface AuthContextValue {
  usuario: Usuario | null
  token: string | null
  verificando: boolean
  erro: string
  aviso: string
  entrar: (token: string, usuario: Usuario, lembrar: boolean) => void
  sair: () => void
  tentarNovamente: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider.')
  return context
}
