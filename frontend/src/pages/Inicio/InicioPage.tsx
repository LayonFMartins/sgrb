import { Link } from 'react-router-dom'
import { CalendarClock, ShieldAlert, Syringe } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import { usePermissions } from '../../auth/permissions'
import { useDados } from '../../hooks/useDados'
import { EstadoDados } from '../../components/ui/EstadoDados'
import { LinkAnimal } from '../../components/animais/LinkAnimal'
import { LotacaoPiquetes } from '../../components/consultas/LotacaoPiquetes'
import type { Painel } from '../../types/consultas'
import { formatarData, plural } from '../../utils/formatar'
import './Inicio.css'

export function InicioPage() {
  const { usuario } = useAuth()
  const { pode } = usePermissions()
  const { dados, carregando, erro, recarregar } = useDados<Painel>('/consultas/painel')
  const verRelatorios = pode('consultas.visualizar')

  return <>
    <header className="page-heading">
      <h1>Bem-vindo(a), {usuario?.nome}</h1>
      <p>Resumo do rebanho e dos alertas de manejo de hoje.</p>
    </header>

    <EstadoDados carregando={carregando} erro={erro} recarregar={recarregar}>
      {dados && <div className="painel">
        <section className="painel-numeros" aria-label="Resumo do rebanho">
          <article className="painel-rebanho">
            <h2>Rebanho ativo</h2>
            <strong>{dados.rebanho.ativos}</strong>
            <p>{dados.rebanho.por_categoria.map(c => `${c.total} ${nomeCategoria(c.categoria, c.total)}`).join(' · ') || 'Nenhum animal ativo'}</p>
          </article>
          <Indicador icone={ShieldAlert} titulo="Em carência" valor={dados.carencia.length}
            texto="não podem ser vendidos para abate" aba="carencia" ativo={verRelatorios} />
          <Indicador icone={CalendarClock} titulo="Reforços atrasados" valor={dados.reforcos_atrasados.length}
            texto="doses vencidas" aba="reforcos" ativo={verRelatorios} />
          <Indicador icone={Syringe} titulo="Vacinação pendente" valor={dados.campanhas_pendentes.length}
            texto="na janela de vacinação obrigatória" aba="campanhas" ativo={verRelatorios} />
        </section>

        <section className="content-card painel-secao" aria-labelledby="titulo-piquetes">
          <div className="painel-secao__topo">
            <h2 id="titulo-piquetes">Lotação dos piquetes</h2>
            {verRelatorios && <Link to="/relatorios?aba=lotacao">Ver detalhes</Link>}
          </div>
          <LotacaoPiquetes piquetes={dados.piquetes} />
        </section>

        <div className="painel-alertas">
          <ListaAlertas titulo="Vacinação obrigatória pendente" vazio="Nenhuma vacinação pendente."
            itens={dados.campanhas_pendentes.map(c => ({
              chave: `${c.brinco}-${c.produto}`, brinco: c.brinco, texto: c.produto,
              detalhe: `vacinar até ${formatarData(c.prazo_final)}`, tom: 'alerta' as const,
            }))} />
          <ListaAlertas titulo="Reforços atrasados" vazio="Nenhum reforço atrasado."
            itens={dados.reforcos_atrasados.map(r => ({
              chave: `${r.brinco}-${r.produto}`, brinco: r.brinco, texto: r.produto,
              detalhe: `${plural(r.dias_atraso, 'dia', 'dias')} de atraso`, tom: 'erro' as const,
            }))} />
          <ListaAlertas titulo="Animais em carência" vazio="Nenhum animal em carência."
            itens={dados.carencia.map(c => ({
              chave: c.brinco, brinco: c.brinco, texto: c.produto,
              detalhe: `liberado em ${formatarData(c.data_liberacao)}`, tom: 'neutra' as const,
            }))} />
        </div>
      </div>}
    </EstadoDados>
  </>
}

function Indicador({ icone: Icone, titulo, valor, texto, aba, ativo }: {
  icone: LucideIcon; titulo: string; valor: number; texto: string; aba: string; ativo: boolean
}) {
  const conteudo = <>
    <h2><Icone size={18} aria-hidden="true" />{titulo}</h2>
    <strong>{valor}</strong>
    <p>{valor === 1 ? texto.replace('doses vencidas', 'dose vencida') : texto}</p>
  </>
  const classe = `painel-indicador${valor > 0 ? ' painel-indicador--atencao' : ''}`
  return ativo
    ? <Link className={classe} to={`/relatorios?aba=${aba}`}>{conteudo}</Link>
    : <article className={classe}>{conteudo}</article>
}

const LIMITE = 5

const PLURAL_CATEGORIA: Record<string, string> = {
  Bezerro: 'bezerros', Bezerra: 'bezerras', Garrote: 'garrotes',
  Novilha: 'novilhas', Boi: 'bois', Vaca: 'vacas',
}

function nomeCategoria(categoria: string, total: number) {
  return total === 1 ? categoria.toLocaleLowerCase('pt-BR') : PLURAL_CATEGORIA[categoria] ?? categoria.toLocaleLowerCase('pt-BR')
}

function ListaAlertas({ titulo, vazio, itens }: {
  titulo: string
  vazio: string
  itens: { chave: string; brinco: string; texto: string; detalhe: string; tom: 'alerta' | 'erro' | 'neutra' }[]
}) {
  return <section className="content-card painel-lista" aria-label={titulo}>
    <h2>{titulo} <span className="painel-lista__qtd">{itens.length}</span></h2>
    {itens.length === 0
      ? <p className="painel-lista__vazio">{vazio}</p>
      : <ul>
        {itens.slice(0, LIMITE).map(i => <li key={i.chave}>
          <LinkAnimal brinco={i.brinco} className="painel-lista__brinco" />
          <span className="painel-lista__texto">{i.texto}</span>
          <span className={`etiqueta etiqueta--${i.tom}`}>{i.detalhe}</span>
        </li>)}
        {itens.length > LIMITE && <li className="painel-lista__mais">e mais {itens.length - LIMITE}…</li>}
      </ul>}
  </section>
}
