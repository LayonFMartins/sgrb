import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Can } from '../../auth/Can'
import { usePermissions } from '../../auth/permissions'
import { AvisoErro, CabecalhoCadastro, FormularioCadastro, Selecao } from '../../components/cadastro/FormularioCadastro'
import { EstadoDados } from '../../components/ui/EstadoDados'
import { Input } from '../../components/ui/Input'
import { Tabela, type Coluna } from '../../components/ui/Tabela'
import { useDados } from '../../hooks/useDados'
import { useAcaoLinha, useFormulario } from '../../hooks/useFormulario'
import type { Animal, Raca, Situacao } from '../../types/animais'
import { enviar } from '../../utils/enviar'
import { formatarData, formatarPeso } from '../../utils/formatar'
import { FichaAnimal } from './FichaAnimal'
import { ETIQUETA_SITUACAO, idade, nomeSexo } from './animal'
import '../Relatorios/Relatorios.css'
import './Animais.css'

const VAZIO = { brinco: '', sexo: 'F', data_nascimento: '', id_raca: '', brinco_mae: '' }

const FILTROS: { id: Situacao | 'Todos'; rotulo: string }[] = [
  { id: 'Ativo', rotulo: 'Ativos' },
  { id: 'Vendido', rotulo: 'Vendidos' },
  { id: 'Óbito', rotulo: 'Óbitos' },
  { id: 'Todos', rotulo: 'Todos' },
]

// A ficha abre na mesma rota: /animais?ficha=0001
export function AnimaisPage() {
  const [params] = useSearchParams()
  const ficha = params.get('ficha')
  return ficha ? <FichaAnimal key={ficha} brinco={ficha} /> : <ListaAnimais />
}

