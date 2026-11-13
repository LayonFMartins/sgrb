import { isValidElement, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import './Tabela.css'

type ValorOrdem = string | number | null | undefined

export interface Coluna<T> {
  titulo: string
  valor: (linha: T) => ReactNode
  alinhar?: 'esquerda' | 'direita'
  // Valor em texto para exportar (CSV). Sem ele, usa o próprio valor quando é texto ou número.
  csv?: (linha: T) => ValorOrdem
  // Valor usado para ordenar ao clicar no título. Sem ele, usa o csv ou o texto que aparece na célula.
  // Use quando o texto exibido não ordena bem (ex.: ordenar pelo número, não por "12 animais").
  ordenar?: (linha: T) => ValorOrdem
  // false: a coluna não é ordenável (a coluna "Ações" já nunca é).
  ordenavel?: boolean
}

type Direcao = 'asc' | 'desc'

// Texto que aparece numa célula: <strong>Nelore</strong> vira "Nelore".
// Componentes sem texto dentro (ex.: <LinkAnimal brinco="0101" />) usam a prop brinco ou principal.
function textoDe(no: ReactNode): string {
  if (no === null || no === undefined || typeof no === 'boolean') return ''
  if (typeof no === 'string' || typeof no === 'number') return String(no)
  if (Array.isArray(no)) return no.map(textoDe).join('')
  if (isValidElement<{ children?: ReactNode; principal?: ReactNode; brinco?: string }>(no)) {
    const { children, principal, brinco } = no.props
    return textoDe(children) || textoDe(principal) || brinco || ''
  }
  return ''
}

// Converte o texto exibido em algo comparável: datas dd/mm/aaaa e números
// ("1.234,50", "R$ 2.900,00", "12 animais", "14,50 ha") viram número; o resto fica texto.
function chaveOrdem(valor: ValorOrdem): string | number | null {
  if (valor === null || valor === undefined) return null
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null
  const texto = valor.trim()
  if (!texto || texto === '—') return null
  const data = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})/) ?? texto.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (data) {
    const [, a, b, c] = data
    return a.length === 4 ? Number(a + b + c) : Number(c + b + a)
  }
  const numero = texto.match(/^(?:R\$\s*)?(-?\d[\d.]*(?:,\d+)?)(?:\s|$|%)/)
  if (numero) return Number(numero[1].replace(/\./g, '').replace(',', '.'))
  return texto
}

const comparadorTexto = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' })

function comparar(a: string | number | null, b: string | number | null): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1 // vazios sempre no fim
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return comparadorTexto.compare(String(a), String(b))
}

// Tabela simples e reutilizável. Clicar no título de uma coluna ordena a lista
// (1º clique: crescente, 2º: decrescente, 3º: volta à ordem original).
// No celular, cada linha vira um cartão: a primeira coluna é o título e as outras
// aparecem como "rótulo: valor" (ver Tabela.css).
export function Tabela<T>({ colunas, linhas, chave, vazio, legenda }: {
  colunas: Coluna<T>[]
  linhas: T[]
  chave: (linha: T, indice: number) => string
  vazio: ReactNode
  legenda: string
}) {
  const [ordem, setOrdem] = useState<{ titulo: string; direcao: Direcao } | null>(null)

  // Texto simples ganha a moldura padrão; um componente (ex.: <Vazio />) já traz a sua.
  if (!linhas.length) return typeof vazio === 'string' ? <div className="tabela-vazia">{vazio}</div> : <>{vazio}</>

  const valorDaColuna = (c: Coluna<T>, linha: T): ValorOrdem =>
    c.ordenar ? c.ordenar(linha) : c.csv ? c.csv(linha) : textoDe(c.valor(linha))
  const ordenavel = (c: Coluna<T>) => c.ordenavel !== false && c.titulo !== 'Ações' &&
    (c.ordenar !== undefined || c.csv !== undefined || linhas.some(l => textoDe(c.valor(l)) !== ''))

  const colunaOrdem = ordem && colunas.find(c => c.titulo === ordem.titulo)
  let visiveis = linhas.map((linha, indice) => ({ linha, indice }))
  if (ordem && colunaOrdem) {
    const sinal = ordem.direcao === 'asc' ? 1 : -1
    const chaves = new Map(visiveis.map(v => [v.indice, chaveOrdem(valorDaColuna(colunaOrdem, v.linha))]))
    visiveis = [...visiveis].sort((x, y) => {
      const a = chaves.get(x.indice) ?? null
      const b = chaves.get(y.indice) ?? null
      if (a === null || b === null) return comparar(a, b) // vazios no fim nas duas direções
      return sinal * comparar(a, b) || x.indice - y.indice // empate: mantém a ordem original
    })
  }

  function alternar(titulo: string) {
    setOrdem(atual => atual?.titulo !== titulo ? { titulo, direcao: 'asc' }
      : atual.direcao === 'asc' ? { titulo, direcao: 'desc' } : null)
  }

  return <div className="tabela-rolagem" tabIndex={0} role="region" aria-label={legenda}>
    <table className="tabela">
      <caption className="sr-only">{legenda}</caption>
      <thead><tr>{colunas.map(c => {
        const ativa = ordem?.titulo === c.titulo
        const classe = c.alinhar === 'direita' ? 'tabela--direita' : undefined
        if (!ordenavel(c)) return <th key={c.titulo} scope="col" className={classe}>{c.titulo}</th>
        const Icone = !ativa ? ArrowUpDown : ordem.direcao === 'asc' ? ArrowUp : ArrowDown
        return <th key={c.titulo} scope="col" className={classe}
          aria-sort={ativa ? (ordem.direcao === 'asc' ? 'ascending' : 'descending') : 'none'}>
          <button type="button" className={`tabela__ordenar${ativa ? ' tabela__ordenar--ativa' : ''}`}
            onClick={() => alternar(c.titulo)} title={`Ordenar por ${c.titulo.toLocaleLowerCase('pt-BR')}`}>
            {c.titulo}<Icone size={13} aria-hidden="true" />
          </button>
        </th>
      })}</tr></thead>
      <tbody>{visiveis.map(({ linha, indice }) => <tr key={chave(linha, indice)}>
        {colunas.map(c => <td key={c.titulo} data-label={c.titulo}
          className={[c.alinhar === 'direita' && 'tabela--direita', c.titulo === 'Ações' && 'tabela__acoes'].filter(Boolean).join(' ') || undefined}>
          {c.valor(linha)}
        </td>)}
      </tr>)}</tbody>
    </table>
  </div>
}
