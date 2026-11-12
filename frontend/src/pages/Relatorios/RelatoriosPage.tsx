import { useState, type FormEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useDados } from '../../hooks/useDados'
import { EstadoDados } from '../../components/ui/EstadoDados'
import { Input } from '../../components/ui/Input'
import { Tabela, type Coluna } from '../../components/ui/Tabela'
import { LinkAnimal } from '../../components/animais/LinkAnimal'
import { LotacaoPiquetes } from '../../components/consultas/LotacaoPiquetes'
import { AcoesImpressao, CabecalhoImpressao } from '../../components/relatorios/Impressao'
import type { Campanha, Carencia, GmdAnimal, GmdGrupo, Lote, Piquete, Rastreio, Reforco, ResultadoVenda } from '../../types/consultas'
import { baixarCsv, exportarTabela } from '../../utils/csv'
import { formatarData, formatarNumero, formatarPeso, plural } from '../../utils/formatar'
import './Relatorios.css'

const ABAS = [
  { id: 'lotacao', rotulo: 'Lotação' },
  { id: 'gmd', rotulo: 'Ganho de peso (GMD)' },
  { id: 'carencia', rotulo: 'Carência' },
  { id: 'reforcos', rotulo: 'Reforços' },
  { id: 'campanhas', rotulo: 'Vacinação obrigatória' },
  { id: 'rastreio', rotulo: 'Rastreio por lote' },
  { id: 'vendas', rotulo: 'Resultado das vendas' },
] as const
type Aba = typeof ABAS[number]['id']

export function RelatoriosPage() {
  const [params, setParams] = useSearchParams()
  const pedida = params.get('aba')
  const aba: Aba = ABAS.some(a => a.id === pedida) ? pedida as Aba : 'lotacao'

  return <>
    <header className="page-heading nao-imprimir">
      <h1>Relatórios e consultas</h1>
      <p>Informações calculadas a partir do histórico do rebanho.</p>
    </header>
    <div className="abas nao-imprimir" role="tablist" aria-label="Consultas">
      {ABAS.map(a => <button key={a.id} id={`aba-${a.id}`} type="button" role="tab"
        aria-selected={aba === a.id} aria-controls="painel-consulta"
        className={`abas__botao${aba === a.id ? ' abas__botao--ativa' : ''}`}
        onClick={() => setParams({ aba: a.id })}>{a.rotulo}</button>)}
    </div>
    <section id="painel-consulta" role="tabpanel" aria-labelledby={`aba-${aba}`}
      className={`content-card consulta${aba === 'vendas' || aba === 'rastreio' ? ' impressao-paisagem' : ''}`}>
      {/* Dentro do painel para sair na mesma página (os relatórios largos são impressos em paisagem) */}
      <CabecalhoImpressao titulo={`Relatório: ${ABAS.find(a => a.id === aba)?.rotulo}`} />
      {aba === 'lotacao' && <Lotacao />}
      {aba === 'gmd' && <Gmd />}
      {aba === 'carencia' && <CarenciaAba />}
      {aba === 'reforcos' && <Reforcos />}
      {aba === 'campanhas' && <Campanhas />}
      {aba === 'rastreio' && <RastreioLote />}
      {aba === 'vendas' && <Vendas />}
    </section>
  </>
}

// Título e explicação de cada relatório, com os botões de imprimir e exportar.
// "filtro" descreve no papel o que está selecionado na tela (os seletores não são impressos).
function Descricao({ titulo, children, onExportar, filtro, acoes = true }: {
  titulo: string
  children: ReactNode
  onExportar?: () => void
  filtro?: string
  acoes?: boolean
}) {
  return <div className="consulta__topo">
    <div className="consulta__descricao">
      <h2>{titulo}</h2>
      <p>{children}</p>
      {filtro && <p className="so-impressao consulta__filtro">{filtro}</p>}
    </div>
    {acoes && <AcoesImpressao rotuloImprimir="Imprimir relatório" onExportar={onExportar} />}
  </div>
}

