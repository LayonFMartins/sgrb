import { useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { LinkAnimal } from '../../components/animais/LinkAnimal'
import { Selecao } from '../../components/cadastro/FormularioCadastro'
import { SelecaoResponsavel } from '../../components/manejos/SelecaoResponsavel'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useConfirmacao } from '../../hooks/useConfirmacao'
import { useDados } from '../../hooks/useDados'
import type { Campanha, Reforco } from '../../types/consultas'
import { idade } from '../Animais/animal'
import type { Animal } from '../../types/animais'
import type { ProdutoSanitario, TipoProduto, UsuarioCadastro } from '../../types/cadastros'
import { enviar, mensagemDeErro } from '../../utils/enviar'
import { formatarData, plural } from '../../utils/formatar'
import { EscolherAnimal } from '../VendasBaixas/EscolherAnimal'
import './ManejoSanitario.css'

// Campos do topo do formulário. Ficam na página (props) para continuarem preenchidos
// quando as listas recarregam depois de cada registro (o mesmo lote vale para vários piquetes).
export interface CabecalhoAplicacao {
  produto: string
  data: string
  lote: string
  responsavel: string
}

const ROTULO_TIPO: Record<TipoProduto, string> = { VACINA: 'Vacina', VERMIFUGO: 'Vermífugo', ANTIBIOTICO: 'Antibiótico' }

// 'AAAA-MM-DD' + dias, em UTC (não desloca o dia por causa do fuso horário).
function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

function descricaoProduto(p: ProdutoSanitario): string {
  const partes = [`${ROTULO_TIPO[p.tipo]} contra ${p.doenca_alvo.toLocaleLowerCase('pt-BR')}`]
  partes.push(p.num_doses === 1
    ? (p.intervalo_reforco_dias ? `dose única, com reforço a cada ${p.intervalo_reforco_dias} dias` : 'dose única')
    : `${p.num_doses} doses, com intervalo de ${p.intervalo_reforco_dias ?? '?'} dias`)
  if (p.sexo_alvo) partes.push(p.sexo_alvo === 'F' ? 'só para fêmeas' : 'só para machos')
  const { idade_min_meses: min, idade_max_meses: max } = p
  if (min !== null && max !== null) partes.push(`de ${min} a ${max} meses de idade`)
  else if (min !== null) partes.push(`a partir de ${min} meses de idade`)
  else if (max !== null) partes.push(`até ${max} meses de idade`)
  return `${partes.join(' · ')}.`
}

