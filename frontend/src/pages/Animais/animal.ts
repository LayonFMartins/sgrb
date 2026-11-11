import type { Situacao } from '../../types/animais'
import { plural } from '../../utils/formatar'

export const ETIQUETA_SITUACAO: Record<Situacao, string> = {
  Ativo: 'ok',
  Vendido: 'neutra',
  'Óbito': 'erro',
}

export function nomeSexo(sexo: 'M' | 'F') {
  return sexo === 'F' ? 'Fêmea' : 'Macho'
}

// 7 meses -> "7 meses"; 30 meses -> "2 anos e 6 meses"
export function idade(meses: number) {
  if (meses === 0) return 'menos de 1 mês'
  if (meses < 12) return plural(meses, 'mês', 'meses')
  const anos = Math.floor(meses / 12)
  const resto = meses % 12
  return plural(anos, 'ano', 'anos') + (resto ? ` e ${plural(resto, 'mês', 'meses')}` : '')
}
