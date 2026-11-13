import { useState } from 'react'
import { Search } from 'lucide-react'
import { LinkAnimal } from '../../components/animais/LinkAnimal'
import { EstadoDados } from '../../components/ui/EstadoDados'
import { Input } from '../../components/ui/Input'
import { Tabela, type Coluna } from '../../components/ui/Tabela'
import { useDados } from '../../hooks/useDados'
import { formatarData, plural } from '../../utils/formatar'
import '../Relatorios/Relatorios.css'
import './Gta.css'
import { useParametro } from '../../hooks/useParametro'
import { Vazio } from '../../components/ui/Vazio'

// Formato de GET /api/gta (backend/src/routes/gta.ts)
interface Gta {
  numero_gta: string
  tipo: 'ENTRADA' | 'SAIDA'
  data_emissao: string
  origem: string
  destino: string
  finalidade: 'CRIA' | 'RECRIA' | 'ENGORDA' | 'ABATE'
  total_animais: number
  animais: string[]
}

type Filtro = 'TODAS' | 'ENTRADA' | 'SAIDA'

const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: 'TODAS', rotulo: 'Todas' },
  { id: 'ENTRADA', rotulo: 'Entrada' },
  { id: 'SAIDA', rotulo: 'Saída' },
]

const FINALIDADE: Record<Gta['finalidade'], string> = {
  CRIA: 'Cria', RECRIA: 'Recria', ENGORDA: 'Engorda', ABATE: 'Abate',
}

const LIMITE_BRINCOS = 6

const colunas: Coluna<Gta>[] = [
  { titulo: 'Número', valor: g => <strong className="gta-numero">{g.numero_gta}</strong> },
  { titulo: 'Tipo', valor: g => g.tipo === 'ENTRADA'
    ? <span className="etiqueta etiqueta--ok">Entrada</span>
    : <span className="etiqueta etiqueta--neutra">Saída</span> },
  { titulo: 'Emissão', valor: g => <span className="gta-numero">{formatarData(g.data_emissao)}</span> },
  { titulo: 'Trajeto', valor: g => <span className="gta-trajeto">
    <span>{g.origem}</span>
    <span className="gta-trajeto__destino"><span aria-hidden="true">→ </span><span className="sr-only">até </span>{g.destino}</span>
  </span> },
  { titulo: 'Finalidade', valor: g => FINALIDADE[g.finalidade] },
  { titulo: 'Animais', valor: g => <Brincos gta={g} /> },
]

export function GtaPage() {
  const [tipo, setTipo] = useParametro('tipo', 'TODAS')
  const filtro = (FILTROS.some(f => f.id === tipo) ? tipo : 'TODAS') as Filtro
  const setFiltro = (valor: Filtro) => setTipo(valor)
  const [busca, setBusca] = useParametro('busca')
  const { dados, ...estado } = useDados<Gta[]>('/gta')

  const gtas = dados ?? []
  const termo = busca.trim().toLocaleLowerCase('pt-BR')
  const visiveis = gtas.filter(g =>
    (filtro === 'TODAS' || g.tipo === filtro) &&
    (!termo || [g.numero_gta, g.origem, g.destino, ...g.animais].some(t => t.toLocaleLowerCase('pt-BR').includes(termo))))
  const total = (id: Filtro) => id === 'TODAS' ? gtas.length : gtas.filter(g => g.tipo === id).length

  return <>
    <header className="page-heading">
      <h1>Guias de trânsito (GTA)</h1>
      <p>Toda entrada e saída de animais da fazenda acompanha uma GTA. As de entrada são registradas na compra e as de saída, na venda.</p>
    </header>

    <section className="content-card" aria-label="Lista de GTAs">
      <div className="gta-filtros">
        <div className="seletor" role="group" aria-label="Filtrar por tipo">
          {FILTROS.map(f => <button key={f.id} type="button" aria-pressed={filtro === f.id}
            className={`seletor__botao${filtro === f.id ? ' seletor__botao--ativo' : ''}`}
            onClick={() => setFiltro(f.id)}>{f.rotulo}{dados && <> <span className="seletor__qtd">{total(f.id)}</span></>}</button>)}
        </div>
        <Input label="Buscar" className="gta-busca" type="search" value={busca} placeholder="Número, origem, destino ou brinco"
          icon={<Search size={16} />} onChange={e => setBusca(e.target.value)} />
      </div>
      <EstadoDados {...estado}>
        {dados && <Tabela legenda="Guias de trânsito" colunas={colunas} linhas={visiveis} chave={g => g.numero_gta}
          vazio={gtas.length === 0
            ? <Vazio titulo="Nenhuma GTA registrada ainda" texto="As GTAs de entrada são criadas ao registrar uma compra, e as de saída, ao registrar uma venda."
              acao={{ rotulo: 'Registrar uma compra', permissao: 'compras.criar', para: '/compras' }} />
            : <Vazio busca={busca} onLimparBusca={() => setBusca('')}
              titulo={`Nenhuma GTA de ${filtro === 'ENTRADA' ? 'entrada' : 'saída'}`} />} />}
      </EstadoDados>
    </section>
  </>
}

// Brincos da GTA com link para a ficha; listas grandes mostram os primeiros e um "ver todos".
function Brincos({ gta }: { gta: Gta }) {
  const [todos, setTodos] = useState(false)
  if (gta.total_animais === 0) return <span className="texto-secundario">—</span>
  const mostrar = todos ? gta.animais : gta.animais.slice(0, LIMITE_BRINCOS)
  const resto = gta.total_animais - mostrar.length
  return <div className="gta-brincos">
    <span className="gta-brincos__qtd">{plural(gta.total_animais, 'animal', 'animais')}:</span>
    {mostrar.map(b => <LinkAnimal key={b} brinco={b} />)}
    {resto > 0 && <button type="button" className="gta-brincos__mais" onClick={() => setTodos(true)}>
      e mais {resto}
    </button>}
  </div>
}
