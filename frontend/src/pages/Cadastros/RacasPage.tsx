import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Can } from '../../auth/Can'
import { usePermissions } from '../../auth/permissions'
import { CampoBusca } from '../../components/cadastro/CampoBusca'
import { AvisoErro, CabecalhoCadastro, FormularioCadastro } from '../../components/cadastro/FormularioCadastro'
import { AvisoSucesso } from '../../components/ui/AvisoSucesso'
import { EstadoDados } from '../../components/ui/EstadoDados'
import { Input } from '../../components/ui/Input'
import { Tabela, type Coluna } from '../../components/ui/Tabela'
import { useAvisoSucesso } from '../../hooks/useAvisoSucesso'
import { useDados } from '../../hooks/useDados'
import { useAcaoLinha, useFormulario } from '../../hooks/useFormulario'
import type { Raca } from '../../types/animais'
import { combina } from '../../utils/busca'
import { enviar } from '../../utils/enviar'
import { plural } from '../../utils/formatar'

const VAZIO = { nome: '' }

export function RacasPage() {
  const { dados, ...estado } = useDados<Raca[]>('/racas')
  const { pode } = usePermissions()
  const form = useFormulario(VAZIO)
  const linha = useAcaoLinha()
  const sucesso = useAvisoSucesso()
  const f = form.valores
  const [busca, setBusca] = useState('')
  const visiveis = (dados ?? []).filter(r => combina(busca, r.nome))

  function salvar() {
    const nome = f.nome.trim()
    form.executar(
      () => form.editando
        ? enviar(`/racas/${form.editandoId}`, 'PUT', { nome })
        : enviar('/racas', 'POST', { nome }),
      () => { estado.recarregar(); sucesso.mostrar(form.editando ? `Raça ${nome} atualizada.` : `Raça ${nome} cadastrada.`) },
    )
  }

  function excluir(r: Raca) {
    if (r.animais > 0) {
      linha.mostrarAviso(`A raça ${r.nome} não pode ser excluída: ${plural(r.animais, 'animal está cadastrado', 'animais estão cadastrados')} com ela.`)
      return
    }
    if (!window.confirm(`Excluir a raça ${r.nome}?`)) return
    linha.executar(() => enviar(`/racas/${r.id_raca}`, 'DELETE'),
      () => { estado.recarregar(); sucesso.mostrar(`Raça ${r.nome} excluída.`) })
  }

  const colunas: Coluna<Raca>[] = [
    { titulo: 'Raça', valor: r => <strong>{r.nome}</strong> },
    { titulo: 'Animais', valor: r => plural(r.animais, 'animal', 'animais'), alinhar: 'direita' },
  ]
  if (pode('racas.editar') || pode('racas.excluir')) {
    colunas.push({ titulo: 'Ações', alinhar: 'direita', valor: r => <div className="acoes-linha">
      <Can permissao="racas.editar">
        <button type="button" className="acao-linha" onClick={() => form.abrirEdicao(r.id_raca, { nome: r.nome })}
          aria-label={`Editar ${r.nome}`}><Pencil size={14} aria-hidden="true" />Editar</button>
      </Can>
      <Can permissao="racas.excluir">
        <button type="button" className="acao-linha acao-linha--perigo" disabled={linha.ocupado} onClick={() => excluir(r)}
          aria-label={`Excluir ${r.nome}`}><Trash2 size={14} aria-hidden="true" />Excluir</button>
      </Can>
    </div> })
  }

  return <>
    <CabecalhoCadastro titulo="Raças" descricao="Raças usadas no cadastro dos animais."
      acao={!form.aberto && <Can permissao="racas.criar">
        <button type="button" className="botao-novo" onClick={form.abrirNovo}><Plus size={18} aria-hidden="true" />Nova raça</button>
      </Can>} />

    {form.aberto && <FormularioCadastro titulo={form.editando ? 'Editar raça' : 'Nova raça'}
      salvando={form.salvando} erro={form.erro} onSalvar={salvar} onCancelar={form.fechar}>
      <Input label="Nome" value={f.nome} maxLength={50} required autoFocus placeholder="Nelore"
        onChange={e => form.alterar('nome', e.target.value)} />
    </FormularioCadastro>}

    <section className="content-card" aria-label="Lista de raças">
      <div className="cadastro-filtros-linha">
        <CampoBusca valor={busca} onChange={setBusca} placeholder="Nome da raça" />
      </div>
      <AvisoErro mensagem={linha.aviso} onFechar={linha.limparAviso} />
      <EstadoDados {...estado}>
        {dados && <Tabela legenda="Raças" colunas={colunas} linhas={visiveis}
          chave={r => String(r.id_raca)}
          vazio={busca.trim() ? 'Nenhuma raça encontrada para essa busca.' : 'Nenhuma raça cadastrada.'} />}
      </EstadoDados>
    </section>
    <AvisoSucesso {...sucesso} />
  </>
}
