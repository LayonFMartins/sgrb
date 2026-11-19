import { useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { LinkAnimal } from '../../components/animais/LinkAnimal'
import { Selecao } from '../../components/cadastro/FormularioCadastro'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useConfirmacao } from '../../hooks/useConfirmacao'
import type { Animal } from '../../types/animais'
import type { PiqueteCadastro } from '../../types/cadastros'
import { enviar, mensagemDeErro } from '../../utils/enviar'
import { formatarData, plural } from '../../utils/formatar'
import { EscolherAnimal } from '../VendasBaixas/EscolherAnimal'
import './Movimentacoes.css'

// Campos do topo do formulário. Ficam na página (props) para continuarem preenchidos
// quando as listas recarregam depois de cada registro.
export interface CabecalhoMovimentacao {
  destino: string
  data: string
}

// Mover animais para um piquete: o back fecha a ocupação atual de cada animal e abre a nova,
// tudo numa transação. O banco confere a lotação (RI-09), o descanso do piquete (RI-10),
// o nascimento (RI-15) e se o animal já saiu do rebanho (RI-22). Aqui avisamos antes o que dá para saber.
export function FormMovimentacao({ animais, piquetes, valores, onAlterar, onRegistrada }: {
  animais: Animal[]
  piquetes: PiqueteCadastro[]
  valores: CabecalhoMovimentacao
  onAlterar: (parcial: Partial<CabecalhoMovimentacao>) => void
  onRegistrada: (mensagem: string) => void
}) {
  const confirmar = useConfirmacao()
  const hoje = new Date().toLocaleDateString('sv-SE') // AAAA-MM-DD no fuso local
  const [escolhidos, setEscolhidos] = useState<Animal[]>([])
  const [origem, setOrigem] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const destino = piquetes.find(p => String(p.id_piquete) === valores.destino)
  const noDestino = (a: Animal) => Boolean(destino && a.piquete_atual === destino.nome)
  // Piquete vazio em descanso só recebe animais a partir da data de liberação.
  const liberacao = destino?.situacao === 'Em descanso' ? destino.data_liberacao : null
  const emDescanso = liberacao !== null && valores.data !== '' && valores.data < liberacao

  // Piquetes de onde dá para trazer o lote inteiro (têm animais ativos e não são o destino).
  const origens = [...new Set(animais.map(a => a.piquete_atual)
    .filter((p): p is string => p !== null && p !== destino?.nome))].sort()

  function adicionarOrigem() {
    const novos = animais.filter(a => a.piquete_atual === origem && !escolhidos.some(e => e.brinco === a.brinco))
    setEscolhidos(lista => [...lista, ...novos])
    setOrigem('')
    setErro('')
  }

  function validar(): string {
    if (!destino) return 'Escolha o piquete de destino.'
    if (!valores.data) return 'Informe a data da movimentação.'
    if (valores.data > hoje) return 'A data da movimentação não pode estar no futuro.'
    if (escolhidos.length === 0) return 'Adicione pelo menos um animal.'
    const jaLa = escolhidos.find(noDestino)
    if (jaLa) return `O animal ${jaLa.brinco} já está no piquete ${destino.nome}. Tire-o da lista.`
    if (liberacao && valores.data < liberacao) {
      return `O piquete ${destino.nome} está em descanso até ${formatarData(liberacao)}. Escolha outro piquete ou uma data a partir da liberação.`
    }
    const nascido = escolhidos.find(a => valores.data < a.data_nascimento)
    if (nascido) return `O animal ${nascido.brinco} nasceu em ${formatarData(nascido.data_nascimento)}; a movimentação não pode ser antes disso.`
    if (escolhidos.length > destino.vagas) {
      return `O piquete ${destino.nome} tem ${plural(destino.vagas, 'vaga', 'vagas')} e você escolheu ${plural(escolhidos.length, 'animal', 'animais')}.`
    }
    return ''
  }

  async function registrar(e: FormEvent) {
    e.preventDefault()
    const problema = validar()
    setErro(problema)
    if (problema || !destino) return
    if (!(await confirmar({ titulo: 'Mover animais?', confirmar: 'Mover',
      mensagem: `${plural(escolhidos.length, 'animal', 'animais')} para o piquete ${destino.nome}, em ${formatarData(valores.data)}. Se foi engano, o proprietário pode desfazer no histórico.` }))) return

    setSalvando(true)
    try {
      const resposta = await enviar<{ mensagem: string }>('/movimentacoes', 'POST', {
        brincos: escolhidos.map(a => a.brinco),
        id_piquete: destino.id_piquete,
        data_movimentacao: valores.data,
      })
      onRegistrada(resposta.mensagem)
      setEscolhidos([])
      setErro('')
    } catch (erroApi) {
      // Ex.: "RI-09: o piquete ... está lotado ..." ou "O animal 0101 teve a última entrada em piquete em ..."
      setErro(mensagemDeErro(erroApi))
    } finally {
      setSalvando(false)
    }
  }

  return <form className="compra" onSubmit={registrar} noValidate>
    <section className="content-card" aria-labelledby="movimentacao-dados">
      <h2 id="movimentacao-dados">Para onde os animais vão</h2>
      <div className="cadastro-form__campos">
        <Selecao label="Piquete de destino" value={valores.destino} required
          onChange={e => { onAlterar({ destino: e.target.value }); setErro('') }}>
          <option value="">Escolha o piquete</option>
          {piquetes.map(p => <option key={p.id_piquete} value={p.id_piquete}>
            {p.nome} · {p.situacao === 'Em descanso' ? `em descanso até ${formatarData(p.data_liberacao)}` : plural(p.vagas, 'vaga', 'vagas')}
          </option>)}
        </Selecao>
        <Input label="Data da movimentação" type="date" value={valores.data} max={hoje} required
          onChange={e => onAlterar({ data: e.target.value })} />
      </div>
      {destino && <p className="cadastro-form__dica">
        {destino.nome}: {destino.animais} de {destino.capacidade_max} animais · {plural(destino.vagas, 'vaga', 'vagas')}
        {emDescanso && <> · <span className="etiqueta etiqueta--alerta">em descanso até {formatarData(liberacao)}</span></>}
      </p>}
    </section>

    <section className="content-card" aria-labelledby="movimentacao-animais">
      <div className="compra-animais__topo">
        <h2 id="movimentacao-animais">Animais</h2>
        <span className="texto-secundario">{plural(escolhidos.length, 'animal', 'animais')}</span>
      </div>

      {origens.length > 0 && <div className="movimentacao-origem">
        <Selecao label="Adicionar todos os animais de um piquete" value={origem}
          onChange={e => setOrigem(e.target.value)}>
          <option value="">Escolha o piquete de origem</option>
          {origens.map(p => <option key={p} value={p}>{p} ({plural(animais.filter(a => a.piquete_atual === p).length, 'animal', 'animais')})</option>)}
        </Selecao>
        <button type="button" className="botao-secundario" disabled={!origem} onClick={adicionarOrigem}>
          Adicionar o piquete
        </button>
      </div>}

      {escolhidos.map(a => <div key={a.brinco} className="movimentacao-animal">
        <div className="movimentacao-animal__info">
          <LinkAnimal brinco={a.brinco} />
          <span className="texto-secundario">{a.categoria} · {a.raca}</span>
          <span className="texto-secundario">{a.piquete_atual ?? 'sem piquete'} → {destino?.nome ?? '…'}</span>
          {noDestino(a) && <span className="etiqueta etiqueta--erro">já está no piquete de destino</span>}
        </div>
        <button type="button" className="acao-icone" aria-label={`Tirar o animal ${a.brinco} da movimentação`}
          onClick={() => { setEscolhidos(lista => lista.filter(x => x.brinco !== a.brinco)); setErro('') }}>
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>)}

      <EscolherAnimal animais={animais}
        ignorar={[...escolhidos.map(a => a.brinco), ...animais.filter(noDestino).map(a => a.brinco)]}
        rotulo={escolhidos.length ? 'Adicionar mais um animal' : 'Adicionar animal'}
        onEscolher={animal => { setEscolhidos(lista => [...lista, animal]); setErro('') }} />
    </section>

    {erro && <p className="cadastro-form__erro" role="alert">{erro}</p>}
    <div className="cadastro-form__botoes compra__acoes">
      <Button type="submit" loading={salvando} className="cadastro-form__salvar">Mover animais</Button>
    </div>
  </form>
}
