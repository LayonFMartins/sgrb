import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { usePermissions } from '../../auth/permissions'
import { LinkAnimal } from '../../components/animais/LinkAnimal'
import { CampoBusca } from '../../components/cadastro/CampoBusca'
import { AvisoSucesso } from '../../components/ui/AvisoSucesso'
import { EstadoDados } from '../../components/ui/EstadoDados'
import { Tabela, type Coluna } from '../../components/ui/Tabela'
import { Vazio } from '../../components/ui/Vazio'
import { useAvisoSucesso } from '../../hooks/useAvisoSucesso'
import { useDados } from '../../hooks/useDados'
import { useParametro } from '../../hooks/useParametro'
import type { Animal } from '../../types/animais'
import type { UsuarioCadastro } from '../../types/cadastros'
import type { PesagemRegistro } from '../../types/manejos'
import { combina } from '../../utils/busca'
import { formatarData, formatarNumero, formatarPeso, plural } from '../../utils/formatar'
import { FormPesagem } from './FormPesagem'
import { AvisoErro } from '../../components/cadastro/FormularioCadastro'
import { useConfirmacao } from '../../hooks/useConfirmacao'
import { useAcaoLinha } from '../../hooks/useFormulario'
import { enviar } from '../../utils/enviar'
import '../../components/cadastro/Cadastro.css'
import '../Compras/Compras.css'
import '../Relatorios/Relatorios.css'
import './Pesagens.css'

type Aba = 'historico' | 'registrar'

// O back devolve as 500 pesagens mais recentes (GET /api/pesagens).
const LIMITE_LISTA = 500

const variacao = (p: PesagemRegistro) => p.peso_anterior_kg === null ? null : p.peso_kg - p.peso_anterior_kg

const colunas: Coluna<PesagemRegistro>[] = [
  { titulo: 'Data', valor: p => formatarData(p.data_pesagem), ordenar: p => p.data_pesagem },
  { titulo: 'Animal', valor: p => <LinkAnimal brinco={p.brinco} />, csv: p => p.brinco },
  { titulo: 'Peso', valor: p => formatarPeso(p.peso_kg), ordenar: p => p.peso_kg, alinhar: 'direita' },
  { titulo: 'Variação', alinhar: 'direita', ordenar: variacao,
    valor: p => {
      const v = variacao(p)
      return v === null ? '—' : `${v > 0 ? '+' : ''}${formatarNumero(v, 1)} kg`
    } },
  { titulo: 'GMD', alinhar: 'direita', ordenar: p => p.gmd_kg_dia,
    valor: p => p.gmd_kg_dia === null ? '—' : `${formatarNumero(p.gmd_kg_dia, 3)} kg/dia` },
  { titulo: 'Responsável', valor: p => p.responsavel },
]

// Pesagens: histórico (com variação e GMD desde a pesagem anterior) e registro de novas pesagens.
// As abas ficam no endereço (/pesagens?aba=registrar), igual a Vendas e baixas.
export function PesagensPage() {
  const { pode } = usePermissions()
  const [abaPedida, setAba] = useParametro('aba', 'historico')
  const abas: { id: Aba; rotulo: string }[] = [
    { id: 'historico', rotulo: 'Histórico' },
    ...(pode('pesagens.criar') ? [{ id: 'registrar' as const, rotulo: 'Registrar pesagem' }] : []),
  ]
  const aba: Aba = abas.some(a => a.id === abaPedida) ? abaPedida as Aba : 'historico'

  // Dados compartilhados: as listas recarregam depois de cada registro.
  const pesagens = useDados<PesagemRegistro[]>('/pesagens')
  const animais = useDados<Animal[]>('/animais?situacao=Ativo')
  const usuarios = useDados<UsuarioCadastro[]>('/usuarios?ativo=true')
  const sucesso = useAvisoSucesso()

  // Ficam aqui (e não no formulário) porque o formulário some enquanto as listas recarregam.
  const [data, setData] = useState(() => new Date().toLocaleDateString('sv-SE'))
  const [responsavel, setResponsavel] = useState('')

  function depoisDeRegistrar(mensagem: string) {
    sucesso.mostrar(mensagem)
    pesagens.recarregar()
    animais.recarregar()
  }

  return <>
    <header className="page-heading">
      <h1>Pesagens</h1>
      <p>Peso dos animais ao longo do tempo. O GMD é o ganho médio diário desde a pesagem anterior.</p>
    </header>

    <div className="abas" role="tablist" aria-label="Pesagens">
      {abas.map(a => <button key={a.id} id={`aba-${a.id}`} type="button" role="tab"
        aria-selected={aba === a.id} aria-controls="painel-pesagens"
        className={`abas__botao${aba === a.id ? ' abas__botao--ativa' : ''}`}
        onClick={() => setAba(a.id)}>{a.rotulo}</button>)}
    </div>

    <div id="painel-pesagens" role="tabpanel" aria-labelledby={`aba-${aba}`}>
      {aba === 'historico' && <ListaPesagens pesagens={pesagens} onRegistrar={() => setAba('registrar')} onExcluida={depoisDeRegistrar}
        ativos={new Set((animais.dados ?? []).map(a => a.brinco))} />}

      {aba === 'registrar' && <EstadoDados carregando={animais.carregando || usuarios.carregando}
        erro={animais.erro || usuarios.erro}
        recarregar={() => { animais.recarregar(); usuarios.recarregar() }}>
        <FormPesagem animais={animais.dados ?? []} usuarios={usuarios.dados ?? []}
          data={data} onData={setData} responsavel={responsavel} onResponsavel={setResponsavel}
          onRegistrada={depoisDeRegistrar} />
      </EstadoDados>}
    </div>
    <AvisoSucesso {...sucesso} />
  </>
}

