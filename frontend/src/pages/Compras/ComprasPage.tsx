import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { LinkAnimal } from '../../components/animais/LinkAnimal'
import { Selecao } from '../../components/cadastro/FormularioCadastro'
import { AvisoSucesso } from '../../components/ui/AvisoSucesso'
import { Button } from '../../components/ui/Button'
import { EstadoDados } from '../../components/ui/EstadoDados'
import { Input } from '../../components/ui/Input'
import { useAvisoSucesso } from '../../hooks/useAvisoSucesso'
import { useDados } from '../../hooks/useDados'
import type { Raca } from '../../types/animais'
import type { Fornecedor } from '../../types/cadastros'
import { enviar, mensagemDeErro } from '../../utils/enviar'
import { formatarData, formatarNumero, plural } from '../../utils/formatar'
import '../../components/cadastro/Cadastro.css'
import './Compras.css'

// GTA de entrada: ABATE só faz sentido na saída (venda).
const FINALIDADES = [
  { id: 'RECRIA', rotulo: 'Recria' },
  { id: 'ENGORDA', rotulo: 'Engorda' },
  { id: 'CRIA', rotulo: 'Cria (reprodução)' },
]

interface AnimalForm {
  chave: number
  brinco: string
  sexo: string
  data_nascimento: string
  id_raca: string
  valor_compra: string
}

interface Registrada {
  mensagem: string
  numero_gta: string
  data_compra: string
  fornecedor: string
  brincos: string[]
}

const CHAVE_DESTINO = 'sgrb.compras.destino'
function lerDestino() {
  try { return localStorage.getItem(CHAVE_DESTINO) ?? '' } catch { return '' }
}
function salvarDestino(destino: string) {
  try { localStorage.setItem(CHAVE_DESTINO, destino) } catch { /* sem armazenamento: só não lembra */ }
}

// Chave só para o React identificar as linhas; o primeiro animal usa 0 e os seguintes são criados nos cliques.
const ANIMAL_INICIAL: AnimalForm = { chave: 0, brinco: '', sexo: 'M', data_nascimento: '', id_raca: '', valor_compra: '' }
let proximaChave = 1
const animalVazio = (): AnimalForm => ({ ...ANIMAL_INICIAL, chave: proximaChave++ })
const origemDoFornecedor = (f: Fornecedor) => `${f.nome_propriedade} - ${f.municipio}/${f.uf}`
const real = (valor: number) => `R$ ${formatarNumero(valor, 2)}`

