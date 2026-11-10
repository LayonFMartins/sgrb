import type { Permissao, TipoUsuario } from './permissions'

export interface Usuario {
  id: number
  nome: string
  tipo: TipoUsuario
  permissoes: Permissao[]
}

export class AuthError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const sessaoExpirada = new EventTarget()

export function observarSessaoExpirada(callback: (token: string) => void) {
  const listener = (event: Event) => callback((event as CustomEvent<string>).detail)
  sessaoExpirada.addEventListener('expirada', listener)
  return () => sessaoExpirada.removeEventListener('expirada', listener)
}

export async function solicitar<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  const token = lerToken()
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)
  let response: Response
  try {
    response = await fetch(`/api${path}`, { ...options, headers })
  } catch (error) {
    if (options.signal?.aborted) throw error
    throw new Error('Não foi possível conectar ao servidor. Tente novamente.', { cause: error })
  }
  const body = await response.json().catch(() => null)
  if (response.status === 401 && path !== '/auth/login') {
    const enviado = headers.get('Authorization')?.replace(/^Bearer /, '')
    if (enviado) sessaoExpirada.dispatchEvent(new CustomEvent('expirada', { detail: enviado }))
  }
  if (!response.ok) throw new AuthError(response.status, body?.erro ?? 'Não foi possível concluir a solicitação.')
  if (response.status === 204) return undefined as T
  if (!body) throw new Error('Resposta inválida do servidor. Tente novamente.')
  return body as T
}

const chave = 'sgrb.token'
export function lerToken() {
  return sessionStorage.getItem(chave) ?? localStorage.getItem(chave)
}
export function limparToken() {
  sessionStorage.removeItem(chave)
  localStorage.removeItem(chave)
}
export function salvarToken(token: string, lembrar: boolean) {
  limparToken()
  ;(lembrar ? localStorage : sessionStorage).setItem(chave, token)
}

export function consultarUsuario(token: string, signal?: AbortSignal) {
  return solicitar<Usuario>('/auth/me', { headers: { Authorization: `Bearer ${token}` }, signal })
}
