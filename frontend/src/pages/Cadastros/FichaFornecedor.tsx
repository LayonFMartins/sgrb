import { LinkAnimal } from '../../components/animais/LinkAnimal'
import { CabecalhoFicha, Dado } from '../../components/cadastro/CabecalhoFicha'
import { LinkFicha } from '../../components/cadastro/LinkFicha'
import { EstadoDados } from '../../components/ui/EstadoDados'
import { Tabela, type Coluna } from '../../components/ui/Tabela'
import { useDados } from '../../hooks/useDados'
import type { CompraFornecedor, Fornecedor } from '../../types/cadastros'
import { formatarData, formatarNumero, plural } from '../../utils/formatar'
import '../Animais/Animais.css'
import './FichaFornecedor.css'

const real = (valor: number) => `R$ ${formatarNumero(valor, 2)}`
const FINALIDADE: Record<string, string> = { CRIA: 'Cria', RECRIA: 'Recria', ENGORDA: 'Engorda', ABATE: 'Abate' }

const colunas: Coluna<CompraFornecedor>[] = [
  { titulo: 'Data', valor: c => formatarData(c.data_compra), ordenar: c => c.data_compra },
  { titulo: 'GTA', valor: c => c.numero_gta
    ? <LinkFicha para={`/gta?busca=${encodeURIComponent(c.numero_gta)}`} titulo={`Ver a GTA ${c.numero_gta}`}>{c.numero_gta}</LinkFicha>
    : '—', csv: c => c.numero_gta },
  { titulo: 'Finalidade', valor: c => c.finalidade ? FINALIDADE[c.finalidade] ?? c.finalidade : '—' },
  { titulo: 'Animais', alinhar: 'direita', ordenar: c => c.animais, valor: c => <>
    {c.animais}
    {c.ainda_na_fazenda < c.animais && <span className="texto-secundario"> ({c.ainda_na_fazenda} na fazenda)</span>}
  </> },
  { titulo: 'Valor total', valor: c => real(c.valor_total), ordenar: c => c.valor_total, alinhar: 'direita' },
  { titulo: 'Média por animal', valor: c => real(c.valor_total / c.animais), ordenar: c => c.valor_total / c.animais, alinhar: 'direita' },
  { titulo: 'Brincos', ordenavel: false, valor: c => <span className="compra-brincos">
    {c.brincos.map(b => <LinkAnimal key={b} brinco={b} />)}
  </span> },
]

// Ficha do fornecedor: /fornecedores?ficha=1 — dados + histórico de compras.
export function FichaFornecedor({ id }: { id: string }) {
  const fornecedor = useDados<Fornecedor>(`/fornecedores/${encodeURIComponent(id)}`)
  const compras = useDados<CompraFornecedor[]>(`/fornecedores/${encodeURIComponent(id)}/compras`)
  const f = fornecedor.dados
  const lista = compras.dados ?? []
  const totalAnimais = lista.reduce((s, c) => s + c.animais, 0)
  const totalGasto = lista.reduce((s, c) => s + c.valor_total, 0)
  const naFazenda = lista.reduce((s, c) => s + c.ainda_na_fazenda, 0)

  return <>
    <CabecalhoFicha lista="/fornecedores" rotuloLista="Voltar para os fornecedores" titulo={f ? f.nome_produtor : 'Fornecedor'}>
      {f && `${f.nome_propriedade} · ${f.municipio}/${f.uf}`}
    </CabecalhoFicha>

    <EstadoDados carregando={fornecedor.carregando || compras.carregando} erro={fornecedor.erro || compras.erro}
      recarregar={() => { fornecedor.recarregar(); compras.recarregar() }}>
      {f && <div className="ficha">
        <section className="content-card" aria-labelledby="fornecedor-resumo">
          <h2 id="fornecedor-resumo">Resumo</h2>
          <dl className="ficha-dados">
            <Dado rotulo="Compras">{lista.length}</Dado>
            <Dado rotulo="Animais comprados">{totalAnimais}</Dado>
            <Dado rotulo="Ainda na fazenda">{naFazenda}</Dado>
            <Dado rotulo="Total gasto">{real(totalGasto)}</Dado>
            <Dado rotulo="Média por animal">{totalAnimais ? real(totalGasto / totalAnimais) : '—'}</Dado>
            <Dado rotulo="Telefones">{f.telefones.length ? f.telefones.join(' · ') : '—'}</Dado>
          </dl>
        </section>

        <section className="content-card" aria-labelledby="fornecedor-compras">
          <h2 id="fornecedor-compras">Histórico de compras</h2>
          <Tabela legenda={`Compras feitas com ${f.nome_produtor}`} colunas={colunas} linhas={lista}
            chave={c => `${c.data_compra}-${c.numero_gta ?? ''}`}
            vazio="Nenhuma compra registrada com este fornecedor." />
        </section>
      </div>}
    </EstadoDados>
  </>
}
