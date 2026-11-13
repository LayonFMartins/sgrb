import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Can } from '../../auth/Can'
import { usePermissions } from '../../auth/permissions'
import { CampoBusca } from '../../components/cadastro/CampoBusca'
import { AvisoErro, CabecalhoCadastro, FormularioCadastro, Selecao } from '../../components/cadastro/FormularioCadastro'
import { EstadoDados } from '../../components/ui/EstadoDados'
import { Input } from '../../components/ui/Input'
import { Tabela, type Coluna } from '../../components/ui/Tabela'
import { useDados } from '../../hooks/useDados'
import { useAcaoLinha, useFormulario } from '../../hooks/useFormulario'
import type { ProdutoSanitario, TipoProduto } from '../../types/cadastros'
import { combina } from '../../utils/busca'
import { enviar } from '../../utils/enviar'
import { plural } from '../../utils/formatar'
import '../Relatorios/Relatorios.css'

const TIPOS: { id: TipoProduto; rotulo: string }[] = [
  { id: 'VACINA', rotulo: 'Vacina' },
  { id: 'VERMIFUGO', rotulo: 'Vermífugo' },
  { id: 'ANTIBIOTICO', rotulo: 'Antibiótico' },
]
const nomeTipo = (t: TipoProduto) => TIPOS.find(x => x.id === t)?.rotulo ?? t

const VAZIO = {
  nome: '', tipo: 'VACINA', doenca_alvo: '', carencia_dias: '0', num_doses: '1',
  intervalo_reforco_dias: '', sexo_alvo: '', idade_min_meses: '', idade_max_meses: '',
}

const texto = (n: number | null) => n === null ? '' : String(n)

function faixaEtaria(p: ProdutoSanitario) {
  if (p.idade_min_meses === null && p.idade_max_meses === null) return 'Qualquer idade'
  if (p.idade_max_meses === null) return `A partir de ${plural(p.idade_min_meses ?? 0, 'mês', 'meses')}`
  return `${p.idade_min_meses ?? 0} a ${plural(p.idade_max_meses, 'mês', 'meses')}`
}