function Seletor<T extends string>({ rotulo, opcoes, valor, onChange }: {
  rotulo: string
  opcoes: readonly (readonly [T, string])[]
  valor: T
  onChange: (valor: T) => void
}) {
  return <div className="seletor nao-imprimir" role="group" aria-label={rotulo}>
    {opcoes.map(([id, texto]) => <button key={id} type="button" aria-pressed={valor === id}
      className={`seletor__botao${valor === id ? ' seletor__botao--ativo' : ''}`}
      onClick={() => onChange(id)}>{texto}</button>)}
  </div>
}

const situacaoEtiqueta = (situacao: string) =>
  <span className={`etiqueta etiqueta--${situacao === 'Ativo' ? 'ok' : situacao === 'Óbito' ? 'erro' : 'neutra'}`}>{situacao}</span>

/* ---------- Lotação ---------- */

function Lotacao() {
  const { dados, ...estado } = useDados<Piquete[]>('/consultas/lotacao')
  const exportar = () => dados && baixarCsv('lotacao-piquetes',
    ['Piquete', 'Área (ha)', 'Capacidade', 'Animais', 'Ocupação (%)', 'Vagas', 'Situação', 'Liberado em'],
    dados.map(p => [p.nome, p.area_ha, p.capacidade_max, p.animais, p.ocupacao_pct, p.vagas, p.situacao, p.data_liberacao]))
  return <>
    <Descricao titulo="Lotação dos piquetes" onExportar={dados ? exportar : undefined}>
      Animais em cada piquete em relação à capacidade máxima. Um piquete que fica vazio entra em descanso pelo período mínimo cadastrado.
    </Descricao>
    <EstadoDados {...estado}>{dados && <LotacaoPiquetes piquetes={dados} />}</EstadoDados>
  </>
}

/* ---------- GMD ---------- */

const colunasGmdAnimal: Coluna<GmdAnimal>[] = [
  { titulo: '#', valor: g => g.posicao, alinhar: 'direita' },
  { titulo: 'Brinco', valor: g => <LinkAnimal brinco={g.brinco} />, csv: g => g.brinco },
  { titulo: 'Raça', valor: g => g.raca },
  { titulo: 'Categoria', valor: g => g.categoria },
  { titulo: 'Origem', valor: g => g.fornecedor ?? 'Nascido na fazenda' },
  { titulo: 'Peso inicial', valor: g => formatarPeso(g.peso_inicial), alinhar: 'direita', csv: g => g.peso_inicial },
  { titulo: 'Peso final', valor: g => formatarPeso(g.peso_final), alinhar: 'direita', csv: g => g.peso_final },
  { titulo: 'Período', valor: g => plural(g.dias, 'dia', 'dias'), alinhar: 'direita', csv: g => g.dias },
  { titulo: 'GMD (kg/dia)', valor: g => <strong>{formatarNumero(g.gmd_kg_dia, 3)}</strong>, alinhar: 'direita', csv: g => g.gmd_kg_dia },
  { titulo: 'Situação', valor: g => situacaoEtiqueta(g.situacao), csv: g => g.situacao },
]

const AGRUPAMENTOS = [['animal', 'Por animal'], ['raca', 'Por raça'], ['fornecedor', 'Por fornecedor']] as const
type Agrupamento = typeof AGRUPAMENTOS[number][0]

