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
import type { UsuarioCadastro } from '../../types/cadastros'
import type { PesagemRegistro } from '../../types/manejos'
import { combina } from '../../utils/busca'
import { formatarData, formatarNumero, formatarPeso, plural } from '../../utils/formatar'
import { FormPesagem } from './FormPesagem'
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
      {aba === 'historico' && <ListaPesagens pesagens={pesagens} onRegistrar={() => setAba('registrar')} />}

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

function ListaPesagens({ pesagens, onRegistrar }: {
  pesagens: ReturnType<typeof useDados<PesagemRegistro[]>>
  onRegistrar: () => void
}) {
  const { dados, ...estado } = pesagens
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
    <EstadoDados {...estado}>
      {dados && <Tabela legenda="Histórico de pesagens" colunas={colunas} linhas={visiveis}
        chave={p => `${p.brinco}|${p.data_pesagem}`}
        vazio={<Vazio busca={busca} onLimparBusca={() => setBusca('')} titulo="Nenhuma pesagem registrada"
          texto="As pesagens aparecem aqui depois de registradas."
          acao={{ rotulo: 'Registrar pesagem', permissao: 'pesagens.criar', onClick: onRegistrar }} />} />}
    </EstadoDados>
  </section>
}