function ListaAnimais() {
  const { dados, ...estado } = useDados<Animal[]>('/animais')
  const { dados: racas } = useDados<Raca[]>('/racas')
  const { pode } = usePermissions()
  const form = useFormulario<typeof VAZIO, string>(VAZIO)
  const linha = useAcaoLinha()
  const f = form.valores
  const [filtro, setFiltro] = useState<Situacao | 'Todos'>('Ativo')
  const [busca, setBusca] = useState('')

  const animais = dados ?? []
  const termo = busca.trim().toLocaleLowerCase('pt-BR')
  const visiveis = animais.filter(a =>
    (filtro === 'Todos' || a.situacao === filtro) &&
    (!termo || [a.brinco, a.raca, a.categoria, a.piquete_atual ?? ''].some(t => t.toLocaleLowerCase('pt-BR').includes(termo))))
  const total = (id: Situacao | 'Todos') => id === 'Todos' ? animais.length : animais.filter(a => a.situacao === id).length

  // Mães possíveis: fêmeas nascidas antes da cria, menos o próprio animal em edição.
  const maes = animais.filter(a => a.sexo === 'F' && a.brinco !== form.editandoId &&
    (!f.data_nascimento || a.data_nascimento.slice(0, 10) < f.data_nascimento || a.brinco === f.brinco_mae))
  const hoje = new Date().toLocaleDateString('sv-SE') // AAAA-MM-DD no fuso local

  function salvar() {
    const corpo = { ...f, brinco: f.brinco.trim(), id_raca: Number(f.id_raca) || null, brinco_mae: f.brinco_mae || null }
    form.executar(
      async () => {
        if (f.data_nascimento > hoje) throw new Error('A data de nascimento não pode estar no futuro.')
        return form.editando
          ? enviar(`/animais/${encodeURIComponent(form.editandoId ?? '')}`, 'PUT', corpo)
          : enviar('/animais', 'POST', corpo)
      },
      estado.recarregar,
    )
  }

  function editar(a: Animal) {
    // A lista traz o nome da raça; o formulário precisa do id.
    const idRaca = racas?.find(r => r.nome === a.raca)?.id_raca
    form.abrirEdicao(a.brinco, {
      brinco: a.brinco, sexo: a.sexo, data_nascimento: a.data_nascimento.slice(0, 10),
      id_raca: idRaca ? String(idRaca) : '', brinco_mae: a.brinco_mae ?? '',
    })
  }

  function excluir(a: Animal) {
    if (!window.confirm(`Excluir o animal ${a.brinco}? Todo o histórico dele (pesagens, aplicações, movimentações) também será apagado.`)) return
    linha.executar(() => enviar(`/animais/${encodeURIComponent(a.brinco)}`, 'DELETE'), estado.recarregar)
  }

  const colunas: Coluna<Animal>[] = [
    { titulo: 'Brinco', valor: a => <Link className="animal-link" to={`/animais?ficha=${encodeURIComponent(a.brinco)}`}>{a.brinco}</Link> },
    { titulo: 'Raça', valor: a => a.raca },
    // A categoria já indica o sexo (Bezerro/Bezerra, Garrote/Novilha, Boi/Vaca).
    { titulo: 'Categoria', valor: a => <span title={nomeSexo(a.sexo)}>{a.categoria}</span> },
    { titulo: 'Idade', valor: a => idade(a.idade_meses), alinhar: 'direita' },
    { titulo: 'Origem', valor: a => <span className="sem-quebra" title={a.fornecedor ?? undefined}>{a.origem}</span> },
    { titulo: 'Piquete', valor: a => <span className="sem-quebra">{a.piquete_atual ?? '—'}</span> },
    { titulo: 'Último peso', valor: a => a.ultimo_peso_kg === null ? '—'
      : <span title={`Pesado em ${formatarData(a.data_ultimo_peso)}`}>{formatarPeso(a.ultimo_peso_kg)}</span>, alinhar: 'direita' },
  ]
  // Com um filtro de situação ativo, a coluna seria igual em todas as linhas.
  if (filtro === 'Todos') {
    colunas.push({ titulo: 'Situação', valor: a => <span className={`etiqueta etiqueta--${ETIQUETA_SITUACAO[a.situacao]}`}>{a.situacao}</span> })
  }
  if (pode('animais.editar') || pode('animais.excluir')) {
    colunas.push({ titulo: 'Ações', alinhar: 'direita', valor: a => <div className="acoes-linha">
      <Can permissao="animais.editar">
        <button type="button" className="acao-linha" onClick={() => editar(a)} aria-label={`Editar ${a.brinco}`}><Pencil size={14} aria-hidden="true" />Editar</button>
      </Can>
      <Can permissao="animais.excluir">
        <button type="button" className="acao-linha acao-linha--perigo" disabled={linha.ocupado} onClick={() => excluir(a)} aria-label={`Excluir ${a.brinco}`}><Trash2 size={14} aria-hidden="true" />Excluir</button>
      </Can>
    </div> })
  }

  return <>
    <CabecalhoCadastro titulo="Animais" descricao="Rebanho da fazenda. Clique no brinco para ver a ficha e o histórico do animal."
      acao={!form.aberto && <Can permissao="animais.criar">
        <button type="button" className="botao-novo" onClick={form.abrirNovo}><Plus size={18} aria-hidden="true" />Registrar nascimento</button>
      </Can>} />

    {form.aberto && <FormularioCadastro titulo={form.editando ? `Editar animal ${form.editandoId}` : 'Registrar nascimento'}
      salvando={form.salvando} erro={form.erro} onSalvar={salvar} onCancelar={form.fechar}>
      <Input label="Brinco" value={f.brinco} maxLength={20} required autoFocus placeholder="0301"
        onChange={e => form.alterar('brinco', e.target.value)} />
      <Selecao label="Sexo" value={f.sexo} onChange={e => form.alterar('sexo', e.target.value)}>
        <option value="F">Fêmea</option>
        <option value="M">Macho</option>
      </Selecao>
      <Input label="Data de nascimento" type="date" value={f.data_nascimento} max={hoje} required
        onChange={e => form.alterar('data_nascimento', e.target.value)} />
      <Selecao label="Raça" value={f.id_raca} required onChange={e => form.alterar('id_raca', e.target.value)}>
        <option value="">Selecione…</option>
        {racas?.map(r => <option key={r.id_raca} value={r.id_raca}>{r.nome}</option>)}
      </Selecao>
      <Selecao label="Mãe" value={f.brinco_mae} onChange={e => form.alterar('brinco_mae', e.target.value)}>
        <option value="">Não registrada</option>
        {maes.map(m => <option key={m.brinco} value={m.brinco}>
          {m.brinco} · {m.raca}{m.situacao !== 'Ativo' ? ` (${m.situacao.toLocaleLowerCase('pt-BR')})` : ''}
        </option>)}
      </Selecao>
      <p className="cadastro-form__dica cadastro-form__campo-largo">
        {form.editando
          ? 'Alterar o brinco atualiza também o histórico e as crias do animal.'
          : 'Animais comprados entram pela tela de Compras, junto com a GTA. Aqui ficam os nascidos na fazenda e o rebanho inicial (sem mãe registrada).'}
      </p>
    </FormularioCadastro>}

    <section className="content-card" aria-label="Lista de animais">
      <div className="animais-filtros">
        <div className="seletor" role="group" aria-label="Filtrar por situação">
          {FILTROS.map(s => <button key={s.id} type="button" aria-pressed={filtro === s.id}
            className={`seletor__botao${filtro === s.id ? ' seletor__botao--ativo' : ''}`}
            onClick={() => setFiltro(s.id)}>{s.rotulo} <span className="seletor__qtd">{total(s.id)}</span></button>)}
        </div>
        <Input label="Buscar" className="animais-busca" type="search" value={busca} placeholder="Brinco, raça, categoria ou piquete"
          icon={<Search size={16} />} onChange={e => setBusca(e.target.value)} />
      </div>
      <AvisoErro mensagem={linha.aviso} onFechar={linha.limparAviso} />
      <EstadoDados {...estado}>
        {dados && <Tabela legenda="Animais" colunas={colunas} linhas={visiveis} chave={a => a.brinco}
          vazio={termo ? 'Nenhum animal encontrado para essa busca.' : 'Nenhum animal nesta situação.'} />}
      </EstadoDados>
    </section>
  </>
}