// ativos: só animais do rebanho podem ter o histórico corrigido (vendidos e mortos ficam como estão).
function ListaPesagens({ pesagens, onRegistrar, onExcluida, ativos }: {
  pesagens: ReturnType<typeof useDados<PesagemRegistro[]>>
  onRegistrar: () => void
  onExcluida: (mensagem: string) => void
  ativos: Set<string>
}) {
  const { dados, ...estado } = pesagens
  const { pode } = usePermissions()
  const confirmar = useConfirmacao()
  const linha = useAcaoLinha()

  // Corrigir pesagem lançada errado (só o proprietário). O GMD das seguintes é recalculado pelo banco.
  async function excluir(p: PesagemRegistro) {
    if (!(await confirmar({ titulo: `Excluir a pesagem do animal ${p.brinco}?`, confirmar: 'Excluir', perigo: true,
      mensagem: `${formatarPeso(p.peso_kg)} em ${formatarData(p.data_pesagem)}. O ganho de peso (GMD) da pesagem seguinte será recalculado.` }))) return
    let mensagem = ''
    linha.executar(async () => {
      mensagem = (await enviar<{ mensagem: string }>(`/pesagens/${encodeURIComponent(p.brinco)}/${p.data_pesagem.slice(0, 10)}`, 'DELETE')).mensagem
    }, () => onExcluida(mensagem))
  }
  const colunasComAcao: Coluna<PesagemRegistro>[] = pode('pesagens.excluir') ? [...colunas, { titulo: 'Ações', alinhar: 'direita',
    valor: p => !ativos.has(p.brinco) ? <span className="texto-secundario" title="Animal fora do rebanho">—</span>
      : <button type="button" className="acao-linha acao-linha--perigo" disabled={linha.ocupado}
      onClick={() => excluir(p)} aria-label={`Excluir a pesagem de ${p.brinco} em ${formatarData(p.data_pesagem)}`}>
      <Trash2 size={14} aria-hidden="true" />Excluir</button> }] : colunas
  const [busca, setBusca] = useParametro('busca')

  const todas = dados ?? []
  const visiveis = todas.filter(p => combina(busca, p.brinco, p.responsavel, formatarData(p.data_pesagem)))

  return <section className="content-card pesagens-painel" aria-label="Histórico de pesagens">
    <div className="cadastro-filtros-linha">
      <CampoBusca valor={busca} onChange={setBusca} placeholder="Brinco, responsável ou data" />
    </div>
    {todas.length > 0 && <p className="cadastro-form__dica">
      {plural(visiveis.length, 'pesagem', 'pesagens')}
      {todas.length >= LIMITE_LISTA && ` · mostrando as ${LIMITE_LISTA} mais recentes; a ficha do animal tem o histórico completo`}
    </p>}
    <AvisoErro mensagem={linha.aviso} onFechar={linha.limparAviso} />
    <EstadoDados {...estado}>
      {dados && <Tabela legenda="Histórico de pesagens" colunas={colunasComAcao} linhas={visiveis}
        chave={p => `${p.brinco}|${p.data_pesagem}`}
        vazio={<Vazio busca={busca} onLimparBusca={() => setBusca('')} titulo="Nenhuma pesagem registrada"
          texto="As pesagens aparecem aqui depois de registradas."
          acao={{ rotulo: 'Registrar pesagem', permissao: 'pesagens.criar', onClick: onRegistrar }} />} />}
    </EstadoDados>
  </section>
}
