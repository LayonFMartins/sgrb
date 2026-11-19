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
import type { ProdutoSanitario, UsuarioCadastro } from '../../types/cadastros'
import type { AplicacaoRegistro } from '../../types/manejos'
import { combina } from '../../utils/busca'
import { formatarData, plural } from '../../utils/formatar'
import { FormAplicacao, type CabecalhoAplicacao } from './FormAplicacao'
import { AvisoErro } from '../../components/cadastro/FormularioCadastro'
import { useConfirmacao } from '../../hooks/useConfirmacao'
import { useAcaoLinha } from '../../hooks/useFormulario'
import { enviar } from '../../utils/enviar'
import '../../components/cadastro/Cadastro.css'
import '../Compras/Compras.css'
import '../Relatorios/Relatorios.css'
import './ManejoSanitario.css'

type Aba = 'historico' | 'registrar'

// O back devolve as 500 aplicações mais recentes (GET /api/aplicacoes).
const LIMITE_LISTA = 500

// Colunas do histórico. "hoje" decide se a carência ainda está valendo.
function colunasDoHistorico(hoje: string): Coluna<AplicacaoRegistro>[] {
  return [
    { titulo: 'Data', valor: a => formatarData(a.data_aplicacao), ordenar: a => a.data_aplicacao },
    { titulo: 'Animal', valor: a => <LinkAnimal brinco={a.brinco} />, csv: a => a.brinco },
    { titulo: 'Produto', valor: a => a.produto },
    { titulo: 'Dose', valor: a => `${a.num_dose}/${a.num_doses}`, ordenar: a => a.num_dose },
    { titulo: 'Lote', valor: a => a.lote_medicamento },
    { titulo: 'Carência', ordenar: a => a.carencia_dias > 0 ? a.data_liberacao : null,
      csv: a => a.carencia_dias > 0 ? formatarData(a.data_liberacao) : '',
      valor: a => {
        if (a.carencia_dias === 0) return '—'
        return a.data_liberacao > hoje
          ? <span className="etiqueta etiqueta--alerta">até {formatarData(a.data_liberacao)}</span>
          : `liberado em ${formatarData(a.data_liberacao)}`
      } },
    { titulo: 'Responsável', valor: a => a.responsavel },
  ]
}

// Manejo sanitário: histórico das aplicações (vacinas, vermífugos, antibióticos) com a carência,
// e registro de novas aplicações em lote. As abas ficam no endereço (?aba=registrar).
export function ManejoSanitarioPage() {
  const { pode } = usePermissions()
  const [abaPedida, setAba] = useParametro('aba', 'historico')
  const abas: { id: Aba; rotulo: string }[] = [
    { id: 'historico', rotulo: 'Histórico' },
    ...(pode('aplicacoes.criar') ? [{ id: 'registrar' as const, rotulo: 'Registrar aplicação' }] : []),
  ]
  const aba: Aba = abas.some(a => a.id === abaPedida) ? abaPedida as Aba : 'historico'

  // Dados compartilhados: as listas recarregam depois de cada registro.
  const aplicacoes = useDados<AplicacaoRegistro[]>('/aplicacoes')
  const animais = useDados<Animal[]>('/animais?situacao=Ativo')
  const produtos = useDados<ProdutoSanitario[]>('/produtos')
  const usuarios = useDados<UsuarioCadastro[]>('/usuarios?ativo=true')
  const sucesso = useAvisoSucesso()

  // Ficam aqui (e não no formulário) porque o formulário some enquanto as listas recarregam.
  const [cabecalho, setCabecalho] = useState<CabecalhoAplicacao>(() => ({
    produto: '', data: new Date().toLocaleDateString('sv-SE'), lote: '', responsavel: '',
  }))

  function depoisDeRegistrar(mensagem: string) {
    sucesso.mostrar(mensagem)
    aplicacoes.recarregar()
    animais.recarregar()
  }

  return <>
    <header className="page-heading">
      <h1>Manejo sanitário</h1>
      <p>Vacinas, vermífugos e antibióticos aplicados no rebanho, com a carência de cada produto.</p>
    </header>

    <div className="abas" role="tablist" aria-label="Manejo sanitário">
      {abas.map(a => <button key={a.id} id={`aba-${a.id}`} type="button" role="tab"
        aria-selected={aba === a.id} aria-controls="painel-sanitario"
        className={`abas__botao${aba === a.id ? ' abas__botao--ativa' : ''}`}
        onClick={() => setAba(a.id)}>{a.rotulo}</button>)}
    </div>

    <div id="painel-sanitario" role="tabpanel" aria-labelledby={`aba-${aba}`}>
      {aba === 'historico' && <ListaAplicacoes aplicacoes={aplicacoes} onRegistrar={() => setAba('registrar')} onExcluida={depoisDeRegistrar}
        ativos={new Set((animais.dados ?? []).map(a => a.brinco))} />}

      {aba === 'registrar' && <EstadoDados
        carregando={animais.carregando || produtos.carregando || usuarios.carregando}
        erro={animais.erro || produtos.erro || usuarios.erro}
        recarregar={() => { animais.recarregar(); produtos.recarregar(); usuarios.recarregar() }}>
        <FormAplicacao animais={animais.dados ?? []} produtos={produtos.dados ?? []} usuarios={usuarios.dados ?? []}
          valores={cabecalho} onAlterar={parcial => setCabecalho(c => ({ ...c, ...parcial }))}
          onRegistrada={depoisDeRegistrar} />
      </EstadoDados>}
    </div>
    <AvisoSucesso {...sucesso} />
  </>
}

