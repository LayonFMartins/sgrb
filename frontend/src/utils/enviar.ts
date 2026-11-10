import { solicitar } from '../auth/auth'

// Envia dados para a API (POST, PUT, PATCH, DELETE) com o token do usuário logado.
// Em caso de erro, lança um Error com a mensagem que o backend devolveu
// (ex.: "RI-09: o piquete P01 - Baixada tem 4 animais; ...").
export function enviar<T = unknown>(caminho: string, metodo: 'POST' | 'PUT' | 'PATCH' | 'DELETE', corpo?: unknown) {
  return solicitar<T>(caminho, {
    method: metodo,
    headers: corpo === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
}

export function mensagemDeErro(e: unknown) {
  return e instanceof Error ? e.message : 'Não foi possível concluir a solicitação.'
}