function Gmd() {
  const [agrupar, setAgrupar] = useState<Agrupamento>('animal')
  const [periodo, setPeriodo] = useState({ inicio: '', fim: '' })
  const periodoInvalido = Boolean(periodo.inicio && periodo.fim && periodo.inicio > periodo.fim)
  const consulta = new URLSearchParams({ agrupar })
  if (!periodoInvalido) {
    if (periodo.inicio) consulta.set('inicio', periodo.inicio)
    if (periodo.fim) consulta.set('fim', periodo.fim)
  }
  const { dados, ...estado } = useDados<GmdAnimal[] | GmdGrupo[]>(`/consultas/gmd?${consulta}`)

  const textoPeriodo = periodo.inicio || periodo.fim
    ? `Pesagens de ${periodo.inicio ? formatarData(periodo.inicio) : 'início'} a ${periodo.fim ? formatarData(periodo.fim) : 'hoje'}`
    : 'Todas as pesagens'
  const rotuloGrupo = AGRUPAMENTOS.find(a => a[0] === agrupar)?.[1] ?? ''
  const colunasGrupo = colunasGmdGrupo(agrupar)
  const exportar = () => {
    if (!dados) return
    const nome = `gmd-${agrupar}${periodo.inicio ? `-${periodo.inicio}` : ''}${periodo.fim ? `-a-${periodo.fim}` : ''}`
    if (agrupar === 'animal') exportarTabela(nome, colunasGmdAnimal, dados as GmdAnimal[])
    else exportarTabela(nome, colunasGrupo, dados as GmdGrupo[])
  }

  return <>
    <Descricao titulo="Ranking de ganho médio diário" onExportar={dados ? exportar : undefined}
      filtro={`${rotuloGrupo} · ${textoPeriodo}`}>
      Ganho de peso por dia entre a primeira e a última pesagem do período, considerando animais em crescimento (menos de 24 meses na primeira pesagem).
    </Descricao>
    <div className="consulta__filtros nao-imprimir">
      <Seletor rotulo="Agrupar ranking por" opcoes={AGRUPAMENTOS} valor={agrupar} onChange={setAgrupar} />
      <div className="consulta__periodo">
        <Input label="De" type="date" value={periodo.inicio} max={periodo.fim || undefined}
          onChange={e => setPeriodo(p => ({ ...p, inicio: e.target.value }))} />
        <Input label="Até" type="date" value={periodo.fim} min={periodo.inicio || undefined}
          onChange={e => setPeriodo(p => ({ ...p, fim: e.target.value }))} />
        {(periodo.inicio || periodo.fim) && <button type="button" className="acao-linha consulta__limpar"
          onClick={() => setPeriodo({ inicio: '', fim: '' })}>Todo o período</button>}
      </div>
    </div>
    {periodoInvalido
      ? <p className="cadastro-form__erro" role="alert">A data inicial precisa ser anterior à final.</p>
      : <EstadoDados {...estado}>
        {dados && (agrupar === 'animal'
          ? <Tabela legenda="Ranking de GMD por animal" colunas={colunasGmdAnimal} linhas={dados as GmdAnimal[]}
            chave={g => g.brinco} vazio="Nenhum animal com duas pesagens ou mais neste período." />
          : <Tabela legenda={`GMD médio ${rotuloGrupo.toLocaleLowerCase('pt-BR')}`} colunas={colunasGrupo}
            linhas={dados as GmdGrupo[]} chave={g => g.grupo} vazio="Ainda não há dados para este agrupamento." />)}
      </EstadoDados>}
  </>
}

function colunasGmdGrupo(agrupar: Agrupamento): Coluna<GmdGrupo>[] {
  return [
    { titulo: agrupar === 'raca' ? 'Raça' : 'Fornecedor', valor: g => <strong>{g.grupo}</strong>, csv: g => g.grupo },
    { titulo: 'Animais', valor: g => g.animais, alinhar: 'direita' },
    { titulo: 'GMD médio (kg/dia)', valor: g => <strong>{formatarNumero(g.gmd_medio_kg_dia, 3)}</strong>, alinhar: 'direita', csv: g => g.gmd_medio_kg_dia },
  ]
}

/* ---------- Carência ---------- */