// ativos: só animais do rebanho podem ter o histórico corrigido (vendidos e mortos ficam como estão).
function ListaAplicacoes({ aplicacoes, onRegistrar, onExcluida, ativos }: {
  aplicacoes: ReturnType<typeof useDados<AplicacaoRegistro[]>>
  onRegistrar: () => void
  onExcluida: (mensagem: string) => void
  ativos: Set<string>
}) {
  const { dados, ...estado } = aplicacoes
  const [busca, setBusca] = useParametro('busca')
  const hoje = new Date().toLocaleDateString('sv-SE')
  const { pode } = usePermissions()
  const confirmar = useConfirmacao()
  const linha = useAcaoLinha()

  // Só a dose mais recente de cada produto em cada animal pode ser excluída (senão a contagem
  // 1ª, 2ª dose fica errada). A lista vem da mais recente para a mais antiga.
  const ultimasDoses = new Set<string>()
  const vistos = new Set<string>()
  for (const a of dados ?? []) {
    const chave = `${a.brinco}|${a.id_produto}`
    if (!vistos.has(chave)) { vistos.add(chave); ultimasDoses.add(`${chave}|${a.data_aplicacao}`) }
  }

  async function excluir(a: AplicacaoRegistro) {
    if (!(await confirmar({ titulo: `Excluir a aplicação no animal ${a.brinco}?`, confirmar: 'Excluir', perigo: true,
      mensagem: `${a.produto} (${a.num_dose}ª dose) em ${formatarData(a.data_aplicacao)}, lote ${a.lote_medicamento}. A carência e o próximo reforço serão recalculados.` }))) return
    let mensagem = ''
    linha.executar(async () => {
      mensagem = (await enviar<{ mensagem: string }>(
        `/aplicacoes/${encodeURIComponent(a.brinco)}/${a.id_produto}/${a.data_aplicacao.slice(0, 10)}`, 'DELETE')).mensagem
    }, () => onExcluida(mensagem))
  }
  const colunas = colunasDoHistorico(hoje)
  if (pode('aplicacoes.excluir')) colunas.push({ titulo: 'Ações', alinhar: 'direita',
    valor: a => ativos.has(a.brinco) && ultimasDoses.has(`${a.brinco}|${a.id_produto}|${a.data_aplicacao}`)
      ? <button type="button" className="acao-linha acao-linha--perigo" disabled={linha.ocupado} onClick={() => excluir(a)}
        aria-label={`Excluir a aplicação de ${a.produto} em ${a.brinco}`}><Trash2 size={14} aria-hidden="true" />Excluir</button>
      : <span className="texto-secundario" title="Exclua antes a dose mais recente deste produto">—</span> })

  const todas = dados ?? []
  const visiveis = todas.filter(a =>
    combina(busca, a.brinco, a.produto, a.lote_medicamento, a.responsavel, formatarData(a.data_aplicacao)))

  return <section className="content-card aplicacoes-painel" aria-label="Histórico de aplicações">
    <div className="cadastro-filtros-linha">
      <CampoBusca valor={busca} onChange={setBusca} placeholder="Brinco, produto, lote, responsável ou data" />
    </div>
    {todas.length > 0 && <p className="cadastro-form__dica">
      {plural(visiveis.length, 'aplicação', 'aplicações')}
      {todas.length >= LIMITE_LISTA && ` · mostrando as ${LIMITE_LISTA} mais recentes; a ficha do animal tem o histórico completo`}
    </p>}
    <AvisoErro mensagem={linha.aviso} onFechar={linha.limparAviso} />
    <EstadoDados {...estado}>
      {dados && <Tabela legenda="Histórico de aplicações" colunas={colunas} linhas={visiveis}
        chave={a => `${a.brinco}|${a.id_produto}|${a.data_aplicacao}`}
        vazio={<Vazio busca={busca} onLimparBusca={() => setBusca('')} titulo="Nenhuma aplicação registrada"
          texto="As vacinas e os tratamentos aparecem aqui depois de registrados."
          acao={{ rotulo: 'Registrar aplicação', permissao: 'aplicacoes.criar', onClick: onRegistrar }} />} />}
    </EstadoDados>
  </section>
}
