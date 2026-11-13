// Busca simples nas listas dos cadastros: ignora maiúsculas e acentos.
// Ex.: "angus" encontra "Aberdeen Angus"; "sao" encontra "São Bento".
export function normalizar(texto: string | number | null | undefined): string {
  return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR').trim()
}

// true se o termo aparece em algum dos campos (termo vazio = mostra tudo).
export function combina(termo: string, ...campos: (string | number | null | undefined)[]): boolean {
  const t = normalizar(termo)
  return !t || campos.some(c => normalizar(c).includes(t))
}
