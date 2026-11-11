import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CalendarClock, ShieldAlert, Syringe } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { EstadoDados } from '../../components/ui/EstadoDados'
import { Tabela, type Coluna } from '../../components/ui/Tabela'
import { useDados } from '../../hooks/useDados'
import type { AlertasAnimal, Cria, FichaAnimal as Ficha } from '../../types/animais'
import { formatarData, formatarNumero, formatarPeso, plural } from '../../utils/formatar'
import { GraficoPeso } from './GraficoPeso'
import { ETIQUETA_SITUACAO, idade, nomeSexo } from './animal'

const linkFicha = (brinco: string) => `/animais?ficha=${encodeURIComponent(brinco)}`

export function FichaAnimal({ brinco }: { brinco: string }) {
  const { dados: a, ...estado } = useDados<Ficha>(`/animais/${encodeURIComponent(brinco)}`)

  return <>
    <header className="page-heading">
      <Link to="/animais" className="ficha-voltar"><ArrowLeft size={16} aria-hidden="true" />Voltar para a lista</Link>
      <h1>Animal {brinco}</h1>
      {a && <p>{a.categoria} · {a.raca} · {idade(a.idade_meses)}{' '}
        <span className={`etiqueta etiqueta--${ETIQUETA_SITUACAO[a.situacao]}`}>{a.situacao}</span></p>}
    </header>

    <EstadoDados {...estado}>
      {a && <div className="ficha">
        <Alertas alertas={a.alertas} />

        <section className="content-card" aria-labelledby="ficha-dados">
          <h2 id="ficha-dados">Dados do animal</h2>
          <dl className="ficha-dados">
            <Dado rotulo="Brinco">{a.brinco}</Dado>
            <Dado rotulo="Sexo">{nomeSexo(a.sexo)}</Dado>
            <Dado rotulo="Raça">{a.raca}</Dado>
            <Dado rotulo="Nascimento">{formatarData(a.data_nascimento)}</Dado>
            <Dado rotulo="Idade">{idade(a.idade_meses)}</Dado>
            <Dado rotulo="Categoria">{a.categoria}</Dado>
            <Dado rotulo="Origem">{a.origem}</Dado>
            <Dado rotulo="Mãe">{a.brinco_mae ? <Link to={linkFicha(a.brinco_mae)}>{a.brinco_mae}</Link> : 'Não registrada'}</Dado>
            {a.origem === 'Compra' && <>
              <Dado rotulo="Fornecedor">{a.fornecedor}</Dado>
              <Dado rotulo="Compra">{formatarData(a.data_compra)} · R$ {formatarNumero(a.valor_compra, 2)}</Dado>
            </>}
            <Dado rotulo="Piquete atual">{a.piquete_atual ?? '—'}</Dado>
            <Dado rotulo="Último peso">{a.ultimo_peso_kg === null ? 'Sem pesagem'
              : `${formatarPeso(a.ultimo_peso_kg)} em ${formatarData(a.data_ultimo_peso)}`}</Dado>
            {a.data_baixa && <Dado rotulo="Data da baixa">{formatarData(a.data_baixa)}</Dado>}
          </dl>
        </section>

        <section className="content-card" aria-labelledby="ficha-peso">
          <h2 id="ficha-peso">Evolução do peso</h2>
          <GraficoPeso pesagens={a.pesagens} />
        </section>

        {a.sexo === 'F' && <Crias brinco={a.brinco} />}

        <section className="content-card" aria-labelledby="ficha-historico">
          <h2 id="ficha-historico">Linha do tempo</h2>
          {a.historico.length === 0
            ? <p className="tabela-vazia">Nenhum evento registrado.</p>
            : <ol className="linha-tempo">
              {a.historico.map((h, i) => <li key={i}>
                <time dateTime={h.data}>{formatarData(h.data)}</time>
                <div>
                  <strong>{h.evento}</strong>
                  {h.detalhe && <p>{h.detalhe}</p>}
                </div>
              </li>)}
            </ol>}
        </section>
      </div>}
    </EstadoDados>
  </>
}

function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return <div><dt>{rotulo}</dt><dd>{children}</dd></div>
}

const colunasCrias: Coluna<Cria>[] = [
  { titulo: 'Brinco', valor: c => <Link className="animal-link" to={linkFicha(c.brinco)}>{c.brinco}</Link> },
  { titulo: 'Sexo', valor: c => nomeSexo(c.sexo) },
  { titulo: 'Nascimento', valor: c => formatarData(c.data_nascimento) },
  { titulo: 'Categoria', valor: c => c.categoria },
  { titulo: 'Situação', valor: c => <span className={`etiqueta etiqueta--${ETIQUETA_SITUACAO[c.situacao]}`}>{c.situacao}</span> },
]

function Crias({ brinco }: { brinco: string }) {
  const { dados, ...estado } = useDados<Cria[]>(`/animais/${encodeURIComponent(brinco)}/crias`)
  return <section className="content-card" aria-labelledby="ficha-crias">
    <h2 id="ficha-crias">Crias</h2>
    <EstadoDados {...estado}>
      {dados && <Tabela legenda={`Crias de ${brinco}`} colunas={colunasCrias} linhas={dados}
        chave={c => c.brinco} vazio="Nenhuma cria registrada." />}
    </EstadoDados>
  </section>
}

// Faixa no topo da ficha com o que precisa de atenção neste animal.
function Alertas({ alertas }: { alertas: AlertasAnimal }) {
  const itens: { chave: string; icone: LucideIcon; tom: 'alerta' | 'erro'; titulo: string; texto: string }[] = [
    ...alertas.carencia.map(c => ({
      chave: `carencia-${c.produto}`, icone: ShieldAlert, tom: 'alerta' as const,
      titulo: 'Em carência',
      texto: `${c.produto}: não pode ser vendido para abate até ${formatarData(c.data_liberacao)} (faltam ${plural(c.dias_restantes, 'dia', 'dias')}).`,
    })),
    ...alertas.reforcos_atrasados.map(r => ({
      chave: `reforco-${r.produto}`, icone: CalendarClock, tom: 'erro' as const,
      titulo: 'Reforço atrasado',
      texto: `${r.produto}: dose prevista para ${formatarData(r.data_proxima_dose)} (${plural(r.dias_atraso, 'dia', 'dias')} de atraso).`,
    })),
    ...alertas.campanhas.map(c => ({
      chave: `campanha-${c.produto}`, icone: Syringe, tom: 'alerta' as const,
      titulo: 'Vacinação obrigatória pendente',
      texto: `${c.produto}: vacinar até ${formatarData(c.prazo_final)}.`,
    })),
  ]
  if (itens.length === 0) return null
  return <section className="ficha-alertas" aria-label="Alertas do animal">
    {itens.map(({ chave, icone: Icone, tom, titulo, texto }) => <p key={chave} className={`ficha-alerta ficha-alerta--${tom}`}>
      <Icone size={18} aria-hidden="true" />
      <span><strong>{titulo}.</strong> {texto}</span>
    </p>)}
  </section>
}
