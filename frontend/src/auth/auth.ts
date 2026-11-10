export interface Usuario {
  id: number
  nome: string
  tipo: 'PROPRIETARIO' | 'FUNCIONARIO'
}

export class AuthError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function solicitar<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, options)
  } catch {
    throw new Error('Não foi possível conectar ao servidor. Tente novamente.')
  }
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new AuthError(response.status, body?.erro ?? 'Não foi possível concluir a solicitação.')
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
