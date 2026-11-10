import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useDados } from '../../hooks/useDados'
import { EstadoDados } from '../../components/ui/EstadoDados'
import { Tabela, type Coluna } from '../../components/ui/Tabela'
import { LotacaoPiquetes } from '../../components/consultas/LotacaoPiquetes'
import type { Campanha, Carencia, GmdAnimal, GmdGrupo, Piquete, Reforco } from '../../types/consultas'
import { formatarData, formatarNumero, formatarPeso, plural } from '../../utils/formatar'
import './Relatorios.css'

const ABAS = [
  { id: 'lotacao', rotulo: 'Lotação' },
  { id: 'gmd', rotulo: 'Ganho de peso (GMD)' },
  { id: 'carencia', rotulo: 'Carência' },
  { id: 'reforcos', rotulo: 'Reforços' },
  { id: 'campanhas', rotulo: 'Vacinação obrigatória' },
] as const
type Aba = typeof ABAS[number]['id']

export function RelatoriosPage() {
  const [params, setParams] = useSearchParams()
  const pedida = params.get('aba')
  const aba: Aba = ABAS.some(a => a.id === pedida) ? pedida as Aba : 'lotacao'

  return <>
    <header className="page-heading">
      <h1>Relatórios e consultas</h1>
      <p>Informações calculadas a partir do histórico do rebanho.</p>
    </header>
    <div className="abas" role="tablist" aria-label="Consultas">
      {ABAS.map(a => <button key={a.id} id={`aba-${a.id}`} type="button" role="tab"
        aria-selected={aba === a.id} aria-controls="painel-consulta"
        className={`abas__botao${aba === a.id ? ' abas__botao--ativa' : ''}`}
        onClick={() => setParams({ aba: a.id })}>{a.rotulo}</button>)}
    </div>
    <section id="painel-consulta" role="tabpanel" aria-labelledby={`aba-${aba}`} className="content-card consulta">
      {aba === 'lotacao' && <Lotacao />}
      {aba === 'gmd' && <Gmd />}
      {aba === 'carencia' && <CarenciaAba />}
      {aba === 'reforcos' && <Reforcos />}
      {aba === 'campanhas' && <Campanhas />}
    </section>
  </>
}

function Lotacao() {
  const { dados, ...estado } = useDados<Piquete[]>('/consultas/lotacao')
  return <>
    <Descricao titulo="Lotação dos piquetes">
      Animais em cada piquete em relação à capacidade máxima. Um piquete que fica vazio entra em descanso pelo período mínimo cadastrado.
    </Descricao>
    <EstadoDados {...estado}>{dados && <LotacaoPiquetes piquetes={dados} />}</EstadoDados>
  </>
}

const colunasGmdAnimal: Coluna<GmdAnimal>[] = [
  { titulo: '#', valor: g => g.posicao, alinhar: 'direita' },
  { titulo: 'Brinco', valor: g => <strong>{g.brinco}</strong> },
  { titulo: 'Raça', valor: g => g.raca },
  { titulo: 'Categoria', valor: g => g.categoria },
  { titulo: 'Origem', valor: g => g.fornecedor ?? 'Nascido na fazenda' },
  { titulo: 'Peso inicial', valor: g => formatarPeso(g.peso_inicial), alinhar: 'direita' },
  { titulo: 'Peso final', valor: g => formatarPeso(g.peso_final), alinhar: 'direita' },
  { titulo: 'Período', valor: g => plural(g.dias, 'dia', 'dias'), alinhar: 'direita' },
  { titulo: 'GMD (kg/dia)', valor: g => <strong>{formatarNumero(g.gmd_kg_dia, 3)}</strong>, alinhar: 'direita' },
  { titulo: 'Situação', valor: g => <span className={`etiqueta etiqueta--${g.situacao === 'Ativo' ? 'ok' : 'neutra'}`}>{g.situacao}</span> },
]

function Gmd() {
  const [agrupar, setAgrupar] = useState<'animal' | 'raca' | 'fornecedor'>('animal')
  return <>
    <Descricao titulo="Ranking de ganho médio diário">
      Ganho de peso por dia entre a primeira e a última pesagem, considerando animais em crescimento (menos de 24 meses na primeira pesagem).
    </Descricao>
    <div className="seletor" role="group" aria-label="Agrupar ranking por">
      {([['animal', 'Por animal'], ['raca', 'Por raça'], ['fornecedor', 'Por fornecedor']] as const).map(([id, rotulo]) =>
        <button key={id} type="button" aria-pressed={agrupar === id}
          className={`seletor__botao${agrupar === id ? ' seletor__botao--ativo' : ''}`}
          onClick={() => setAgrupar(id)}>{rotulo}</button>)}
    </div>
    {agrupar === 'animal' ? <GmdPorAnimal /> : <GmdPorGrupo agrupar={agrupar} />}
  </>
}

function GmdPorAnimal() {
  const { dados, ...estado } = useDados<GmdAnimal[]>('/consultas/gmd?agrupar=animal')
  return <EstadoDados {...estado}>
    {dados && <Tabela legenda="Ranking de GMD por animal" colunas={colunasGmdAnimal} linhas={dados}
      chave={g => g.brinco} vazio="Ainda não há pesagens suficientes para calcular o GMD." />}
  </EstadoDados>
}

