import type { ReactNode } from 'react'
import './Tabela.css'

export interface Coluna<T> {
  titulo: string
  valor: (linha: T) => ReactNode
  alinhar?: 'esquerda' | 'direita'
}

// Tabela simples e reutilizável. Em telas pequenas, rola na horizontal.
export function Tabela<T>({ colunas, linhas, chave, vazio, legenda }: {
  colunas: Coluna<T>[]
  linhas: T[]
  chave: (linha: T, indice: number) => string
  vazio: string
  legenda: string
}) {
  if (!linhas.length) return <p className="tabela-vazia">{vazio}</p>
  return <div className="tabela-rolagem" tabIndex={0} role="region" aria-label={legenda}>
    <table className="tabela">
      <caption className="sr-only">{legenda}</caption>
      <thead><tr>{colunas.map(c => <th key={c.titulo} scope="col" className={c.alinhar === 'direita' ? 'tabela--direita' : undefined}>{c.titulo}</th>)}</tr></thead>
      <tbody>{linhas.map((linha, i) => <tr key={chave(linha, i)}>
        {colunas.map(c => <td key={c.titulo} className={c.alinhar === 'direita' ? 'tabela--direita' : undefined}>{c.valor(linha)}</td>)}
      </tr>)}</tbody>
    </table>
  </div>
}
