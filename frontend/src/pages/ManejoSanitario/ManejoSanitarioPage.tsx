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
import type { ProdutoSanitario, UsuarioCadastro } from '../../types/cadastros'
import type { AplicacaoRegistro } from '../../types/manejos'
import { combina } from '../../utils/busca'
import { formatarData, plural } from '../../utils/formatar'
import { FormAplicacao, type CabecalhoAplicacao } from './FormAplicacao'
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
      {aba === 'historico' && <ListaAplicacoes aplicacoes={aplicacoes} onRegistrar={() => setAba('registrar')} />}

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

function ListaAplicacoes({ aplicacoes, onRegistrar }: {
  aplicacoes: ReturnType<typeof useDados<AplicacaoRegistro[]>>
  onRegistrar: () => void
}) {
  const { dados, ...estado } = aplicacoes
  const [busca, setBusca] = useParametro('busca')
  const hoje = new Date().toLocaleDateString('sv-SE')

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
    <EstadoDados {...estado}>
      {dados && <Tabela legenda="Histórico de aplicações" colunas={colunasDoHistorico(hoje)} linhas={visiveis}
        chave={a => `${a.brinco}|${a.id_produto}|${a.data_aplicacao}`}
        vazio={<Vazio busca={busca} onLimparBusca={() => setBusca('')} titulo="Nenhuma aplicação registrada"
          texto="As vacinas e os tratamentos aparecem aqui depois de registrados."
          acao={{ rotulo: 'Registrar aplicação', permissao: 'aplicacoes.criar', onClick: onRegistrar }} />} />}
    </EstadoDados>
  </section>
}
