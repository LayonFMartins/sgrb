import { useSearchParams } from 'react-router-dom'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Can } from '../../auth/Can'
import { usePermissions } from '../../auth/permissions'
import { CampoBusca } from '../../components/cadastro/CampoBusca'
import { LinkFicha } from '../../components/cadastro/LinkFicha'
import { AvisoErro, CabecalhoCadastro, FormularioCadastro } from '../../components/cadastro/FormularioCadastro'
import { EstadoDados } from '../../components/ui/EstadoDados'
import { Input } from '../../components/ui/Input'
import { Tabela, type Coluna } from '../../components/ui/Tabela'
import { useDados } from '../../hooks/useDados'
import { useAcaoLinha, useFormulario } from '../../hooks/useFormulario'
import type { PiqueteCadastro } from '../../types/cadastros'
import { combina } from '../../utils/busca'
import { enviar } from '../../utils/enviar'
import { formatarData, formatarNumero, plural } from '../../utils/formatar'
import { useParametro } from '../../hooks/useParametro'
import { useConfirmacao } from '../../hooks/useConfirmacao'
import { Vazio } from '../../components/ui/Vazio'
import { FichaPiquete } from './FichaPiquete'

const VAZIO = { nome: '', area_ha: '', capacidade_max: '', descanso_min_dias: '' }

const ETIQUETA_SITUACAO: Record<PiqueteCadastro['situacao'], string> = {
  'Em uso': 'ok',
  'Em descanso': 'alerta',
  'Disponível': 'neutra',
}

// A ficha abre na mesma rota: /piquetes?ficha=1 (igual à ficha do animal).
export function PiquetesPage() {
  const [params] = useSearchParams()
  const ficha = params.get('ficha')
  return ficha ? <FichaPiquete key={ficha} id={ficha} /> : <ListaPiquetes />
}

