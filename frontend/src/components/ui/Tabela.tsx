import type { ReactNode } from 'react'
import './Tabela.css'

export interface Coluna<T> {
  titulo: string
  valor: (linha: T) => ReactNode
  alinhar?: 'esquerda' | 'direita'
  // Valor em texto para exportar (CSV). Sem ele, usa o próprio valor quando é texto ou número.
  csv?: (linha: T) => string | number | null | undefined
}

// Tabela simples e reutilizável. No celular, cada linha vira um cartão:
// a primeira coluna é o título e as outras aparecem como "rótulo: valor" (ver Tabela.css).
export function Tabela<T>({ colunas, linhas, chave, vazio, legenda }: {
  colunas: Coluna<T>[]
  linhas: T[]
  chave: (linha: T, indice: number) => string
  vazio: ReactNode
  legenda: string
}) {
  // Texto simples ganha a moldura padrão; um componente (ex.: <Vazio />) já traz a sua.
  if (!linhas.length) return typeof vazio === 'string' ? <div className="tabela-vazia">{vazio}</div> : <>{vazio}</>
  return <div className="tabela-rolagem" tabIndex={0} role="region" aria-label={legenda}>
    <table className="tabela">
      <caption className="sr-only">{legenda}</caption>
      <thead><tr>{colunas.map(c => <th key={c.titulo} scope="col" className={c.alinhar === 'direita' ? 'tabela--direita' : undefined}>{c.titulo}</th>)}</tr></thead>
      <tbody>{linhas.map((linha, i) => <tr key={chave(linha, i)}>
        {colunas.map(c => <td key={c.titulo} data-label={c.titulo}
          className={[c.alinhar === 'direita' && 'tabela--direita', c.titulo === 'Ações' && 'tabela__acoes'].filter(Boolean).join(' ') || undefined}>
          {c.valor(linha)}
        </td>)}
      </tr>)}</tbody>
    </table>
  </div>
}
