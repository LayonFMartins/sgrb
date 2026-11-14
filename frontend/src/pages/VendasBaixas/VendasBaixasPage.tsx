import { useState } from 'react'
import { usePermissions } from '../../auth/permissions'
import { LinkAnimal } from '../../components/animais/LinkAnimal'
import { CampoBusca } from '../../components/cadastro/CampoBusca'
import { LinkFicha } from '../../components/cadastro/LinkFicha'
import { AvisoSucesso } from '../../components/ui/AvisoSucesso'
import { EstadoDados } from '../../components/ui/EstadoDados'
import { Tabela, type Coluna } from '../../components/ui/Tabela'
import { Vazio } from '../../components/ui/Vazio'
import { useAvisoSucesso } from '../../hooks/useAvisoSucesso'
import { useDados } from '../../hooks/useDados'
import { useParametro } from '../../hooks/useParametro'
import type { Animal } from '../../types/animais'
import type { Saida } from '../../types/baixas'
import type { Carencia } from '../../types/consultas'
import { combina } from '../../utils/busca'
import { formatarData, formatarNumero, formatarPeso, plural } from '../../utils/formatar'
import { FormObito } from './FormObito'
import { FormVenda, type VendaRegistrada } from './FormVenda'
import '../../components/cadastro/Cadastro.css'
import '../Compras/Compras.css'
import '../Relatorios/Relatorios.css'
import './VendasBaixas.css'

type Aba = 'saidas' | 'venda' | 'obito'
type Filtro = 'TODAS' | 'VENDA' | 'OBITO'

const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: 'TODAS', rotulo: 'Todas' },
  { id: 'VENDA', rotulo: 'Vendas' },
  { id: 'OBITO', rotulo: 'Óbitos' },
]
const FINALIDADE: Record<string, string> = { ABATE: 'Abate', ENGORDA: 'Engorda', RECRIA: 'Recria', CRIA: 'Cria' }
const CHAVE_DESTINO_COMPRAS = 'sgrb.compras.destino' // o mesmo que a tela de Compras guarda
const real = (valor: number) => `R$ ${formatarNumero(valor, 2)}`

function lerFazenda() {
  try { return localStorage.getItem(CHAVE_DESTINO_COMPRAS) ?? '' } catch { return '' }
}

// Vendas e baixas: registrar venda (com GTA de saída), registrar óbito e consultar as saídas.
// As abas ficam no endereço (/vendas-baixas?aba=venda), igual aos Relatórios.
export function VendasBaixasPage() {
  const { pode } = usePermissions()
  const [abaPedida, setAba] = useParametro('aba', 'saidas')
  const abas: { id: Aba; rotulo: string }[] = [
    { id: 'saidas', rotulo: 'Saídas registradas' },
    ...(pode('vendas.criar') ? [{ id: 'venda' as const, rotulo: 'Registrar venda' }] : []),
    ...(pode('obitos.criar') ? [{ id: 'obito' as const, rotulo: 'Registrar óbito' }] : []),
  ]
  const aba: Aba = abas.some(a => a.id === abaPedida) ? abaPedida as Aba : 'saidas'

  // Dados compartilhados: as listas recarregam depois de cada registro.
  const saidas = useDados<Saida[]>('/baixas')
  const animais = useDados<Animal[]>('/animais?situacao=Ativo')
  const carencia = useDados<Carencia[]>('/consultas/carencia')
  const gtasEntrada = useDados<{ destino: string }[]>('/gta?tipo=ENTRADA') // mais recente primeiro
  const sucesso = useAvisoSucesso()
  const [registrada, setRegistrada] = useState<VendaRegistrada | null>(null)

  // Origem da GTA de saída = a fazenda: o destino que a tela de Compras lembra,
  // ou o destino da GTA de entrada mais recente.
  const origemFazenda = lerFazenda() || gtasEntrada.dados?.[0]?.destino || ''
  const mapaCarencia = new Map<string, string>((carencia.dados ?? []).map(c => [c.brinco, c.data_liberacao.slice(0, 10)]))

  function depoisDeRegistrar(mensagem: string) {
    sucesso.mostrar(mensagem)
    saidas.recarregar()
    animais.recarregar()
    carencia.recarregar()
  }

  return <>
    <header className="page-heading">
      <h1>Vendas e baixas</h1>
      <p>Saídas do rebanho: vendas (com a GTA de saída) e óbitos. Depois de registrada, a saída não pode ser desfeita pela tela.</p>
    </header>

    <div className="abas vendas-abas" role="tablist" aria-label="Vendas e baixas">
      {abas.map(a => <button key={a.id} id={`aba-${a.id}`} type="button" role="tab"
        aria-selected={aba === a.id} aria-controls="painel-vendas"
        className={`abas__botao${aba === a.id ? ' abas__botao--ativa' : ''}`}
        onClick={() => setAba(a.id)}>{a.rotulo}</button>)}
    </div>

    <div id="painel-vendas" role="tabpanel" aria-labelledby={`aba-${aba}`}>
      {aba === 'saidas' && <ListaSaidas saidas={saidas} onRegistrarVenda={() => setAba('venda')} />}

      {aba === 'venda' && <>
        {registrada && <section className="content-card compra-registrada" aria-label="Última venda registrada">
          <h2>Venda registrada</h2>
          <p>{plural(registrada.brincos.length, 'animal', 'animais')} para {registrada.comprador} em {formatarData(registrada.data)},
            com a GTA <strong>{registrada.numero_gta}</strong>:</p>
          <p className="compra-registrada__brincos">{registrada.brincos.map(b => <LinkAnimal key={b} brinco={b} />)}</p>
        </section>}
        <EstadoDados carregando={animais.carregando || carencia.carregando} erro={animais.erro || carencia.erro}
          recarregar={() => { animais.recarregar(); carencia.recarregar() }}>
          <FormVenda animais={animais.dados ?? []} carencia={mapaCarencia} origemFazenda={origemFazenda}
            onRegistrada={v => { setRegistrada(v); depoisDeRegistrar(v.mensagem) }} />
        </EstadoDados>
      </>}

      {aba === 'obito' && <EstadoDados carregando={animais.carregando} erro={animais.erro} recarregar={animais.recarregar}>
        <FormObito animais={animais.dados ?? []} onRegistrado={o => depoisDeRegistrar(o.mensagem)} />
      </EstadoDados>}
    </div>
    <AvisoSucesso {...sucesso} />
  </>
}

