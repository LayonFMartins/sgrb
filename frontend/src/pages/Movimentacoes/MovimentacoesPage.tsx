import { Undo2 } from 'lucide-react'
import { useState } from 'react'
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
import type { PiqueteCadastro } from '../../types/cadastros'
import type { MovimentacaoRegistro } from '../../types/manejos'
import { combina } from '../../utils/busca'
import { formatarData, plural } from '../../utils/formatar'
import { useConfirmacao } from '../../hooks/useConfirmacao'
import { useAcaoLinha } from '../../hooks/useFormulario'
import { enviar } from '../../utils/enviar'
import { AvisoErro } from '../../components/cadastro/FormularioCadastro'
import { FormMovimentacao, type CabecalhoMovimentacao } from './FormMovimentacao'
import '../../components/cadastro/Cadastro.css'
import '../Compras/Compras.css'
import '../Relatorios/Relatorios.css'
import './Movimentacoes.css'

type Aba = 'historico' | 'registrar'
type Filtro = 'TODAS' | 'ATUAIS'

// O back devolve as 500 movimentações mais recentes (GET /api/movimentacoes).
const LIMITE_LISTA = 500

// Dias entre duas datas 'AAAA-MM-DD' (em UTC: sem bug de fuso nem de horário de verão).
function diasEntre(inicio: string, fim: string): number {
  return Math.round((Date.parse(`${fim}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / 86_400_000)
}

// Colunas do histórico. "hoje" é o fim da permanência de quem ainda está no piquete.
function colunasDoHistorico(hoje: string): Coluna<MovimentacaoRegistro>[] {
  const permanencia = (m: MovimentacaoRegistro) => diasEntre(m.data_entrada, m.data_saida ?? hoje)
  return [
    { titulo: 'Animal', valor: m => <LinkAnimal brinco={m.brinco} />, csv: m => m.brinco },
    { titulo: 'Piquete', valor: m => m.piquete },
    { titulo: 'Entrada', valor: m => formatarData(m.data_entrada), ordenar: m => m.data_entrada },
    { titulo: 'Saída', ordenar: m => m.data_saida,
      csv: m => m.data_saida ? formatarData(m.data_saida) : 'no piquete',
      valor: m => m.data_saida ? formatarData(m.data_saida) : <span className="etiqueta etiqueta--ok">no piquete</span> },
    { titulo: 'Permanência', alinhar: 'direita', ordenar: permanencia,
      valor: m => plural(permanencia(m), 'dia', 'dias') },
  ]
}

// Movimentações: onde cada animal ficou (histórico de ocupação dos piquetes) e a mudança
// de animais entre piquetes. As abas ficam no endereço (?aba=registrar), como nas outras telas.
export function MovimentacoesPage() {
  const { pode } = usePermissions()
  const [abaPedida, setAba] = useParametro('aba', 'historico')
  const abas: { id: Aba; rotulo: string }[] = [
    { id: 'historico', rotulo: 'Histórico' },
    ...(pode('movimentacoes.criar') ? [{ id: 'registrar' as const, rotulo: 'Mover animais' }] : []),
  ]
  const aba: Aba = abas.some(a => a.id === abaPedida) ? abaPedida as Aba : 'historico'

  // Dados compartilhados: as listas recarregam depois de cada movimentação (as vagas mudam).
  const movimentacoes = useDados<MovimentacaoRegistro[]>('/movimentacoes')
  const animais = useDados<Animal[]>('/animais?situacao=Ativo')
  const piquetes = useDados<PiqueteCadastro[]>('/piquetes')
  const sucesso = useAvisoSucesso()

  // Ficam aqui (e não no formulário) porque o formulário some enquanto as listas recarregam.
  const [cabecalho, setCabecalho] = useState<CabecalhoMovimentacao>(() => ({
    destino: '', data: new Date().toLocaleDateString('sv-SE'),
  }))

  function depoisDeRegistrar(mensagem: string) {
    sucesso.mostrar(mensagem)
    movimentacoes.recarregar()
    animais.recarregar()
    piquetes.recarregar()
  }

  return <>
    <header className="page-heading">
      <h1>Movimentações</h1>
      <p>Histórico de onde cada animal ficou e mudança de animais entre os piquetes.</p>
    </header>

    <div className="abas" role="tablist" aria-label="Movimentações">
      {abas.map(a => <button key={a.id} id={`aba-${a.id}`} type="button" role="tab"
        aria-selected={aba === a.id} aria-controls="painel-movimentacoes"
        className={`abas__botao${aba === a.id ? ' abas__botao--ativa' : ''}`}
        onClick={() => setAba(a.id)}>{a.rotulo}</button>)}
    </div>

    <div id="painel-movimentacoes" role="tabpanel" aria-labelledby={`aba-${aba}`}>
      {aba === 'historico' && <ListaMovimentacoes movimentacoes={movimentacoes} onRegistrar={() => setAba('registrar')} onDesfeita={depoisDeRegistrar} />}

      {aba === 'registrar' && <EstadoDados
        carregando={animais.carregando || piquetes.carregando}
        erro={animais.erro || piquetes.erro}
        recarregar={() => { animais.recarregar(); piquetes.recarregar() }}>
        <FormMovimentacao animais={animais.dados ?? []} piquetes={piquetes.dados ?? []}
          valores={cabecalho} onAlterar={parcial => setCabecalho(c => ({ ...c, ...parcial }))}
          onRegistrada={depoisDeRegistrar} />
      </EstadoDados>}
    </div>
    <AvisoSucesso {...sucesso} />
  </>
}

function ListaMovimentacoes({ movimentacoes, onRegistrar, onDesfeita }: {
  movimentacoes: ReturnType<typeof useDados<MovimentacaoRegistro[]>>
  onRegistrar: () => void
  onDesfeita: (mensagem: string) => void
}) {
  const { dados, ...estado } = movimentacoes
  const { pode } = usePermissions()
  const confirmar = useConfirmacao()
  const linha = useAcaoLinha()

  // Desfazer só a movimentação atual, e só se ela veio de outro piquete (a primeira entrada,
  // da compra ou do nascimento, não tem para onde voltar).
  const origemDe = (m: MovimentacaoRegistro) =>
    (dados ?? []).find(o => o.brinco === m.brinco && o.data_saida?.slice(0, 10) === m.data_entrada.slice(0, 10))

  async function desfazer(m: MovimentacaoRegistro) {
    const origem = origemDe(m)
    if (!(await confirmar({ titulo: `Desfazer a movimentação do animal ${m.brinco}?`, confirmar: 'Desfazer', perigo: true,
      mensagem: `A entrada em ${m.piquete} em ${formatarData(m.data_entrada)} será apagada e o animal volta para ${origem?.piquete ?? 'o piquete anterior'}.` }))) return
    let mensagem = ''
    linha.executar(async () => {
      mensagem = (await enviar<{ mensagem: string }>(
        `/movimentacoes/${encodeURIComponent(m.brinco)}/${m.data_entrada.slice(0, 10)}`, 'DELETE')).mensagem
    }, () => onDesfeita(mensagem))
  }
  const [filtroPedido, setFiltro] = useParametro('mostrar', 'TODAS')
  const filtro: Filtro = filtroPedido === 'ATUAIS' ? 'ATUAIS' : 'TODAS'
  const [busca, setBusca] = useParametro('busca')
  const hoje = new Date().toLocaleDateString('sv-SE')

  const todas = dados ?? []
  const atuais = todas.filter(m => m.atual).length
  const visiveis = todas.filter(m => (filtro === 'TODAS' || m.atual) &&
    combina(busca, m.brinco, m.piquete, formatarData(m.data_entrada), formatarData(m.data_saida)))
  const filtros: { id: Filtro; rotulo: string; total: number }[] = [
    { id: 'TODAS', rotulo: 'Todo o histórico', total: todas.length },
    { id: 'ATUAIS', rotulo: 'No piquete agora', total: atuais },
  ]

  return <section className="content-card movimentacoes-painel" aria-label="Histórico de movimentações">
    <div className="cadastro-filtros-linha">
      <div className="seletor" role="group" aria-label="Filtrar o histórico">
        {filtros.map(f => <button key={f.id} type="button" aria-pressed={filtro === f.id}
          className={`seletor__botao${filtro === f.id ? ' seletor__botao--ativo' : ''}`}
          onClick={() => setFiltro(f.id)}>{f.rotulo} <span className="seletor__qtd">{f.total}</span></button>)}
      </div>
      <CampoBusca valor={busca} onChange={setBusca} placeholder="Brinco, piquete ou data" />
    </div>
    {todas.length >= LIMITE_LISTA && <p className="cadastro-form__dica">
      Mostrando as {LIMITE_LISTA} movimentações mais recentes; a ficha do animal tem o histórico completo.
    </p>}
    <AvisoErro mensagem={linha.aviso} onFechar={linha.limparAviso} />
    <EstadoDados {...estado}>
      {dados && <Tabela legenda="Histórico de movimentações" linhas={visiveis}
        colunas={pode('movimentacoes.excluir') ? [...colunasDoHistorico(hoje), { titulo: 'Ações', alinhar: 'direita',
          valor: m => m.atual && origemDe(m)
            ? <button type="button" className="acao-linha acao-linha--perigo" disabled={linha.ocupado} onClick={() => desfazer(m)}
              aria-label={`Desfazer a movimentação de ${m.brinco} para ${m.piquete}`}><Undo2 size={14} aria-hidden="true" />Desfazer</button>
            : <span className="texto-secundario">—</span> }] : colunasDoHistorico(hoje)}
        chave={m => `${m.brinco}|${m.data_entrada}`}
        vazio={<Vazio busca={busca} onLimparBusca={() => setBusca('')} titulo="Nenhuma movimentação registrada"
          texto="Quando um animal entra ou muda de piquete, o registro aparece aqui."
          acao={{ rotulo: 'Mover animais', permissao: 'movimentacoes.criar', onClick: onRegistrar }} />} />}
    </EstadoDados>
  </section>
}