function GmdPorGrupo({ agrupar }: { agrupar: 'raca' | 'fornecedor' }) {
  const { dados, ...estado } = useDados<GmdGrupo[]>(`/consultas/gmd?agrupar=${agrupar}`)
  const titulo = agrupar === 'raca' ? 'Raça' : 'Fornecedor'
  const colunas: Coluna<GmdGrupo>[] = [
    { titulo, valor: g => <strong>{g.grupo}</strong> },
    { titulo: 'Animais', valor: g => g.animais, alinhar: 'direita' },
    { titulo: 'GMD médio (kg/dia)', valor: g => <strong>{formatarNumero(g.gmd_medio_kg_dia, 3)}</strong>, alinhar: 'direita' },
  ]
  return <EstadoDados {...estado}>
    {dados && <Tabela legenda={`GMD médio por ${titulo.toLocaleLowerCase('pt-BR')}`} colunas={colunas} linhas={dados}
      chave={g => g.grupo} vazio="Ainda não há dados para este agrupamento." />}
  </EstadoDados>
}

const colunasCarencia: Coluna<Carencia>[] = [
  { titulo: 'Brinco', valor: c => <strong>{c.brinco}</strong> },
  { titulo: 'Produto', valor: c => c.produto },
  { titulo: 'Aplicado em', valor: c => formatarData(c.data_aplicacao) },
  { titulo: 'Carência', valor: c => plural(c.carencia_dias, 'dia', 'dias'), alinhar: 'direita' },
  { titulo: 'Liberado para abate em', valor: c => <strong>{formatarData(c.data_liberacao)}</strong> },
  { titulo: 'Faltam', valor: c => <span className="etiqueta etiqueta--alerta">{plural(c.dias_restantes, 'dia', 'dias')}</span> },
]

function CarenciaAba() {
  const { dados, ...estado } = useDados<Carencia[]>('/consultas/carencia')
  return <>
    <Descricao titulo="Animais em carência">
      Animais que receberam produtos com período de carência ainda em curso. Eles não podem ser vendidos para abate até a data de liberação.
    </Descricao>
    <EstadoDados {...estado}>
      {dados && <Tabela legenda="Animais em carência" colunas={colunasCarencia} linhas={dados}
        chave={c => c.brinco} vazio="Nenhum animal em carência no momento." />}
    </EstadoDados>
  </>
}

const colunasReforcos: Coluna<Reforco>[] = [
  { titulo: 'Brinco', valor: r => <strong>{r.brinco}</strong> },
  { titulo: 'Produto', valor: r => r.produto },
  { titulo: 'Última dose', valor: r => `${r.ultima_dose}ª em ${formatarData(r.data_ultima_dose)}` },
  { titulo: 'Próxima dose', valor: r => formatarData(r.data_proxima_dose) },
  { titulo: 'Situação', valor: r => r.situacao === 'Atrasado'
    ? <span className="etiqueta etiqueta--erro">{plural(r.dias_atraso, 'dia', 'dias')} de atraso</span>
    : <span className="etiqueta etiqueta--ok">Em dia</span> },
]

function Reforcos() {
  const [somenteAtrasados, setSomenteAtrasados] = useState(true)
  const { dados, ...estado } = useDados<Reforco[]>(`/consultas/reforcos${somenteAtrasados ? '?situacao=Atrasado' : ''}`)
  return <>
    <Descricao titulo="Reforços e próximas doses">
      Próxima dose de cada produto: a dose seguinte do protocolo (vacinas de mais de uma dose) ou o reforço periódico (ex.: anual).
    </Descricao>
    <div className="seletor" role="group" aria-label="Filtrar reforços">
      <button type="button" aria-pressed={somenteAtrasados} className={`seletor__botao${somenteAtrasados ? ' seletor__botao--ativo' : ''}`} onClick={() => setSomenteAtrasados(true)}>Atrasados</button>
      <button type="button" aria-pressed={!somenteAtrasados} className={`seletor__botao${!somenteAtrasados ? ' seletor__botao--ativo' : ''}`} onClick={() => setSomenteAtrasados(false)}>Todos</button>
    </div>
    <EstadoDados {...estado}>
      {dados && <Tabela legenda="Reforços" colunas={colunasReforcos} linhas={dados}
        chave={r => `${r.brinco}-${r.produto}`} vazio={somenteAtrasados ? 'Nenhum reforço atrasado.' : 'Nenhuma dose programada.'} />}
    </EstadoDados>
  </>
}

const colunasCampanhas: Coluna<Campanha>[] = [
  { titulo: 'Brinco', valor: c => <strong>{c.brinco}</strong> },
  { titulo: 'Sexo', valor: c => c.sexo === 'F' ? 'Fêmea' : 'Macho' },
  { titulo: 'Idade', valor: c => plural(c.idade_meses, 'mês', 'meses'), alinhar: 'direita' },
  { titulo: 'Vacina', valor: c => c.produto },
  { titulo: 'Janela', valor: c => `${c.idade_min_meses ?? 0} a ${c.idade_max_meses ?? '—'} meses` },
  { titulo: 'Vacinar até', valor: c => <span className="etiqueta etiqueta--alerta">{formatarData(c.prazo_final)}</span> },
]

function Campanhas() {
  const { dados, ...estado } = useDados<Campanha[]>('/consultas/campanhas')
  return <>
    <Descricao titulo="Vacinação obrigatória pendente">
      Animais que estão na faixa de idade de uma vacina com janela (como a brucelose em fêmeas de 3 a 8 meses) e ainda não a receberam.
    </Descricao>
    <EstadoDados {...estado}>
      {dados && <Tabela legenda="Vacinação obrigatória pendente" colunas={colunasCampanhas} linhas={dados}
        chave={c => `${c.brinco}-${c.produto}`} vazio="Nenhuma vacinação pendente." />}
    </EstadoDados>
  </>
}

function Descricao({ titulo, children }: { titulo: string; children: string }) {
  return <div className="consulta__descricao"><h2>{titulo}</h2><p>{children}</p></div>
}