const colunasCarencia: Coluna<Carencia>[] = [
  { titulo: 'Brinco', valor: c => <LinkAnimal brinco={c.brinco} />, csv: c => c.brinco },
  { titulo: 'Produto', valor: c => c.produto },
  { titulo: 'Aplicado em', valor: c => formatarData(c.data_aplicacao), csv: c => c.data_aplicacao },
  { titulo: 'Carência', valor: c => plural(c.carencia_dias, 'dia', 'dias'), alinhar: 'direita', csv: c => c.carencia_dias },
  { titulo: 'Liberado para abate em', valor: c => <strong>{formatarData(c.data_liberacao)}</strong>, csv: c => c.data_liberacao },
  { titulo: 'Faltam', valor: c => <span className="etiqueta etiqueta--alerta">{plural(c.dias_restantes, 'dia', 'dias')}</span>, csv: c => c.dias_restantes },
]

function CarenciaAba() {
  const { dados, ...estado } = useDados<Carencia[]>('/consultas/carencia')
  return <>
    <Descricao titulo="Animais em carência" onExportar={dados ? () => exportarTabela('carencia', colunasCarencia, dados) : undefined}>
      Animais que receberam produtos com período de carência ainda em curso. Eles não podem ser vendidos para abate até a data de liberação.
    </Descricao>
    <EstadoDados {...estado}>
      {dados && <Tabela legenda="Animais em carência" colunas={colunasCarencia} linhas={dados}
        chave={c => c.brinco} vazio="Nenhum animal em carência no momento." />}
    </EstadoDados>
  </>
}

/* ---------- Reforços ---------- */

const colunasReforcos: Coluna<Reforco>[] = [
  { titulo: 'Brinco', valor: r => <LinkAnimal brinco={r.brinco} />, csv: r => r.brinco },
  { titulo: 'Produto', valor: r => r.produto },
  { titulo: 'Última dose', valor: r => `${r.ultima_dose}ª em ${formatarData(r.data_ultima_dose)}` },
  { titulo: 'Próxima dose', valor: r => formatarData(r.data_proxima_dose), csv: r => r.data_proxima_dose },
  { titulo: 'Situação', valor: r => r.situacao === 'Atrasado'
    ? <span className="etiqueta etiqueta--erro">{plural(r.dias_atraso, 'dia', 'dias')} de atraso</span>
    : <span className="etiqueta etiqueta--ok">Em dia</span>,
    csv: r => r.situacao === 'Atrasado' ? `${r.dias_atraso} dias de atraso` : 'Em dia' },
]

function Reforcos() {
  const [filtro, setFiltro] = useState<'atrasados' | 'todos'>('atrasados')
  const { dados, ...estado } = useDados<Reforco[]>(`/consultas/reforcos${filtro === 'atrasados' ? '?situacao=Atrasado' : ''}`)
  return <>
    <Descricao titulo="Reforços e próximas doses" filtro={filtro === 'atrasados' ? 'Somente atrasados' : 'Todas as doses programadas'}
      onExportar={dados ? () => exportarTabela(`reforcos-${filtro}`, colunasReforcos, dados) : undefined}>
      Próxima dose de cada produto: a dose seguinte do protocolo (vacinas de mais de uma dose) ou o reforço periódico (ex.: anual).
    </Descricao>
    <Seletor rotulo="Filtrar reforços" valor={filtro} onChange={setFiltro}
      opcoes={[['atrasados', 'Atrasados'], ['todos', 'Todos']] as const} />
    <EstadoDados {...estado}>
      {dados && <Tabela legenda="Reforços" colunas={colunasReforcos} linhas={dados}
        chave={r => `${r.brinco}-${r.produto}`} vazio={filtro === 'atrasados' ? 'Nenhum reforço atrasado.' : 'Nenhuma dose programada.'} />}
    </EstadoDados>
  </>
}

/* ---------- Vacinação obrigatória ---------- */