const colunas: Coluna<Saida>[] = [
  { titulo: 'Data', valor: s => formatarData(s.data_baixa), ordenar: s => s.data_baixa },
  { titulo: 'Animal', valor: s => <LinkAnimal brinco={s.brinco} />, csv: s => s.brinco },
  { titulo: 'Categoria', valor: s => `${s.categoria} · ${s.raca}` },
  { titulo: 'Saída', valor: s => s.motivo === 'VENDA'
    ? <span className="etiqueta etiqueta--ok">Venda{s.finalidade ? ` · ${FINALIDADE[s.finalidade] ?? s.finalidade}` : ''}</span>
    : <span className="etiqueta etiqueta--erro">Óbito</span> },
  { titulo: 'Comprador ou causa', valor: s => s.motivo === 'VENDA' ? s.comprador : s.causa },
  { titulo: 'Peso final', valor: s => formatarPeso(s.peso_final_kg), ordenar: s => s.peso_final_kg, alinhar: 'direita' },
  { titulo: 'Valor', valor: s => s.valor_venda === null ? '—' : real(s.valor_venda), ordenar: s => s.valor_venda, alinhar: 'direita' },
  { titulo: 'GTA', valor: s => s.numero_gta
    ? <LinkFicha para={`/gta?busca=${encodeURIComponent(s.numero_gta)}`} titulo={`Ver a GTA ${s.numero_gta}`}>{s.numero_gta}</LinkFicha>
    : '—', csv: s => s.numero_gta },
]

function ListaSaidas({ saidas, onRegistrarVenda }: {
  saidas: ReturnType<typeof useDados<Saida[]>>
  onRegistrarVenda: () => void
}) {
  const { dados, ...estado } = saidas
  const [filtroPedido, setFiltro] = useParametro('motivo', 'TODAS')
  const filtro = (FILTROS.some(f => f.id === filtroPedido) ? filtroPedido : 'TODAS') as Filtro
  const [busca, setBusca] = useParametro('busca')

  const todas = dados ?? []
  const total = (id: Filtro) => id === 'TODAS' ? todas.length : todas.filter(s => s.motivo === id).length
  const visiveis = todas.filter(s => (filtro === 'TODAS' || s.motivo === filtro) &&
    combina(busca, s.brinco, s.raca, s.categoria, s.comprador, s.causa, s.numero_gta))
  const vendas = visiveis.filter(s => s.motivo === 'VENDA')
  const receita = vendas.reduce((soma, s) => soma + (s.valor_venda ?? 0), 0)

  return <section className="content-card vendas-painel" aria-label="Saídas registradas">
    <div className="cadastro-filtros-linha">
      <div className="seletor" role="group" aria-label="Filtrar por tipo de saída">
        {FILTROS.map(f => <button key={f.id} type="button" aria-pressed={filtro === f.id}
          className={`seletor__botao${filtro === f.id ? ' seletor__botao--ativo' : ''}`}
          onClick={() => setFiltro(f.id)}>{f.rotulo} <span className="seletor__qtd">{total(f.id)}</span></button>)}
      </div>
      <CampoBusca valor={busca} onChange={setBusca} placeholder="Brinco, comprador, causa ou GTA" />
    </div>
    {vendas.length > 0 && <p className="venda-resumo">
      <span><strong>{plural(vendas.length, 'animal vendido', 'animais vendidos')}</strong></span>
      <span>receita <strong>{real(receita)}</strong></span>
      <span>média <strong>{real(receita / vendas.length)}</strong> por animal</span>
    </p>}
    <EstadoDados {...estado}>
      {dados && <Tabela legenda="Saídas registradas" colunas={colunas} linhas={visiveis} chave={s => String(s.id_baixa)}
        vazio={<Vazio busca={busca} onLimparBusca={() => setBusca('')} titulo="Nenhuma saída registrada"
          texto="As vendas e os óbitos aparecem aqui depois de registrados."
          acao={{ rotulo: 'Registrar venda', permissao: 'vendas.criar', onClick: onRegistrarVenda }} />} />}
    </EstadoDados>
  </section>
}