export function ProdutosPage() {
  const [tipo, setTipo] = useState<TipoProduto | ''>('')
  const { dados, ...estado } = useDados<ProdutoSanitario[]>(`/produtos${tipo ? `?tipo=${tipo}` : ''}`)
  const { pode } = usePermissions()
  const form = useFormulario(VAZIO)
  const linha = useAcaoLinha()
  const f = form.valores
  const [busca, setBusca] = useState('')
  const visiveis = (dados ?? []).filter(p => combina(busca, p.nome, p.doenca_alvo, nomeTipo(p.tipo)))

  function salvar() {
    form.executar(
      () => form.editando
        ? enviar(`/produtos/${form.editandoId}`, 'PUT', f)
        : enviar('/produtos', 'POST', f),
      estado.recarregar,
    )
  }

  function editar(p: ProdutoSanitario) {
    form.abrirEdicao(p.id_produto, {
      nome: p.nome, tipo: p.tipo, doenca_alvo: p.doenca_alvo,
      carencia_dias: String(p.carencia_dias), num_doses: String(p.num_doses),
      intervalo_reforco_dias: texto(p.intervalo_reforco_dias), sexo_alvo: p.sexo_alvo ?? '',
      idade_min_meses: texto(p.idade_min_meses), idade_max_meses: texto(p.idade_max_meses),
    })
  }

  function excluir(p: ProdutoSanitario) {
    if (!window.confirm(`Excluir o produto ${p.nome}?`)) return
    linha.executar(() => enviar(`/produtos/${p.id_produto}`, 'DELETE'), estado.recarregar)
  }

  const colunas: Coluna<ProdutoSanitario>[] = [
    { titulo: 'Produto', valor: p => <strong>{p.nome}</strong> },
    { titulo: 'Tipo', valor: p => <span className="etiqueta etiqueta--neutra">{nomeTipo(p.tipo)}</span> },
    { titulo: 'Doença alvo', valor: p => p.doenca_alvo },
    { titulo: 'Doses', valor: p => p.num_doses, alinhar: 'direita' },
    { titulo: 'Reforço', valor: p => p.intervalo_reforco_dias ? `a cada ${plural(p.intervalo_reforco_dias, 'dia', 'dias')}` : '—' },
    { titulo: 'Carência', valor: p => plural(p.carencia_dias, 'dia', 'dias'), alinhar: 'direita' },
    { titulo: 'Restrição', valor: p => <>
      {p.sexo_alvo ? (p.sexo_alvo === 'F' ? 'Fêmeas' : 'Machos') : 'Ambos os sexos'}
      <br /><span className="texto-secundario">{faixaEtaria(p)}</span>
    </> },
  ]
  if (pode('produtos.editar') || pode('produtos.excluir')) {
    colunas.push({ titulo: 'Ações', alinhar: 'direita', valor: p => <div className="acoes-linha">
      <Can permissao="produtos.editar">
        <button type="button" className="acao-linha" onClick={() => editar(p)} aria-label={`Editar ${p.nome}`}><Pencil size={14} aria-hidden="true" />Editar</button>
      </Can>
      <Can permissao="produtos.excluir">
        <button type="button" className="acao-linha acao-linha--perigo" disabled={linha.ocupado} onClick={() => excluir(p)} aria-label={`Excluir ${p.nome}`}><Trash2 size={14} aria-hidden="true" />Excluir</button>
      </Can>
    </div> })
  }

  return <>
    <CabecalhoCadastro titulo="Produtos sanitários" descricao="Vacinas, vermífugos e antibióticos usados no manejo sanitário."
      acao={!form.aberto && <Can permissao="produtos.criar">
        <button type="button" className="botao-novo" onClick={form.abrirNovo}><Plus size={18} aria-hidden="true" />Novo produto</button>
      </Can>} />

    {form.aberto && <FormularioCadastro titulo={form.editando ? 'Editar produto' : 'Novo produto'}
      salvando={form.salvando} erro={form.erro} onSalvar={salvar} onCancelar={form.fechar}>
      <Input label="Nome" value={f.nome} maxLength={80} required autoFocus
        onChange={e => form.alterar('nome', e.target.value)} />
      <Selecao label="Tipo" value={f.tipo} onChange={e => form.alterar('tipo', e.target.value)}>
        {TIPOS.map(t => <option key={t.id} value={t.id}>{t.rotulo}</option>)}
      </Selecao>
      <Input label="Doença alvo" value={f.doenca_alvo} maxLength={80} required
        onChange={e => form.alterar('doenca_alvo', e.target.value)} />
      <Input label="Carência (dias)" value={f.carencia_dias} type="number" min="0" step="1" required
        onChange={e => form.alterar('carencia_dias', e.target.value)} />
      <Input label="Número de doses" value={f.num_doses} type="number" min="1" step="1" required
        onChange={e => form.alterar('num_doses', e.target.value)} />
      <Input label="Intervalo de reforço (dias)" value={f.intervalo_reforco_dias} type="number" min="1" step="1"
        placeholder="Sem reforço" onChange={e => form.alterar('intervalo_reforco_dias', e.target.value)} />
      <Selecao label="Sexo alvo" value={f.sexo_alvo} onChange={e => form.alterar('sexo_alvo', e.target.value)}>
        <option value="">Ambos</option>
        <option value="F">Fêmeas</option>
        <option value="M">Machos</option>
      </Selecao>
      <Input label="Idade mínima (meses)" value={f.idade_min_meses} type="number" min="0" step="1"
        placeholder="Sem mínimo" onChange={e => form.alterar('idade_min_meses', e.target.value)} />
      <Input label="Idade máxima (meses)" value={f.idade_max_meses} type="number" min="0" step="1"
        placeholder="Sem máximo" onChange={e => form.alterar('idade_max_meses', e.target.value)} />
    </FormularioCadastro>}

    <section className="content-card" aria-label="Lista de produtos sanitários">
      <div className="cadastro-filtros-linha">
        <div className="seletor" role="group" aria-label="Filtrar por tipo">
          {[{ id: '' as const, rotulo: 'Todos' }, ...TIPOS].map(t =>
            <button key={t.id} type="button" aria-pressed={tipo === t.id}
              className={`seletor__botao${tipo === t.id ? ' seletor__botao--ativo' : ''}`}
              onClick={() => setTipo(t.id)}>{t.rotulo}</button>)}
        </div>
        <CampoBusca valor={busca} onChange={setBusca} placeholder="Nome do produto ou doença alvo" />
      </div>
      <AvisoErro mensagem={linha.aviso} onFechar={linha.limparAviso} />
      <EstadoDados {...estado}>
        {dados && <Tabela legenda="Produtos sanitários" colunas={colunas} linhas={visiveis}
          chave={p => String(p.id_produto)}
          vazio={busca.trim() ? 'Nenhum produto encontrado para essa busca.' : 'Nenhum produto cadastrado.'} />}
      </EstadoDados>
    </section>
  </>
}