export function ComprasPage() {
  const fornecedores = useDados<Fornecedor[]>('/fornecedores')
  const racas = useDados<Raca[]>('/racas')
  const sucesso = useAvisoSucesso()
  const hoje = new Date().toLocaleDateString('sv-SE') // AAAA-MM-DD no fuso local

  const [idFornecedor, setIdFornecedor] = useState('')
  const [dataCompra, setDataCompra] = useState(hoje)
  const [gta, setGta] = useState({ numero_gta: '', data_emissao: hoje, origem: '', destino: lerDestino(), finalidade: 'RECRIA' })
  const [animais, setAnimais] = useState<AnimalForm[]>([ANIMAL_INICIAL])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [registrada, setRegistrada] = useState<Registrada | null>(null)

  const fornecedor = fornecedores.dados?.find(f => String(f.id_fornecedor) === idFornecedor)
  const total = animais.reduce((soma, a) => soma + (Number(a.valor_compra) || 0), 0)

  function escolherFornecedor(id: string) {
    // A origem da GTA acompanha o fornecedor, a menos que já tenha sido editada à mão.
    const anterior = fornecedor && origemDoFornecedor(fornecedor)
    const novo = fornecedores.dados?.find(f => String(f.id_fornecedor) === id)
    setIdFornecedor(id)
    if (novo && (!gta.origem || gta.origem === anterior)) setGta(g => ({ ...g, origem: origemDoFornecedor(novo) }))
  }

  function alterarAnimal(chave: number, campo: keyof Omit<AnimalForm, 'chave'>, valor: string) {
    setAnimais(lista => lista.map(a => a.chave === chave ? { ...a, [campo]: valor } : a))
  }

  // Novo animal copia sexo, nascimento e raça do anterior (lotes costumam ser parecidos).
  function adicionarAnimal() {
    const ultimo = animais.at(-1)
    const novo = { ...animalVazio(), sexo: ultimo?.sexo ?? 'M',
      data_nascimento: ultimo?.data_nascimento ?? '', id_raca: ultimo?.id_raca ?? '' }
    setAnimais(lista => [...lista, novo])
  }

  function validar(): string {
    if (!idFornecedor) return 'Escolha o fornecedor.'
    if (!dataCompra) return 'Informe a data da compra.'
    if (dataCompra > hoje) return 'A data da compra não pode estar no futuro.'
    if (!gta.numero_gta.trim()) return 'Informe o número da GTA de entrada.'
    if (!gta.data_emissao) return 'Informe a data de emissão da GTA.'
    if (!gta.origem.trim() || !gta.destino.trim()) return 'Informe a origem e o destino da GTA.'
    const vistos = new Set<string>()
    for (const [i, a] of animais.entries()) {
      const n = `Animal ${i + 1}`
      const brinco = a.brinco.trim()
      if (!brinco) return `${n}: informe o brinco.`
      if (vistos.has(brinco)) return `O brinco ${brinco} aparece mais de uma vez na compra.`
      vistos.add(brinco)
      if (!a.data_nascimento) return `${n} (${brinco}): informe a data de nascimento.`
      if (a.data_nascimento > dataCompra) return `${n} (${brinco}): o nascimento não pode ser depois da compra.`
      if (!a.id_raca) return `${n} (${brinco}): escolha a raça.`
      if (!(Number(a.valor_compra) > 0)) return `${n} (${brinco}): informe um valor maior que zero.`
    }
    return ''
  }

  async function registrar(e: FormEvent) {
    e.preventDefault()
    const problema = validar()
    setErro(problema)
    if (problema) return
    setSalvando(true)
    const corpo = {
      id_fornecedor: Number(idFornecedor),
      data_compra: dataCompra,
      gta: { ...gta, numero_gta: gta.numero_gta.trim(), origem: gta.origem.trim(), destino: gta.destino.trim() },
      animais: animais.map(a => ({
        brinco: a.brinco.trim(), sexo: a.sexo, data_nascimento: a.data_nascimento,
        id_raca: Number(a.id_raca), valor_compra: Number(a.valor_compra),
      })),
    }
    try {
      const resposta = await enviar<{ mensagem: string }>('/compras', 'POST', corpo)
      salvarDestino(corpo.gta.destino)
      setRegistrada({
        mensagem: resposta.mensagem, numero_gta: corpo.gta.numero_gta, data_compra: dataCompra,
        fornecedor: fornecedor?.nome_produtor ?? '', brincos: corpo.animais.map(a => a.brinco),
      })
      sucesso.mostrar(resposta.mensagem)
      limpar()
    } catch (erroApi) {
      setErro(mensagemDeErro(erroApi))
    } finally {
      setSalvando(false)
    }
  }

  function limpar() {
    setIdFornecedor('')
    setDataCompra(hoje)
    setGta(g => ({ numero_gta: '', data_emissao: hoje, origem: '', destino: g.destino, finalidade: 'RECRIA' }))
    setAnimais([animalVazio()])
    setErro('')
  }

  return <>
    <header className="page-heading">
      <h1>Compras</h1>
      <p>Registre a compra de animais junto com a GTA de entrada. Tudo é gravado de uma vez: se algo estiver errado, nada é salvo.</p>
    </header>

    {registrada && <section className="content-card compra-registrada" aria-label="Última compra registrada">
      <h2>Compra registrada</h2>
      <p>
        {plural(registrada.brincos.length, 'animal', 'animais')} de {registrada.fornecedor} em {formatarData(registrada.data_compra)},
        com a GTA <strong>{registrada.numero_gta}</strong>:
      </p>
      <p className="compra-registrada__brincos">
        {registrada.brincos.map(b => <LinkAnimal key={b} brinco={b} />)}
      </p>
    </section>}

    <EstadoDados carregando={fornecedores.carregando || racas.carregando} erro={fornecedores.erro || racas.erro}
      recarregar={() => { fornecedores.recarregar(); racas.recarregar() }}>
      <form className="compra" onSubmit={registrar} noValidate>
        <section className="content-card" aria-labelledby="compra-dados">
          <h2 id="compra-dados">Dados da compra</h2>
          <div className="cadastro-form__campos">
            <Selecao label="Fornecedor" value={idFornecedor} required onChange={e => escolherFornecedor(e.target.value)}>
              <option value="">Selecione…</option>
              {fornecedores.dados?.map(f => <option key={f.id_fornecedor} value={f.id_fornecedor}>
                {f.nome_produtor} · {f.nome_propriedade} ({f.municipio}/{f.uf})
              </option>)}
            </Selecao>
            <Input label="Data da compra" type="date" value={dataCompra} max={hoje} required
              onChange={e => setDataCompra(e.target.value)} />
          </div>
          {fornecedores.dados?.length === 0 && <p className="cadastro-form__dica">
            Nenhum fornecedor cadastrado. <Link to="/fornecedores">Cadastre o fornecedor</Link> antes de registrar a compra.
          </p>}
        </section>

        <section className="content-card" aria-labelledby="compra-gta">
          <h2 id="compra-gta">GTA de entrada</h2>
          <div className="cadastro-form__campos">
            <Input label="Número da GTA" value={gta.numero_gta} maxLength={20} required placeholder="MG-26-0040001"
              onChange={e => setGta({ ...gta, numero_gta: e.target.value.toUpperCase() })} />
            <Input label="Data de emissão" type="date" value={gta.data_emissao} max={hoje} required
              onChange={e => setGta({ ...gta, data_emissao: e.target.value })} />
            <Selecao label="Finalidade" value={gta.finalidade} onChange={e => setGta({ ...gta, finalidade: e.target.value })}>
              {FINALIDADES.map(f => <option key={f.id} value={f.id}>{f.rotulo}</option>)}
            </Selecao>
            <Input label="Origem" value={gta.origem} maxLength={100} required placeholder="Fazenda - Município/UF"
              onChange={e => setGta({ ...gta, origem: e.target.value })} />
            <Input label="Destino" value={gta.destino} maxLength={100} required placeholder="Fazenda - Município/UF"
              onChange={e => setGta({ ...gta, destino: e.target.value })} />
          </div>
        </section>

        <section className="content-card" aria-labelledby="compra-animais">
          <div className="compra-animais__topo">
            <h2 id="compra-animais">Animais</h2>
            <span className="texto-secundario">{plural(animais.length, 'animal', 'animais')} · total {real(total)}</span>
          </div>
          {animais.map((a, i) => <fieldset key={a.chave} className="compra-animal">
            <legend>Animal {i + 1}</legend>
            <Input label="Brinco" value={a.brinco} maxLength={20} required
              onChange={e => alterarAnimal(a.chave, 'brinco', e.target.value)} />
            <Selecao label="Sexo" value={a.sexo} onChange={e => alterarAnimal(a.chave, 'sexo', e.target.value)}>
              <option value="M">Macho</option>
              <option value="F">Fêmea</option>
            </Selecao>
            <Input label="Nascimento" type="date" value={a.data_nascimento} max={dataCompra || hoje} required
              onChange={e => alterarAnimal(a.chave, 'data_nascimento', e.target.value)} />
            <Selecao label="Raça" value={a.id_raca} required onChange={e => alterarAnimal(a.chave, 'id_raca', e.target.value)}>
              <option value="">Selecione…</option>
              {racas.dados?.map(r => <option key={r.id_raca} value={r.id_raca}>{r.nome}</option>)}
            </Selecao>
            <Input label="Valor (R$)" type="number" min="0.01" step="0.01" value={a.valor_compra} required
              onChange={e => alterarAnimal(a.chave, 'valor_compra', e.target.value)} />
            {animais.length > 1 && <button type="button" className="acao-icone compra-animal__remover"
              aria-label={`Remover animal ${i + 1}${a.brinco ? ` (${a.brinco})` : ''}`}
              onClick={() => setAnimais(lista => lista.filter(x => x.chave !== a.chave))}><Trash2 size={16} aria-hidden="true" /></button>}
          </fieldset>)}
          <button type="button" className="acao-linha compra-animais__adicionar" onClick={adicionarAnimal}>
            <Plus size={14} aria-hidden="true" />Adicionar animal
          </button>
        </section>

        {erro && <p className="cadastro-form__erro" role="alert">{erro}</p>}
        <div className="cadastro-form__botoes">
          <button type="button" className="botao-secundario" onClick={limpar} disabled={salvando}>Limpar</button>
          <Button type="submit" loading={salvando} className="cadastro-form__salvar">Registrar compra</Button>
        </div>
      </form>
    </EstadoDados>
    <AvisoSucesso {...sucesso} />
  </>
}
