import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { Can } from '../../auth/Can'
import { usePermissions } from '../../auth/permissions'
import { AvisoErro, CabecalhoCadastro, FormularioCadastro } from '../../components/cadastro/FormularioCadastro'
import { EstadoDados } from '../../components/ui/EstadoDados'
import { Input } from '../../components/ui/Input'
import { Tabela, type Coluna } from '../../components/ui/Tabela'
import { useDados } from '../../hooks/useDados'
import { useAcaoLinha, useFormulario } from '../../hooks/useFormulario'
import type { Fornecedor } from '../../types/cadastros'
import { enviar } from '../../utils/enviar'
import { plural } from '../../utils/formatar'

const VAZIO = { nome_produtor: '', nome_propriedade: '', municipio: '', uf: '', telefones: [''] }

export function FornecedoresPage() {
  const { dados, ...estado } = useDados<Fornecedor[]>('/fornecedores')
  const { pode } = usePermissions()
  const form = useFormulario(VAZIO)
  const linha = useAcaoLinha()
  const f = form.valores

  function salvar() {
    const corpo = { ...f, telefones: f.telefones.filter(t => t.trim()) }
    form.executar(
      () => form.editando
        ? enviar(`/fornecedores/${form.editandoId}`, 'PUT', corpo)
        : enviar('/fornecedores', 'POST', corpo),
      estado.recarregar,
    )
  }

  function editar(x: Fornecedor) {
    form.abrirEdicao(x.id_fornecedor, {
      nome_produtor: x.nome_produtor, nome_propriedade: x.nome_propriedade,
      municipio: x.municipio, uf: x.uf, telefones: x.telefones.length ? x.telefones : [''],
    })
  }

  function excluir(x: Fornecedor) {
    if (!window.confirm(`Excluir o fornecedor ${x.nome_produtor}?`)) return
    linha.executar(() => enviar(`/fornecedores/${x.id_fornecedor}`, 'DELETE'), estado.recarregar)
  }

  function alterarTelefone(i: number, valor: string) {
    form.alterar('telefones', f.telefones.map((t, j) => j === i ? valor : t))
  }

  const colunas: Coluna<Fornecedor>[] = [
    { titulo: 'Produtor', valor: x => <strong>{x.nome_produtor}</strong> },
    { titulo: 'Propriedade', valor: x => x.nome_propriedade },
    { titulo: 'Município', valor: x => `${x.municipio}/${x.uf}` },
    { titulo: 'Telefones', valor: x => x.telefones.join(' · ') || '—' },
    { titulo: 'Animais comprados', valor: x => plural(x.animais, 'animal', 'animais'), alinhar: 'direita' },
  ]
  if (pode('fornecedores.editar') || pode('fornecedores.excluir')) {
    colunas.push({ titulo: 'Ações', alinhar: 'direita', valor: x => <div className="acoes-linha">
      <Can permissao="fornecedores.editar">
        <button type="button" className="acao-linha" onClick={() => editar(x)} aria-label={`Editar ${x.nome_produtor}`}><Pencil size={14} aria-hidden="true" />Editar</button>
      </Can>
      <Can permissao="fornecedores.excluir">
        <button type="button" className="acao-linha acao-linha--perigo" disabled={linha.ocupado} onClick={() => excluir(x)} aria-label={`Excluir ${x.nome_produtor}`}><Trash2 size={14} aria-hidden="true" />Excluir</button>
      </Can>
    </div> })
  }

  return <>
    <CabecalhoCadastro titulo="Fornecedores" descricao="Produtores de quem a fazenda compra animais."
      acao={!form.aberto && <Can permissao="fornecedores.criar">
        <button type="button" className="botao-novo" onClick={form.abrirNovo}><Plus size={18} aria-hidden="true" />Novo fornecedor</button>
      </Can>} />

    {form.aberto && <FormularioCadastro titulo={form.editando ? 'Editar fornecedor' : 'Novo fornecedor'}
      salvando={form.salvando} erro={form.erro} onSalvar={salvar} onCancelar={form.fechar}>
      <Input label="Nome do produtor" value={f.nome_produtor} maxLength={100} required autoFocus
        onChange={e => form.alterar('nome_produtor', e.target.value)} />
      <Input label="Nome da propriedade" value={f.nome_propriedade} maxLength={100} required
        onChange={e => form.alterar('nome_propriedade', e.target.value)} />
      <Input label="Município" value={f.municipio} maxLength={60} required
        onChange={e => form.alterar('municipio', e.target.value)} />
      <Input label="UF" value={f.uf} maxLength={2} required placeholder="MG"
        onChange={e => form.alterar('uf', e.target.value.toUpperCase())} />
      <div className="cadastro-telefones cadastro-form__campo-largo">
        {f.telefones.map((t, i) => <div key={i} className="cadastro-telefones__linha">
          <Input label={`Telefone ${i + 1}`} value={t} maxLength={20} type="tel" placeholder="(31) 99999-0000"
            onChange={e => alterarTelefone(i, e.target.value)} />
          {f.telefones.length > 1 && <button type="button" className="acao-icone" aria-label={`Remover telefone ${i + 1}`}
            onClick={() => form.alterar('telefones', f.telefones.filter((_, j) => j !== i))}><X size={16} aria-hidden="true" /></button>}
        </div>)}
        <button type="button" className="acao-linha" style={{ width: 'fit-content' }}
          onClick={() => form.alterar('telefones', [...f.telefones, ''])}><Plus size={14} aria-hidden="true" />Adicionar telefone</button>
      </div>
    </FormularioCadastro>}

    <section className="content-card" aria-label="Lista de fornecedores">
      <AvisoErro mensagem={linha.aviso} onFechar={linha.limparAviso} />
      <EstadoDados {...estado}>
        {dados && <Tabela legenda="Fornecedores" colunas={colunas} linhas={dados}
          chave={x => String(x.id_fornecedor)} vazio="Nenhum fornecedor cadastrado." />}
      </EstadoDados>
    </section>
  </>
}
