import { useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { LinkAnimal } from '../../components/animais/LinkAnimal'
import { Selecao } from '../../components/cadastro/FormularioCadastro'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useConfirmacao } from '../../hooks/useConfirmacao'
import type { Animal } from '../../types/animais'
import { enviar, mensagemDeErro } from '../../utils/enviar'
import { formatarData, formatarNumero, plural } from '../../utils/formatar'
import { EscolherAnimal } from './EscolherAnimal'

const FINALIDADES_SAIDA = [
  { id: 'ABATE', rotulo: 'Abate' },
  { id: 'ENGORDA', rotulo: 'Engorda' },
  { id: 'RECRIA', rotulo: 'Recria' },
  { id: 'CRIA', rotulo: 'Cria (reprodução)' },
]

// Uma arroba (@) de boi = 15 kg. O boi é negociado em R$ por arroba.
const KG_POR_ARROBA = 15

interface Item {
  animal: Animal
  peso: string
  valor: string
  valorManual: boolean   // true quando a pessoa digitou o valor: o preço da @ não sobrescreve mais
}

export interface VendaRegistrada {
  mensagem: string
  comprador: string
  data: string
  numero_gta: string
  brincos: string[]
}

const real = (valor: number) => `R$ ${formatarNumero(valor, 2)}`
const valorPelaArroba = (peso: string, preco: string) => {
  const p = Number(peso), r = Number(preco)
  return p > 0 && r > 0 ? (p / KG_POR_ARROBA * r).toFixed(2) : ''
}

