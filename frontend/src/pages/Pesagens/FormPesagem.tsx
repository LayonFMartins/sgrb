import { useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { LinkAnimal } from '../../components/animais/LinkAnimal'
import { SelecaoResponsavel } from '../../components/manejos/SelecaoResponsavel'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useConfirmacao } from '../../hooks/useConfirmacao'
import type { Animal } from '../../types/animais'
import type { UsuarioCadastro } from '../../types/cadastros'
import { enviar, mensagemDeErro } from '../../utils/enviar'
import { formatarData, formatarPeso, plural } from '../../utils/formatar'
import { EscolherAnimal } from '../VendasBaixas/EscolherAnimal'
import './Pesagens.css'

interface Item {
  animal: Animal
  peso: string
}

// Peso que difere mais que isto do último peso recebe um aviso (não bloqueia).
const VARIACAO_SUSPEITA = 0.3
const pesoSuspeito = (peso: number, ultimo: number | null) =>
  peso > 0 && ultimo !== null && Math.abs(peso - ultimo) / ultimo > VARIACAO_SUSPEITA

// Pesagem no curral: uma data e um responsável para vários animais, cada um com o seu peso.
// A data e o responsável ficam na página (props) para continuarem preenchidos
// quando a lista de animais é recarregada depois de cada registro.
export function FormPesagem({ animais, usuarios, data, onData, responsavel, onResponsavel, onRegistrada }: {
  animais: Animal[]
  usuarios: UsuarioCadastro[]
  data: string
  onData: (data: string) => void
  responsavel: string
  onResponsavel: (id: string) => void
  onRegistrada: (mensagem: string) => void
}) {
  const confirmar = useConfirmacao()
  const hoje = new Date().toLocaleDateString('sv-SE') // AAAA-MM-DD no fuso local
  const [itens, setItens] = useState<Item[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function alterarPeso(brinco: string, peso: string) {
    setItens(lista => lista.map(i => i.animal.brinco === brinco ? { ...i, peso } : i))
  }

  function validar(): string {
    if (!data) return 'Informe a data da pesagem.'
    if (data > hoje) return 'A data da pesagem não pode estar no futuro.'
    if (!responsavel) return 'Escolha o responsável pela pesagem.'
    if (itens.length === 0) return 'Adicione pelo menos um animal.'
    for (const i of itens) {
      const b = i.animal.brinco
      if (!(Number(i.peso) > 0)) return `Animal ${b}: informe o peso.`
      if (data < i.animal.data_nascimento) {
        return `O animal ${b} nasceu em ${formatarData(i.animal.data_nascimento)}; a pesagem não pode ser antes disso.`
      }
    }
    return ''
  }

  async function registrar(e: FormEvent) {
    e.preventDefault()
    const problema = validar()
    setErro(problema)
    if (problema) return
    // Pesos muito diferentes do último quase sempre são erro de digitação: repete o aviso na confirmação.
    const suspeitos = itens.filter(i => pesoSuspeito(Number(i.peso), i.animal.ultimo_peso_kg))
    const aviso = suspeitos.length === 0 ? ''
      : ` Atenção, confira: ${suspeitos.map(i => `${i.animal.brinco} com ${formatarPeso(Number(i.peso))} (último: ${formatarPeso(i.animal.ultimo_peso_kg)})`).join('; ')}.`
    if (!(await confirmar({ titulo: suspeitos.length ? 'Registrar mesmo assim?' : 'Registrar pesagem?', confirmar: 'Registrar',
      mensagem: `${plural(itens.length, 'pesagem', 'pesagens')} em ${formatarData(data)}.${aviso}` }))) return

    setSalvando(true)
    try {
      const resposta = await enviar<{ mensagem: string }>('/pesagens', 'POST', {
        data_pesagem: data,
        id_usuario: Number(responsavel),
        pesagens: itens.map(i => ({ brinco: i.animal.brinco, peso_kg: Number(i.peso) })),
      })
      onRegistrada(resposta.mensagem)
      setItens([])
      setErro('')
    } catch (erroApi) {
      // Ex.: "O animal 0001 já tem pesagem nessa data." ou "RI-26: o usuário ... está inativo ..."
      setErro(mensagemDeErro(erroApi))
    } finally {
      setSalvando(false)
    }
  }

  return <form className="compra" onSubmit={registrar} noValidate>
    <section className="content-card" aria-labelledby="pesagem-dados">
      <h2 id="pesagem-dados">Dados da pesagem</h2>
      <div className="cadastro-form__campos">
        <Input label="Data da pesagem" type="date" value={data} max={hoje} required onChange={e => onData(e.target.value)} />
        <SelecaoResponsavel usuarios={usuarios} valor={responsavel} onChange={onResponsavel} />
      </div>
      <p className="cadastro-form__dica">
        O responsável é quem fez a pesagem, não necessariamente quem está logado: os vaqueiros não têm login.
      </p>
    </section>

    <section className="content-card" aria-labelledby="pesagem-animais">
      <div className="compra-animais__topo">
        <h2 id="pesagem-animais">Animais</h2>
        <span className="texto-secundario">{plural(itens.length, 'animal', 'animais')}</span>
      </div>

      {itens.map(i => {
        const b = i.animal.brinco
        const peso = Number(i.peso)
        const ultimo = i.animal.ultimo_peso_kg
        const suspeito = pesoSuspeito(peso, ultimo)
        return <fieldset key={b} className="pesagem-animal">
          <legend className="sr-only">Animal {b}</legend>
          <div className="pesagem-animal__info">
            <LinkAnimal brinco={b} />
            <span className="texto-secundario">{i.animal.categoria} · {i.animal.raca} · {i.animal.piquete_atual ?? 'sem piquete'}</span>
            <span className="texto-secundario">
              último peso: {ultimo === null ? 'nenhum' : `${formatarPeso(ultimo)} em ${formatarData(i.animal.data_ultimo_peso)}`}
            </span>
            {suspeito && <span className="etiqueta etiqueta--alerta">confira: muito diferente do último peso</span>}
          </div>
          <Input label="Peso (kg)" type="number" min="0.1" step="0.1" value={i.peso} required
            onChange={e => alterarPeso(b, e.target.value)} />
          <button type="button" className="acao-icone" aria-label={`Tirar o animal ${b} da pesagem`}
            onClick={() => { setItens(lista => lista.filter(x => x.animal.brinco !== b)); setErro('') }}>
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </fieldset>
      })}

      <EscolherAnimal animais={animais} ignorar={itens.map(i => i.animal.brinco)}
        rotulo={itens.length ? 'Adicionar mais um animal' : 'Adicionar animal'}
        onEscolher={animal => { setItens(lista => [...lista, { animal, peso: '' }]); setErro('') }} />
    </section>

    {erro && <p className="cadastro-form__erro" role="alert">{erro}</p>}
    <div className="cadastro-form__botoes compra__acoes">
      <Button type="submit" loading={salvando} className="cadastro-form__salvar">Registrar pesagem</Button>
    </div>
  </form>
}