const colunasCampanhas: Coluna<Campanha>[] = [
  { titulo: 'Brinco', valor: c => <LinkAnimal brinco={c.brinco} />, csv: c => c.brinco },
  { titulo: 'Sexo', valor: c => c.sexo === 'F' ? 'Fêmea' : 'Macho' },
  { titulo: 'Idade', valor: c => plural(c.idade_meses, 'mês', 'meses'), alinhar: 'direita', csv: c => c.idade_meses },
  { titulo: 'Vacina', valor: c => c.produto },
  { titulo: 'Janela', valor: c => `${c.idade_min_meses ?? 0} a ${c.idade_max_meses ?? '—'} meses` },
  { titulo: 'Vacinar até', valor: c => <span className="etiqueta etiqueta--alerta">{formatarData(c.prazo_final)}</span>, csv: c => c.prazo_final },
]

function Campanhas() {
  const { dados, ...estado } = useDados<Campanha[]>('/consultas/campanhas')
  return <>
    <Descricao titulo="Vacinação obrigatória pendente"
      onExportar={dados ? () => exportarTabela('vacinacao-pendente', colunasCampanhas, dados) : undefined}>
      Animais que estão na faixa de idade de uma vacina com janela (como a brucelose em fêmeas de 3 a 8 meses) e ainda não a receberam.
    </Descricao>
    <EstadoDados {...estado}>
      {dados && <Tabela legenda="Vacinação obrigatória pendente" colunas={colunasCampanhas} linhas={dados}
        chave={c => `${c.brinco}-${c.produto}`} vazio="Nenhuma vacinação pendente." />}
    </EstadoDados>
  </>
}

/* ---------- Rastreio por lote ---------- */

const colunasRastreio: Coluna<Rastreio>[] = [
  { titulo: 'Brinco', valor: r => <LinkAnimal brinco={r.brinco} />, csv: r => r.brinco },
  { titulo: 'Raça', valor: r => r.raca },
  { titulo: 'Aplicação', valor: r => <span className="sem-quebra">{formatarData(r.data_aplicacao)} · {r.num_dose}ª dose</span>, csv: r => r.data_aplicacao },
  { titulo: 'Dose', valor: r => r.num_dose, alinhar: 'direita' },
  { titulo: 'Responsável', valor: r => r.responsavel },
  { titulo: 'Situação', valor: r => situacaoEtiqueta(r.situacao), csv: r => r.situacao },
  { titulo: 'Onde está', valor: r => onde(r), csv: r => ondeTexto(r) },
]
// "Dose" separada só vai para o CSV; na tela ela já aparece junto da data.
const colunasRastreioTela = colunasRastreio.filter(c => c.titulo !== 'Dose')

function ondeTexto(r: Rastreio) {
  if (r.situacao === 'Ativo') return r.piquete_atual ? `Na fazenda: ${r.piquete_atual}` : 'Na fazenda, sem piquete'
  if (r.situacao === 'Vendido') return `Vendido em ${formatarData(r.data_baixa)} para ${r.destino_final}` +
    (r.gta_saida ? ` (GTA ${r.gta_saida}, destino ${r.destino_gta})` : '')
  return `${r.destino_final ?? 'Óbito'} em ${formatarData(r.data_baixa)}`
}

function onde(r: Rastreio) {
  if (r.situacao !== 'Vendido') return ondeTexto(r)
  return <span className="rastreio-destino">
    <span>Vendido em {formatarData(r.data_baixa)} para <strong>{r.destino_final}</strong></span>
    {r.gta_saida && <span className="texto-secundario">GTA {r.gta_saida} → {r.destino_gta}</span>}
  </span>
}