// Venda em lote, igual à Compra: comprador, data, uma GTA de saída e os animais.
// O backend grava tudo numa transação; RI-18, RI-19 e RI-20 são conferidas no COMMIT.
export function FormVenda({ animais, carencia, origemFazenda, onRegistrada }: {
  animais: Animal[]
  carencia: Map<string, string>     // brinco -> data de liberação da carência
  origemFazenda: string
  onRegistrada: (venda: VendaRegistrada) => void
}) {
  const confirmar = useConfirmacao()
  const hoje = new Date().toLocaleDateString('sv-SE') // AAAA-MM-DD no fuso local

  const [comprador, setComprador] = useState('')
  const [data, setData] = useState(hoje)
  const [gta, setGta] = useState({ numero_gta: '', data_emissao: hoje, origem: origemFazenda, destino: '', finalidade: 'ABATE' })
  const [precoArroba, setPrecoArroba] = useState('')
  const [itens, setItens] = useState<Item[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  // A origem chega depois (vem da última compra); só preenche se ainda estiver vazia.
  const origem = gta.origem || origemFazenda
  const abate = gta.finalidade === 'ABATE'
  // Carência só bloqueia venda para ABATE, e só se a liberação for depois da data da venda.
  const emCarencia = (brinco: string) => {
    const liberacao = carencia.get(brinco)
    return abate && liberacao !== undefined && liberacao > data ? liberacao : undefined
  }
  const carenciaParaBusca = abate ? new Map([...carencia].filter(([, lib]) => lib > data)) : undefined

  const pesoTotal = itens.reduce((s, i) => s + (Number(i.peso) || 0), 0)
  const valorTotal = itens.reduce((s, i) => s + (Number(i.valor) || 0), 0)

  // O destino da GTA acompanha o comprador, a menos que tenha sido editado à mão.
  function alterarComprador(nome: string) {
    if (!gta.destino || gta.destino === comprador) setGta(g => ({ ...g, destino: nome }))
    setComprador(nome)
  }

  function adicionar(animal: Animal) {
    const peso = animal.ultimo_peso_kg ? String(animal.ultimo_peso_kg) : ''
    setItens(lista => [...lista, { animal, peso, valor: valorPelaArroba(peso, precoArroba), valorManual: false }])
  }

  function alterarItem(brinco: string, campo: 'peso' | 'valor', valor: string) {
    setItens(lista => lista.map(i => {
      if (i.animal.brinco !== brinco) return i
      if (campo === 'valor') return { ...i, valor, valorManual: valor !== '' }
      return { ...i, peso: valor, valor: i.valorManual ? i.valor : valorPelaArroba(valor, precoArroba) }
    }))
  }

  function alterarPreco(preco: string) {
    setPrecoArroba(preco)
    setItens(lista => lista.map(i => i.valorManual ? i : { ...i, valor: valorPelaArroba(i.peso, preco) }))
  }

  function validar(): string {
    if (!comprador.trim()) return 'Informe o comprador.'
    if (!data) return 'Informe a data da venda.'
    if (data > hoje) return 'A data da venda não pode estar no futuro.'
    if (!gta.numero_gta.trim()) return 'Informe o número da GTA de saída.'
    if (!gta.data_emissao) return 'Informe a data de emissão da GTA.'
    if (!origem.trim() || !gta.destino.trim()) return 'Informe a origem e o destino da GTA.'
    if (itens.length === 0) return 'Adicione pelo menos um animal à venda.'
    for (const i of itens) {
      const b = i.animal.brinco
      if (!(Number(i.peso) > 0)) return `Animal ${b}: informe o peso final.`
      if (!(Number(i.valor) > 0)) return `Animal ${b}: informe o valor (ou o preço da arroba).`
      const liberacao = emCarencia(b)
      if (liberacao) return `O animal ${b} está em carência até ${formatarData(liberacao)} e não pode ser vendido para abate em ${formatarData(data)}. Tire-o da venda ou escolha outra finalidade.`
    }
    return ''
  }

  async function registrar(e: FormEvent) {
    e.preventDefault()
    const problema = validar()
    setErro(problema)
    if (problema) return
    const quantidade = plural(itens.length, 'animal', 'animais')
    if (!(await confirmar({ titulo: 'Registrar venda?', confirmar: 'Registrar venda',
      mensagem: `${quantidade} para ${comprador.trim()}, total de ${real(valorTotal)}. Depois de registrada, a venda não pode ser desfeita pela tela.` }))) return

    setSalvando(true)
    const corpo = {
      comprador: comprador.trim(),
      data_venda: data,
      gta: { ...gta, numero_gta: gta.numero_gta.trim(), origem: origem.trim(), destino: gta.destino.trim() },
      animais: itens.map(i => ({ brinco: i.animal.brinco, peso_final_kg: Number(i.peso), valor_venda: Number(i.valor) })),
    }
    try {
      const resposta = await enviar<{ mensagem: string }>('/baixas/vendas', 'POST', corpo)
      onRegistrada({ mensagem: resposta.mensagem, comprador: corpo.comprador, data,
        numero_gta: corpo.gta.numero_gta, brincos: itens.map(i => i.animal.brinco) })
      setComprador('')
      setData(hoje)
      setGta(g => ({ numero_gta: '', data_emissao: hoje, origem: g.origem, destino: '', finalidade: 'ABATE' }))
      setItens([])
      setErro('')
    } catch (erroApi) {
      // Ex.: "RI-19: o animal 0110 está em carência até 09/02/2027 e não pode ser vendido para abate em 14/11/2026."
      setErro(mensagemDeErro(erroApi))
    } finally {
      setSalvando(false)
    }
  }

  return <form className="compra" onSubmit={registrar} noValidate>
    <section className="content-card" aria-labelledby="venda-dados">
      <h2 id="venda-dados">Dados da venda</h2>
      <div className="cadastro-form__campos">
        <Input label="Comprador" value={comprador} maxLength={100} required placeholder="Frigorífico, fazenda ou pessoa"
          onChange={e => alterarComprador(e.target.value)} />
        <Input label="Data da venda" type="date" value={data} max={hoje} required onChange={e => setData(e.target.value)} />
        <Input label="Preço da arroba (R$/@)" type="number" min="0.01" step="0.01" value={precoArroba}
          placeholder="Opcional" onChange={e => alterarPreco(e.target.value)} />
      </div>
      <p className="cadastro-form__dica">
        Com o preço da arroba, o valor de cada animal é calculado pelo peso (peso ÷ {KG_POR_ARROBA} × preço). O valor continua editável.
      </p>
    </section>

    <section className="content-card" aria-labelledby="venda-gta">
      <h2 id="venda-gta">GTA de saída</h2>
      <div className="cadastro-form__campos">
        <Input label="Número da GTA" value={gta.numero_gta} maxLength={20} required placeholder="MG-26-0050001"
          onChange={e => setGta({ ...gta, numero_gta: e.target.value.toUpperCase() })} />
        <Input label="Data de emissão" type="date" value={gta.data_emissao} max={hoje} required
          onChange={e => setGta({ ...gta, data_emissao: e.target.value })} />
        <Selecao label="Finalidade" value={gta.finalidade}
          onChange={e => { setGta({ ...gta, finalidade: e.target.value }); setErro('') }}>
          {FINALIDADES_SAIDA.map(f => <option key={f.id} value={f.id}>{f.rotulo}</option>)}
        </Selecao>
        <Input label="Origem" value={origem} maxLength={100} required placeholder="Fazenda - Município/UF"
          onChange={e => setGta({ ...gta, origem: e.target.value })} />
        <Input label="Destino" value={gta.destino} maxLength={100} required placeholder="Comprador - Município/UF"
          onChange={e => setGta({ ...gta, destino: e.target.value })} />
      </div>
      {abate && <p className="cadastro-form__dica">
        Venda para abate: animais em carência (remédio ou vacina recente) não podem ir. Eles aparecem marcados em vermelho.
      </p>}
    </section>

    <section className="content-card" aria-labelledby="venda-animais">
      <div className="compra-animais__topo">
        <h2 id="venda-animais">Animais</h2>
        <span className="venda-resumo">
          <span><strong>{plural(itens.length, 'animal', 'animais')}</strong></span>
          <span>{formatarNumero(pesoTotal, 1)} kg ({formatarNumero(pesoTotal / KG_POR_ARROBA, 1)} @)</span>
          <span>total <strong>{real(valorTotal)}</strong></span>
        </span>
      </div>

      {itens.map(i => {
        const liberacao = emCarencia(i.animal.brinco)
        return <fieldset key={i.animal.brinco} className={`venda-animal${liberacao ? ' venda-animal--carencia' : ''}`}>
          <legend className="sr-only">Animal {i.animal.brinco}</legend>
          <div className="venda-animal__info">
            <LinkAnimal brinco={i.animal.brinco} />
            <span className="texto-secundario">{i.animal.categoria} · {i.animal.raca} · {i.animal.piquete_atual ?? 'sem piquete'}</span>
            {liberacao && <span className="etiqueta etiqueta--erro">em carência até {formatarData(liberacao)}</span>}
          </div>
          <Input label="Peso final (kg)" type="number" min="0.1" step="0.1" value={i.peso} required
            onChange={e => alterarItem(i.animal.brinco, 'peso', e.target.value)} />
          <Input label="Valor (R$)" type="number" min="0.01" step="0.01" value={i.valor} required
            onChange={e => alterarItem(i.animal.brinco, 'valor', e.target.value)} />
          <button type="button" className="acao-icone" aria-label={`Tirar o animal ${i.animal.brinco} da venda`}
            onClick={() => { setItens(lista => lista.filter(x => x.animal.brinco !== i.animal.brinco)); setErro('') }}>
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </fieldset>
      })}

      <EscolherAnimal animais={animais} ignorar={itens.map(i => i.animal.brinco)} carencia={carenciaParaBusca}
        rotulo={itens.length ? 'Adicionar mais um animal' : 'Adicionar animal'} onEscolher={adicionar} />
    </section>

    {erro && <p className="cadastro-form__erro" role="alert">{erro}</p>}
    <div className="cadastro-form__botoes compra__acoes">
      <Button type="submit" loading={salvando} className="cadastro-form__salvar">Registrar venda</Button>
    </div>
  </form>
}