// Aplicação em lote (vacinação, vermifugação, tratamento): um produto, uma data, um lote e um
// responsável para vários animais. O número da dose é calculado pelo back (1ª, 2ª...).
// O banco confere o público do produto (RI-14), o nascimento (RI-15) e o responsável ativo (RI-26).
export function FormAplicacao({ animais, produtos, usuarios, valores, onAlterar, onRegistrada }: {
  animais: Animal[]
  produtos: ProdutoSanitario[]
  usuarios: UsuarioCadastro[]
  valores: CabecalhoAplicacao
  onAlterar: (parcial: Partial<CabecalhoAplicacao>) => void
  onRegistrada: (mensagem: string) => void
}) {
  const confirmar = useConfirmacao()
  const hoje = new Date().toLocaleDateString('sv-SE') // AAAA-MM-DD no fuso local
  const [escolhidos, setEscolhidos] = useState<Animal[]>([])
  const [piqueteEscolhido, setPiqueteEscolhido] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const produto = produtos.find(p => String(p.id_produto) === valores.produto)

  // Quem está devendo este produto: reforço vencido até a data da aplicação ou vacinação de campanha
  // pendente (as mesmas contas dos relatórios "Reforços" e "Campanhas", feitas pelas views do banco).
  const reforcos = useDados<Reforco[]>('/consultas/reforcos')
  const campanhas = useDados<Campanha[]>('/consultas/campanhas')
  const motivoPendente = new Map<string, string>()
  if (produto) {
    for (const r of reforcos.dados ?? []) {
      if (r.produto === produto.nome && valores.data && r.data_proxima_dose.slice(0, 10) <= valores.data) {
        motivoPendente.set(r.brinco, r.dias_atraso > 0 ? `reforço atrasado ${plural(r.dias_atraso, 'dia', 'dias')}` : 'reforço vence até a data')
      }
    }
    for (const c of campanhas.dados ?? []) {
      if (c.produto === produto.nome && !motivoPendente.has(c.brinco)) motivoPendente.set(c.brinco, `campanha: vacinar até ${formatarData(c.prazo_final)}`)
    }
  }
  const pendentes = animais.filter(a => motivoPendente.has(a.brinco) && !escolhidos.some(e => e.brinco === a.brinco))
  const pendentesEscolhidos = escolhidos.filter(a => motivoPendente.has(a.brinco)).length

  function adicionarPendentes() {
    setEscolhidos(lista => [...lista, ...pendentes])
    setErro('')
  }
  const liberacao = produto && produto.carencia_dias > 0 && valores.data
    ? somarDias(valores.data, produto.carencia_dias) : null

  // Piquetes que têm animais ativos, para "adicionar todos".
  const piquetes = [...new Set(animais.map(a => a.piquete_atual).filter((p): p is string => p !== null))].sort()

  function adicionarPiquete() {
    const novos = animais.filter(a => a.piquete_atual === piqueteEscolhido && !escolhidos.some(e => e.brinco === a.brinco))
    setEscolhidos(lista => [...lista, ...novos])
    setPiqueteEscolhido('')
    setErro('')
  }

  const foraDoSexo = (a: Animal) => Boolean(produto?.sexo_alvo && a.sexo !== produto.sexo_alvo)
  const foraDaIdade = (a: Animal) => Boolean(produto &&
    ((produto.idade_min_meses !== null && a.idade_meses < produto.idade_min_meses) ||
     (produto.idade_max_meses !== null && a.idade_meses > produto.idade_max_meses)))

  function validar(): string {
    if (!produto) return 'Escolha o produto.'
    if (!valores.data) return 'Informe a data da aplicação.'
    if (valores.data > hoje) return 'A data da aplicação não pode estar no futuro.'
    if (!valores.lote.trim()) return 'Informe o lote do medicamento.'
    if (!valores.responsavel) return 'Escolha o responsável pela aplicação.'
    if (escolhidos.length === 0) return 'Adicione pelo menos um animal.'
    for (const a of escolhidos) {
      if (foraDoSexo(a)) {
        return `O animal ${a.brinco} é ${a.sexo === 'F' ? 'fêmea' : 'macho'}; ${produto.nome} é só para ${produto.sexo_alvo === 'F' ? 'fêmeas' : 'machos'}. Tire-o da lista.`
      }
      if (valores.data < a.data_nascimento) {
        return `O animal ${a.brinco} nasceu em ${formatarData(a.data_nascimento)}; a aplicação não pode ser antes disso.`
      }
    }
    return ''
  }

  async function registrar(e: FormEvent) {
    e.preventDefault()
    const problema = validar()
    setErro(problema)
    if (problema || !produto) return
    const carencia = liberacao ? ` Carência de ${produto.carencia_dias} dia(s): os animais não poderão ser vendidos para abate até ${formatarData(liberacao)}.` : ''
    if (!(await confirmar({ titulo: 'Registrar aplicação?', confirmar: 'Registrar',
      mensagem: `${produto.nome} em ${plural(escolhidos.length, 'animal', 'animais')}, em ${formatarData(valores.data)}.${carencia} Se precisar corrigir, o proprietário pode excluí-la no histórico.` }))) return

    setSalvando(true)
    try {
      const resposta = await enviar<{ mensagem: string }>('/aplicacoes', 'POST', {
        brincos: escolhidos.map(a => a.brinco),
        id_produto: produto.id_produto,
        data_aplicacao: valores.data,
        id_usuario: Number(valores.responsavel),
        lote_medicamento: valores.lote.trim(),
      })
      onRegistrada(resposta.mensagem)
      setEscolhidos([])
      setErro('')
    } catch (erroApi) {
      // Ex.: "RI-14: o produto ... é restrito a animais do sexo F ..." ou "O animal 0001 já recebeu ... em 10/11/2026."
      setErro(mensagemDeErro(erroApi))
    } finally {
      setSalvando(false)
    }
  }

  return <form className="compra" onSubmit={registrar} noValidate>
    <section className="content-card" aria-labelledby="aplicacao-dados">
      <h2 id="aplicacao-dados">Dados da aplicação</h2>
      <div className="cadastro-form__campos">
        <Selecao label="Produto" value={valores.produto} required
          onChange={e => { onAlterar({ produto: e.target.value }); setErro('') }}>
          <option value="">Escolha o produto</option>
          {produtos.map(p => <option key={p.id_produto} value={p.id_produto}>{p.nome} ({ROTULO_TIPO[p.tipo]})</option>)}
        </Selecao>
        <Input label="Data da aplicação" type="date" value={valores.data} max={hoje} required
          onChange={e => onAlterar({ data: e.target.value })} />
        <Input label="Lote do medicamento" value={valores.lote} maxLength={30} required placeholder="Lote da embalagem"
          onChange={e => onAlterar({ lote: e.target.value })} />
        <SelecaoResponsavel usuarios={usuarios} valor={valores.responsavel} onChange={responsavel => onAlterar({ responsavel })} />
      </div>
      {produto && <p className="cadastro-form__dica">{descricaoProduto(produto)}</p>}
      {liberacao && <p className="cadastro-form__dica">
        Carência de {produto?.carencia_dias} dia(s): os animais ficam liberados para abate a partir de {formatarData(liberacao)}.
      </p>}
      <p className="cadastro-form__dica">
        O número da dose (1ª, 2ª...) é calculado pelo sistema. O responsável é quem aplicou, não necessariamente quem está logado.
      </p>
    </section>

    <section className="content-card" aria-labelledby="aplicacao-animais">
      <div className="compra-animais__topo">
        <h2 id="aplicacao-animais">Animais</h2>
        <span className="texto-secundario">{plural(escolhidos.length, 'animal', 'animais')}</span>
      </div>

      {produto && pendentes.length > 0 && <div className="aplicacao-pendentes" role="status">
        <div>
          <strong>{plural(pendentes.length, 'animal precisa', 'animais precisam')} de {produto.nome}</strong>
          <span className="texto-secundario">
            {pendentes.slice(0, 6).map(a => `${a.brinco} (${motivoPendente.get(a.brinco)})`).join(' · ')}
            {pendentes.length > 6 && ` · e mais ${pendentes.length - 6}`}
          </span>
        </div>
        <button type="button" className="botao-secundario" onClick={adicionarPendentes}>
          Adicionar {pendentes.length === 1 ? 'o pendente' : `os ${pendentes.length} pendentes`}
        </button>
      </div>}
      {produto && pendentes.length === 0 && pendentesEscolhidos === 0 && !reforcos.carregando && !campanhas.carregando &&
        <p className="cadastro-form__dica">Nenhum animal está com dose pendente de {produto.nome} até {formatarData(valores.data)}.</p>}

      {piquetes.length > 0 && <div className="aplicacao-piquete">
        <Selecao label="Adicionar todos os animais de um piquete" value={piqueteEscolhido}
          onChange={e => setPiqueteEscolhido(e.target.value)}>
          <option value="">Escolha o piquete</option>
          {piquetes.map(p => <option key={p} value={p}>{p} ({plural(animais.filter(a => a.piquete_atual === p).length, 'animal', 'animais')})</option>)}
        </Selecao>
        <button type="button" className="botao-secundario" disabled={!piqueteEscolhido} onClick={adicionarPiquete}>
          Adicionar o piquete
        </button>
      </div>}

      {escolhidos.map(a => <div key={a.brinco} className="aplicacao-animal">
        <div className="aplicacao-animal__info">
          <LinkAnimal brinco={a.brinco} />
          <span className="texto-secundario">{a.categoria} · {a.raca} · {a.piquete_atual ?? 'sem piquete'} · {idade(a.idade_meses)}</span>
          {motivoPendente.has(a.brinco) && <span className="etiqueta etiqueta--ok">{motivoPendente.get(a.brinco)}</span>}
          {foraDoSexo(a) && <span className="etiqueta etiqueta--erro">fora do público do produto</span>}
          {!foraDoSexo(a) && foraDaIdade(a) && <span className="etiqueta etiqueta--alerta">confira a idade</span>}
        </div>
        <button type="button" className="acao-icone" aria-label={`Tirar o animal ${a.brinco} da aplicação`}
          onClick={() => { setEscolhidos(lista => lista.filter(x => x.brinco !== a.brinco)); setErro('') }}>
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>)}

      <EscolherAnimal animais={animais} ignorar={escolhidos.map(a => a.brinco)}
        rotulo={escolhidos.length ? 'Adicionar mais um animal' : 'Adicionar animal'}
        onEscolher={animal => { setEscolhidos(lista => [...lista, animal]); setErro('') }} />
    </section>

    {erro && <p className="cadastro-form__erro" role="alert">{erro}</p>}
    <div className="cadastro-form__botoes compra__acoes">
      <Button type="submit" loading={salvando} className="cadastro-form__salvar">Registrar aplicação</Button>
    </div>
  </form>
}