function ListaPiquetes() {
  const { dados, ...estado } = useDados<PiqueteCadastro[]>('/piquetes')
  const { pode } = usePermissions()
  const form = useFormulario(VAZIO)
  const linha = useAcaoLinha()
  const confirmar = useConfirmacao()
  const f = form.valores
  const [busca, setBusca] = useParametro('busca')
  const visiveis = (dados ?? []).filter(p => combina(busca, p.nome, p.situacao))

  function salvar() {
    form.executar(
      () => form.editando
        ? enviar(`/piquetes/${form.editandoId}`, 'PUT', f)
        : enviar('/piquetes', 'POST', f),
      estado.recarregar,
    )
  }

  function editar(p: PiqueteCadastro) {
    form.abrirEdicao(p.id_piquete, {
      nome: p.nome, area_ha: String(p.area_ha),
      capacidade_max: String(p.capacidade_max), descanso_min_dias: String(p.descanso_min_dias),
    })
  }

  async function excluir(p: PiqueteCadastro) {
    // Mesmo aviso da tela de Raças: explica o motivo sem nem chamar a API.
    if (p.animais_historico > 0) {
      linha.mostrarAviso(`O piquete ${p.nome} não pode ser excluído: ${plural(p.animais_historico, 'animal já passou', 'animais já passaram')} por ele, e esse histórico precisa ser mantido.`)
      return
    }
    if (!(await confirmar({ titulo: 'Excluir piquete?', confirmar: 'Excluir', perigo: true,
      mensagem: `O piquete ${p.nome} será removido do cadastro.` }))) return
    linha.executar(() => enviar(`/piquetes/${p.id_piquete}`, 'DELETE'), estado.recarregar)
  }

  const colunas: Coluna<PiqueteCadastro>[] = [
    { titulo: 'Piquete', valor: p => <LinkFicha para={`/piquetes?ficha=${p.id_piquete}`}
      titulo={`Ver os animais do piquete ${p.nome}`}>{p.nome}</LinkFicha>, csv: p => p.nome },
    { titulo: 'Área', valor: p => `${formatarNumero(p.area_ha, 2)} ha`, alinhar: 'direita' },
    { titulo: 'Lotação', valor: p => `${p.animais} de ${p.capacidade_max}`, alinhar: 'direita' },
    { titulo: 'Vagas', valor: p => p.vagas, alinhar: 'direita' },
    { titulo: 'Descanso mínimo', valor: p => plural(p.descanso_min_dias, 'dia', 'dias'), alinhar: 'direita' },
    { titulo: 'Situação', valor: p => <span className={`etiqueta etiqueta--${ETIQUETA_SITUACAO[p.situacao]}`}>
      {p.situacao}{p.data_liberacao ? ` até ${formatarData(p.data_liberacao)}` : ''}
    </span> },
  ]
  if (pode('piquetes.editar') || pode('piquetes.excluir')) {
    colunas.push({ titulo: 'Ações', alinhar: 'direita', valor: p => <div className="acoes-linha">
      <Can permissao="piquetes.editar">
        <button type="button" className="acao-linha" onClick={() => editar(p)} aria-label={`Editar ${p.nome}`}><Pencil size={14} aria-hidden="true" />Editar</button>
      </Can>
      <Can permissao="piquetes.excluir">
        <button type="button" className="acao-linha acao-linha--perigo" disabled={linha.ocupado} onClick={() => excluir(p)} aria-label={`Excluir ${p.nome}`}><Trash2 size={14} aria-hidden="true" />Excluir</button>
      </Can>
    </div> })
  }

  return <>
    <CabecalhoCadastro titulo="Piquetes" descricao="Áreas de pasto da fazenda, com capacidade e período mínimo de descanso."
      acao={!form.aberto && <Can permissao="piquetes.criar">
        <button type="button" className="botao-novo" onClick={form.abrirNovo}><Plus size={18} aria-hidden="true" />Novo piquete</button>
      </Can>} />

    {form.aberto && <FormularioCadastro titulo={form.editando ? 'Editar piquete' : 'Novo piquete'}
      salvando={form.salvando} erro={form.erro} onSalvar={salvar} onCancelar={form.fechar}>
      <Input label="Nome" value={f.nome} maxLength={30} required autoFocus placeholder="P07 - Morro"
        onChange={e => form.alterar('nome', e.target.value)} />
      <Input label="Área (ha)" value={f.area_ha} type="number" min="0.01" step="0.01" required
        onChange={e => form.alterar('area_ha', e.target.value)} />
      <Input label="Capacidade máxima (cabeças)" value={f.capacidade_max} type="number" min="1" step="1" required
        onChange={e => form.alterar('capacidade_max', e.target.value)} />
      <Input label="Descanso mínimo (dias)" value={f.descanso_min_dias} type="number" min="0" step="1" required
        onChange={e => form.alterar('descanso_min_dias', e.target.value)} />
    </FormularioCadastro>}

    <section className="content-card" aria-label="Lista de piquetes">
      <div className="cadastro-filtros-linha">
        <CampoBusca valor={busca} onChange={setBusca} placeholder="Nome ou situação (ex.: Em descanso)" />
      </div>
      <AvisoErro mensagem={linha.aviso} onFechar={linha.limparAviso} />
      <EstadoDados {...estado}>
        {dados && <Tabela legenda="Piquetes" colunas={colunas} linhas={visiveis}
          chave={p => String(p.id_piquete)}
          vazio={<Vazio busca={busca} onLimparBusca={() => setBusca('')}
            titulo="Nenhum piquete cadastrado ainda" texto="Piquetes são as áreas de pasto onde os animais ficam. Cadastre-os para registrar as movimentações."
            acao={!form.aberto && { rotulo: 'Cadastrar o primeiro piquete', permissao: 'piquetes.criar', onClick: form.abrirNovo }} />} />}
      </EstadoDados>
    </section>
  </>
}
