// Reutiliza o contrato puro da API, sem duplicar a matriz de perfis no frontend.
import { temPermissao, type Permissao, type TipoUsuario } from '../../../backend/src/auth/permissoes'
import { useAuth } from './AuthContext'

export type { Permissao, TipoUsuario }

export function usePermissions() {
  const { usuario, token, verificando, erro } = useAuth()
  function pode(permissao: Permissao | undefined) {
    return Boolean(token && usuario && !verificando && !erro && temPermissao(usuario.permissoes, permissao))
  }
  return { pode }
}