function RastreioLote() {
  const [params, setParams] = useSearchParams()
  const lote = params.get('lote') ?? ''
  const [digitado, setDigitado] = useState(lote)
  const lotes = useDados<Lote[]>('/consultas/lotes')

  function rastrear(valor: string) {
    const limpo = valor.trim().toUpperCase()
    setDigitado(limpo)
    setParams(limpo ? { aba: 'rastreio', lote: limpo } : { aba: 'rastreio' })
  }
  function enviar(e: FormEvent) {
    e.preventDefault()
    rastrear(digitado)
  }

  return <>
    <Descricao titulo="Rastreio por lote de medicamento" acoes={false}>
      Informe o lote de um produto sanitário para ver todos os animais que o receberam, quem aplicou e onde cada animal está hoje.
      Se o fabricante recolher um lote, esta consulta mostra na hora quem foi afetado e, para os que já saíram, para onde foram.
    </Descricao>
    <form className="rastreio-busca nao-imprimir" onSubmit={enviar}>
      <Input label="Lote do medicamento" value={digitado} list="lotes-aplicados" placeholder="Ex.: IVM-25-0815"
        icon={<Search size={16} />} onChange={e => setDigitado(e.target.value)} />
      <datalist id="lotes-aplicados">
        {lotes.dados?.map(l => <option key={l.lote} value={l.lote}>{l.produto}</option>)}
      </datalist>
      <button type="submit" className="botao-secundario">Rastrear</button>
    </form>
    {lote
      ? <ResultadoRastreio key={lote} lote={lote} />
      : <EstadoDados {...lotes}>
        {lotes.dados && <ListaLotes lotes={lotes.dados} onEscolher={rastrear} />}
      </EstadoDados>}
  </>
}

function ListaLotes({ lotes, onEscolher }: { lotes: Lote[]; onEscolher: (lote: string) => void }) {
  const colunas: Coluna<Lote>[] = [
    { titulo: 'Lote', valor: l => <button type="button" className="link-botao" onClick={() => onEscolher(l.lote)}>{l.lote}</button> },
    { titulo: 'Produto', valor: l => l.produto },
    { titulo: 'Animais', valor: l => l.animais, alinhar: 'direita' },
    { titulo: 'Aplicações', valor: l => l.primeira_aplicacao === l.ultima_aplicacao
      ? formatarData(l.primeira_aplicacao)
      : `${formatarData(l.primeira_aplicacao)} a ${formatarData(l.ultima_aplicacao)}` },
  ]
  return <div className="rastreio-lotes">
    <h3>Lotes aplicados no rebanho</h3>
    <Tabela legenda="Lotes aplicados" colunas={colunas} linhas={lotes} chave={l => `${l.lote}-${l.produto}`}
      vazio="Nenhuma aplicação registrada ainda." />
  </div>
}

function ResultadoRastreio({ lote }: { lote: string }) {
  const { dados, ...estado } = useDados<Rastreio[]>(`/consultas/rastreio?lote=${encodeURIComponent(lote)}`)
  return <EstadoDados {...estado}>
    {dados && (dados.length === 0
      ? <p className="tabela-vazia">Nenhuma aplicação do lote {lote}. Confira o número impresso na embalagem.</p>
      : <ResumoRastreio lote={lote} linhas={dados} />)}
  </EstadoDados>
}

function ResumoRastreio({ lote, linhas }: { lote: string; linhas: Rastreio[] }) {
  const animais = new Map(linhas.map(r => [r.brinco, r]))
  const fora = [...animais.values()].filter(r => r.situacao !== 'Ativo').length
  return <>
    <div className="rastreio-resumo">
      <div>
        <h3>Lote {lote}</h3>
        <p>
          {[...new Set(linhas.map(r => r.produto))].join(', ')} · {plural(linhas.length, 'aplicação', 'aplicações')} em{' '}
          {plural(animais.size, 'animal', 'animais')}
          {fora > 0 && <> · <strong>{plural(fora, 'animal já saiu', 'animais já saíram')} da fazenda</strong></>}
        </p>
      </div>
      <AcoesImpressao rotuloImprimir="Imprimir rastreio"
        onExportar={() => exportarTabela(`rastreio-${lote}`, colunasRastreio, linhas)} />
    </div>
    <Tabela legenda={`Animais que receberam o lote ${lote}`} colunas={colunasRastreioTela} linhas={linhas}
      chave={(r, i) => `${r.brinco}-${r.data_aplicacao}-${i}`} vazio="" />
  </>
}

