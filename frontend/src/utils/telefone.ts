// Máscara de telefone brasileiro: a pessoa digita só os números e o campo
// se formata enquanto digita.
//   3133321875  -> (31) 3332-1875   (fixo, 10 dígitos)
//   31999990000 -> (31) 99999-0000  (celular, 11 dígitos)
export function mascararTelefone(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11)
  if (!d) return ''
  if (d.length <= 2) return `(${d}`
  const ddd = `(${d.slice(0, 2)}) `
  const resto = d.slice(2)
  if (resto.length <= 4) return ddd + resto
  // Até 10 dígitos no total: 4 + 4 (fixo). Com 11: 5 + 4 (celular).
  const corte = d.length === 11 ? 5 : 4
  return `${ddd}${resto.slice(0, corte)}-${resto.slice(corte)}`
}

// Telefone completo tem DDD + 8 ou 9 dígitos.
export function telefoneCompleto(valor: string): boolean {
  const n = valor.replace(/\D/g, '').length
  return n === 10 || n === 11
}
