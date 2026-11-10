import type { ReactNode } from 'react'
import { usePermissions, type Permissao } from './permissions'

export function Can({ permissao, children, fallback = null }: {
  permissao: Permissao
  children: ReactNode
  fallback?: ReactNode
}) {
  const { pode } = usePermissions()
  return pode(permissao) ? children : fallback
}
