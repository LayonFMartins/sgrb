import { useState, type FormEvent } from 'react'
import { LinkAnimal } from '../../components/animais/LinkAnimal'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useConfirmacao } from '../../hooks/useConfirmacao'
import type { Animal } from '../../types/animais'
import { enviar, mensagemDeErro } from '../../utils/enviar'
import { formatarPeso } from '../../utils/formatar'
import { EscolherAnimal } from './EscolherAnimal'

// Causas mais comuns na pecuária de corte: aparecem como sugestão, mas qualquer texto vale.
const CAUSAS_SUGERIDAS = [
  'Tristeza parasitária bovina (babesiose)',
  'Picada de cobra',
  'Acidente',
  'Complicação no parto',
  'Pneumonia',
  'Clostridiose',
  'Raio',
  'Intoxicação por planta',
  'Causa desconhecida',
]

export interface ObitoRegistrado {
  mensagem: string
  brinco: string
}

// Óbito: um animal por vez, com a data e a causa (baixa + obito numa transação, RI-18).
export function FormObito({ animais, onRegistrado }: {
  animais: Animal[]
  onRegistrado: (obito: ObitoRegistrado) => void
}) {
  const confirmar = useConfirmacao()
  const hoje = new Date().toLocaleDateString('sv-SE')
  const [animal, setAnimal] = useState<Animal | null>(null)
  const [data, setData] = useState(hoje)
  const [causa, setCausa] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function validar(): string {
    if (!animal) return 'Escolha o animal.'
    if (!data) return 'Informe a data do óbito.'
    if (data > hoje) return 'A data do óbito não pode estar no futuro.'
    if (!causa.trim()) return 'Informe a causa do óbito.'
    return ''
  }

  async function registrar(e: FormEvent) {
    e.preventDefault()
    const problema = validar()
    setErro(problema)
    if (problema || !animal) return
    if (!(await confirmar({ titulo: 'Registrar óbito?', confirmar: 'Registrar óbito', perigo: true,
      mensagem: `O animal ${animal.brinco} sai do rebanho. Depois de registrado, o óbito não pode ser desfeito pela tela.` }))) return

    setSalvando(true)
    try {
      const resposta = await enviar<{ mensagem: string }>('/baixas/obitos', 'POST',
        { brinco: animal.brinco, data_obito: data, causa: causa.trim() })
      onRegistrado({ mensagem: resposta.mensagem, brinco: animal.brinco })
      setAnimal(null)
      setData(hoje)
      setCausa('')
      setErro('')
    } catch (erroApi) {
      setErro(mensagemDeErro(erroApi))
    } finally {
      setSalvando(false)
    }
  }

  return <form className="compra" onSubmit={registrar} noValidate>
    <section className="content-card" aria-labelledby="obito-animal">
      <h2 id="obito-animal">Animal</h2>
      {animal
        ? <div className="obito-animal">
          <LinkAnimal brinco={animal.brinco} />
          <span>{animal.categoria} · {animal.raca}</span>
          <span className="texto-secundario">{animal.piquete_atual ?? 'sem piquete'} · {formatarPeso(animal.ultimo_peso_kg)}</span>
          <button type="button" className="acao-linha" onClick={() => setAnimal(null)}>Trocar animal</button>
        </div>
        : <EscolherAnimal animais={animais} ignorar={[]} rotulo="Buscar animal" onEscolher={setAnimal} />}
    </section>

    <section className="content-card" aria-labelledby="obito-dados">
      <h2 id="obito-dados">Óbito</h2>
      <div className="cadastro-form__campos">
        <Input label="Data do óbito" type="date" value={data} max={hoje} required onChange={e => setData(e.target.value)} />
        <Input label="Causa" value={causa} maxLength={200} required list="causas-obito"
          placeholder="Escolha uma sugestão ou escreva" className="cadastro-form__campo-largo"
          onChange={e => setCausa(e.target.value)} />
        <datalist id="causas-obito">
          {CAUSAS_SUGERIDAS.map(c => <option key={c} value={c} />)}
        </datalist>
      </div>
      <p className="cadastro-form__dica">O animal sai do piquete automaticamente na data do óbito.</p>
    </section>

    {erro && <p className="cadastro-form__erro" role="alert">{erro}</p>}
    <div className="cadastro-form__botoes compra__acoes">
      <Button type="submit" loading={salvando} className="cadastro-form__salvar">Registrar óbito</Button>
    </div>
  </form>
}
