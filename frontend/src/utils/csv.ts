import type { Coluna } from '../components/ui/Tabela'

type Celula = string | number | null | undefined

// Gera um CSV que o Excel em português abre direto: separador ";",
// vírgula decimal, datas dd/mm/aaaa e BOM para manter os acentos.
function formatarCelula(valor: Celula): string {
  if (valor === null || valor === undefined) return ''
  let texto = typeof valor === 'number' ? String(valor).replace('.', ',') : valor
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    const [ano, mes, dia] = texto.split('-')
    texto = `${dia}/${mes}/${ano}`
  }
  return /[;"\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

export function baixarCsv(nomeArquivo: string, cabecalho: string[], linhas: Celula[][]) {
  const conteudo = [cabecalho, ...linhas].map(l => l.map(formatarCelula).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${nomeArquivo}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

// Exporta usando as mesmas colunas da tabela da tela.
export function exportarTabela<T>(nomeArquivo: string, colunas: Coluna<T>[], linhas: T[]) {
  const valor = (c: Coluna<T>, l: T): Celula => {
    if (c.csv) return c.csv(l)
    const v = c.valor(l)
    return typeof v === 'string' || typeof v === 'number' ? v : ''
  }
  baixarCsv(nomeArquivo, colunas.map(c => c.titulo), linhas.map(l => colunas.map(c => valor(c, l))))
}