/* ---------- Resultado das vendas ---------- */

const real = (valor: number | null) => valor === null ? '—' : `R$ ${formatarNumero(valor, 2)}`

const colunasVendas: Coluna<ResultadoVenda>[] = [
  { titulo: 'Brinco', valor: v => <LinkAnimal brinco={v.brinco} />, csv: v => v.brinco },
  { titulo: 'Raça', valor: v => v.raca },
  { titulo: 'Origem', valor: v => v.fornecedor ?? 'Nascido na fazenda' },
  { titulo: 'Venda', valor: v => <span className="sem-quebra">{formatarData(v.data_venda)}</span>, csv: v => v.data_venda },
  { titulo: 'Comprador', valor: v => v.comprador },
  { titulo: 'Na fazenda', valor: v => plural(v.dias_na_fazenda, 'dia', 'dias'), alinhar: 'direita', csv: v => v.dias_na_fazenda },
  { titulo: 'Ganho de peso', valor: v => v.ganho_kg === null ? '—' : `+${formatarPeso(v.ganho_kg)}`, alinhar: 'direita', csv: v => v.ganho_kg },
  { titulo: 'Custo de compra', valor: v => v.valor_compra === null ? 'Nascido aqui' : real(v.valor_compra), alinhar: 'direita', csv: v => v.valor_compra },
  { titulo: 'Valor de venda', valor: v => real(v.valor_venda), alinhar: 'direita', csv: v => v.valor_venda },
  { titulo: 'Margem bruta', valor: v => <strong className={v.margem_bruta < 0 ? 'valor-negativo' : undefined}>{real(v.margem_bruta)}</strong>,
    alinhar: 'direita', csv: v => v.margem_bruta },
  { titulo: 'R$/kg', valor: v => formatarNumero(v.valor_por_kg, 2), alinhar: 'direita', csv: v => v.valor_por_kg },
]

function Vendas() {
  const { dados, ...estado } = useDados<ResultadoVenda[]>('/consultas/vendas')
  return <>
    <Descricao titulo="Resultado das vendas" onExportar={dados?.length ? () => exportarTabela('resultado-vendas', colunasVendas, dados) : undefined}>
      Para cada animal vendido: quanto custou, por quanto foi vendido, quanto tempo ficou na fazenda e quanto peso ganhou.
      A margem bruta não inclui custos de manutenção (pasto, sal, medicamentos, mão de obra).
    </Descricao>
    <EstadoDados {...estado}>
      {dados && (dados.length === 0
        ? <p className="tabela-vazia">Nenhuma venda registrada ainda.</p>
        : <>
          <TotaisVendas vendas={dados} />
          <Tabela legenda="Resultado das vendas" colunas={colunasVendas} linhas={dados} chave={v => v.brinco} vazio="" />
        </>)}
    </EstadoDados>
  </>
}

function TotaisVendas({ vendas }: { vendas: ResultadoVenda[] }) {
  const soma = (f: (v: ResultadoVenda) => number | null) => vendas.reduce((t, v) => t + (f(v) ?? 0), 0)
  const receita = soma(v => v.valor_venda)
  const pesoVendido = soma(v => v.peso_saida)
  const itens = [
    { rotulo: 'Animais vendidos', valor: String(vendas.length) },
    { rotulo: 'Receita', valor: real(receita) },
    { rotulo: 'Margem bruta total', valor: real(soma(v => v.margem_bruta)) },
    { rotulo: 'Tempo médio na fazenda', valor: plural(Math.round(soma(v => v.dias_na_fazenda) / vendas.length), 'dia', 'dias') },
    { rotulo: 'Preço médio', valor: `R$ ${formatarNumero(receita / pesoVendido, 2)}/kg` },
  ]
  return <dl className="consulta-totais">
    {itens.map(i => <div key={i.rotulo}><dt>{i.rotulo}</dt><dd>{i.valor}</dd></div>)}
  </dl>
}
