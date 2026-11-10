// A API devolve datas como 'AAAA-MM-DD'. Formatamos sem usar Date para
// não haver deslocamento de fuso horário (data aparecendo com um dia a menos).
export function formatarData(data: string | null | undefined): string {
  if (!data) return '—'
  const [ano, mes, dia] = data.slice(0, 10).split('-')
  return `${dia}/${mes}/${ano}`
}

export function formatarNumero(valor: number | null | undefined, casas = 0): string {
  if (valor === null || valor === undefined) return '—'
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
}

export function formatarPeso(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? '—' : `${formatarNumero(valor, 1)} kg`
}

export function plural(qtd: number, singular: string, pluralTexto: string): string {
  return `${qtd} ${qtd === 1 ? singular : pluralTexto}`
}
