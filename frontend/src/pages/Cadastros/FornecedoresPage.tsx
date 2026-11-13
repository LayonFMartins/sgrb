import { useSearchParams } from 'react-router-dom'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { Can } from '../../auth/Can'
import { usePermissions } from '../../auth/permissions'
import { CampoBusca } from '../../components/cadastro/CampoBusca'
import { LinkFicha } from '../../components/cadastro/LinkFicha'
import { AvisoErro, CabecalhoCadastro, FormularioCadastro, Selecao } from '../../components/cadastro/FormularioCadastro'
import { EstadoDados } from '../../components/ui/EstadoDados'
import { Input } from '../../components/ui/Input'
import { Tabela, type Coluna } from '../../components/ui/Tabela'
import { useDados } from '../../hooks/useDados'
import { useAcaoLinha, useFormulario } from '../../hooks/useFormulario'
import type { Fornecedor } from '../../types/cadastros'
import { enviar } from '../../utils/enviar'
import { combina } from '../../utils/busca'
import { plural } from '../../utils/formatar'
import { mascararTelefone, telefoneCompleto } from '../../utils/telefone'
import { useParametro } from '../../hooks/useParametro'
import { useConfirmacao } from '../../hooks/useConfirmacao'
import { Vazio } from '../../components/ui/Vazio'
import { FichaFornecedor } from './FichaFornecedor'

const VAZIO = { nome_produtor: '', nome_propriedade: '', municipio: '', uf: '', telefones: [''] }

// As mesmas siglas aceitas pelo banco (CHECK ck_fornecedor_uf).
const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB',
  'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO']

// A ficha abre na mesma rota: /fornecedores?ficha=1 (igual à ficha do animal).
export function FornecedoresPage() {
  const [params] = useSearchParams()
  const ficha = params.get('ficha')
  return ficha ? <FichaFornecedor key={ficha} id={ficha} /> : <ListaFornecedores />
}

function ListaFornecedores() {
  const { dados, ...estado } = useDados<Fornecedor[]>('/fornecedores')
  const { pode } = usePermissions()
  const form = useFormulario(VAZIO)
  const linha = useAcaoLinha()
  const confirmar = useConfirmacao()
  const f = form.valores
  const [busca, setBusca] = useParametro('busca')
  const visiveis = (dados ?? []).filter(x => combina(busca, x.nome_produtor, x.nome_propriedade,
    x.municipio, x.uf, ...x.telefones, ...x.telefones.map(t => t.replace(/\D/g, ''))))

  function salvar() {
    const corpo = { ...f, telefones: f.telefones.filter(t => t.trim()) }
    const incompleto = corpo.telefones.find(t => !telefoneCompleto(t))
    form.executar(
      async () => {
        if (incompleto) throw new Error(`O telefone ${incompleto} está incompleto: informe o DDD e o número (10 ou 11 dígitos).`)
        return form.editando
          ? enviar(`/fornecedores/${form.editandoId}`, 'PUT', corpo)
          : enviar('/fornecedores', 'POST', corpo)
      },
      estado.recarregar,
    )
  }

  function editar(x: Fornecedor) {
    form.abrirEdicao(x.id_fornecedor, {
      nome_produtor: x.nome_produtor, nome_propriedade: x.nome_propriedade,
      municipio: x.municipio, uf: x.uf, telefones: x.telefones.length ? x.telefones.map(mascararTelefone) : [''],
    })
  }

  async function excluir(x: Fornecedor) {
    if (!(await confirmar({ titulo: 'Excluir fornecedor?', confirmar: 'Excluir', perigo: true,
      mensagem: `${x.nome_produtor} será removido do cadastro. Fornecedores com compras registradas não podem ser excluídos.` }))) return
    linha.executar(() => enviar(`/fornecedores/${x.id_fornecedor}`, 'DELETE'), estado.recarregar)
  }

  function alterarTelefone(i: number, valor: string) {
    form.alterar('telefones', f.telefones.map((t, j) => j === i ? mascararTelefone(valor) : t))
  }

  const colunas: Coluna<Fornecedor>[] = [
    { titulo: 'Produtor', valor: x => <LinkFicha para={`/fornecedores?ficha=${x.id_fornecedor}`}
      titulo={`Ver as compras feitas com ${x.nome_produtor}`}>{x.nome_produtor}</LinkFicha>, csv: x => x.nome_produtor },
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
      <Selecao label="UF" value={f.uf} required onChange={e => form.alterar('uf', e.target.value)}>
        <option value="">Selecione…</option>
        {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
      </Selecao>
      <div className="cadastro-telefones cadastro-form__campo-largo">
        {f.telefones.map((t, i) => <div key={i} className="cadastro-telefones__linha">
          <Input label={`Telefone ${i + 1}`} value={t} maxLength={15} type="tel" inputMode="numeric" placeholder="(31) 99999-0000"
            onChange={e => alterarTelefone(i, e.target.value)} />
          {f.telefones.length > 1 && <button type="button" className="acao-icone" aria-label={`Remover telefone ${i + 1}`}
            onClick={() => form.alterar('telefones', f.telefones.filter((_, j) => j !== i))}><X size={16} aria-hidden="true" /></button>}
        </div>)}
        <button type="button" className="acao-linha" style={{ width: 'fit-content' }}
          onClick={() => form.alterar('telefones', [...f.telefones, ''])}><Plus size={14} aria-hidden="true" />Adicionar telefone</button>
      </div>
    </FormularioCadastro>}

    <section className="content-card" aria-label="Lista de fornecedores">
      <div className="cadastro-filtros-linha">
        <CampoBusca valor={busca} onChange={setBusca} placeholder="Produtor, cidade ou telefone" />
      </div>
      <AvisoErro mensagem={linha.aviso} onFechar={linha.limparAviso} />
      <EstadoDados {...estado}>
        {dados && <Tabela legenda="Fornecedores" colunas={colunas} linhas={visiveis}
          chave={x => String(x.id_fornecedor)}
          vazio={<Vazio busca={busca} onLimparBusca={() => setBusca('')}
            titulo="Nenhum fornecedor cadastrado ainda" texto="Fornecedores são os produtores de quem a fazenda compra animais. Eles aparecem na tela de Compras."
            acao={!form.aberto && { rotulo: 'Cadastrar o primeiro fornecedor', permissao: 'fornecedores.criar', onClick: form.abrirNovo }} />} />}
      </EstadoDados>
    </section>
  </>
}
