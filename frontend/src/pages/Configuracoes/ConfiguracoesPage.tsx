import { useEffect, useState, type FormEvent } from 'react'
import { Database, Monitor, Moon, RefreshCw, Sun } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Can } from '../../auth/Can'
import { Button } from '../../components/ui/Button'
import { AvisoSucesso } from '../../components/ui/AvisoSucesso'
import { EstadoDados } from '../../components/ui/EstadoDados'
import { Input } from '../../components/ui/Input'
import { Tabela, type Coluna } from '../../components/ui/Tabela'
import { useAvisoSucesso } from '../../hooks/useAvisoSucesso'
import { useDados } from '../../hooks/useDados'
import { lerPreferencia, resolverTema, salvarPreferencia, type PreferenciaTema } from '../../tema/tema'
import { enviar, mensagemDeErro } from '../../utils/enviar'
import { formatarNumero } from '../../utils/formatar'
import '../../components/cadastro/Cadastro.css'
import '../Relatorios/Relatorios.css'
import './Configuracoes.css'

export function ConfiguracoesPage() {
  const sucesso = useAvisoSucesso()
  return <>
    <header className="page-heading">
      <h1>Configurações</h1>
      <p>Aparência do sistema, dados da sua conta e informações do banco de dados.</p>
    </header>
    <div className="configuracoes">
      <Aparencia />
      <MinhaConta onSenhaAlterada={() => sucesso.mostrar('Senha alterada. Use a nova senha no próximo login.')} />
      <Can permissao="sistema.visualizar"><Sistema /></Can>
    </div>
    <AvisoSucesso {...sucesso} />
  </>
}

/* ---------- Aparência ---------- */

const OPCOES_TEMA: { id: PreferenciaTema; titulo: string; texto: string; icone: LucideIcon }[] = [
  { id: 'claro', titulo: 'Claro', texto: 'Fundo claro, bom para ambientes iluminados e para o campo.', icone: Sun },
  { id: 'escuro', titulo: 'Escuro', texto: 'Fundo escuro, cansa menos a vista à noite.', icone: Moon },
  { id: 'automatico', titulo: 'Automático', texto: 'Segue o tema do computador ou do celular.', icone: Monitor },
]

function Aparencia() {
  const [preferencia, setPreferencia] = useState<PreferenciaTema>(lerPreferencia)
  // No modo automático, mostra qual tema está valendo agora (e acompanha a troca do sistema).
  const [temaAtual, setTemaAtual] = useState(() => resolverTema(lerPreferencia()))
  useEffect(() => {
    const consulta = window.matchMedia('(prefers-color-scheme: dark)')
    const atualizar = () => setTemaAtual(resolverTema(lerPreferencia()))
    consulta.addEventListener('change', atualizar)
    window.addEventListener('sgrb-tema', atualizar)
    return () => { consulta.removeEventListener('change', atualizar); window.removeEventListener('sgrb-tema', atualizar) }
  }, [])

  function escolher(id: PreferenciaTema) {
    setPreferencia(id)
    salvarPreferencia(id)
  }

  return <section className="content-card config-secao" aria-labelledby="config-aparencia">
    <div className="config-secao__topo">
      <h2 id="config-aparencia">Aparência</h2>
      <p>Vale para este navegador. Em outro computador ou celular, escolha de novo.</p>
    </div>
    <fieldset className="tema-opcoes">
      <legend className="sr-only">Tema</legend>
      {OPCOES_TEMA.map(({ id, titulo, texto, icone: Icone }) => <label key={id}
        className={`tema-opcao${preferencia === id ? ' tema-opcao--ativa' : ''}`}>
        <input type="radio" name="tema" value={id} checked={preferencia === id} onChange={() => escolher(id)} />
        <span className={`tema-opcao__previa tema-opcao__previa--${id}`} aria-hidden="true">
          <span /><span /><span />
        </span>
        <span className="tema-opcao__titulo"><Icone size={16} aria-hidden="true" />{titulo}</span>
        <span className="tema-opcao__texto">
          {texto}
          {id === 'automatico' && preferencia === 'automatico' && <> Agora: <strong>{temaAtual === 'dark' ? 'escuro' : 'claro'}</strong>.</>}
        </span>
      </label>)}
    </fieldset>
  </section>
}

/* ---------- Minha conta ---------- */

interface Conta {
  id_usuario: number
  nome: string
  funcao: string
  tipo: 'PROPRIETARIO' | 'FUNCIONARIO'
  email: string | null
}

const SENHAS_VAZIAS = { atual: '', nova: '', confirmar: '' }

function MinhaConta({ onSenhaAlterada }: { onSenhaAlterada: () => void }) {
  const { dados, ...estado } = useDados<Conta>('/auth/conta')
  const [senhas, setSenhas] = useState(SENHAS_VAZIAS)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const alterar = (campo: keyof typeof SENHAS_VAZIAS) => (valor: string) => {
    setSenhas(s => ({ ...s, [campo]: valor }))
    setErro('')
  }

  async function trocarSenha(e: FormEvent) {
    e.preventDefault()
    if (!senhas.atual || !senhas.nova) return setErro('Preencha a senha atual e a nova senha.')
    if (senhas.nova.length < 6) return setErro('A nova senha precisa ter pelo menos 6 caracteres.')
    if (senhas.nova !== senhas.confirmar) return setErro('A confirmação não é igual à nova senha.')
    setSalvando(true)
    try {
      await enviar('/auth/senha', 'PUT', { senha_atual: senhas.atual, nova_senha: senhas.nova })
      setSenhas(SENHAS_VAZIAS)
      onSenhaAlterada()
    } catch (erroApi) {
      setErro(mensagemDeErro(erroApi))
    } finally {
      setSalvando(false)
    }
  }

  return <section className="content-card config-secao" aria-labelledby="config-conta">
    <div className="config-secao__topo">
      <h2 id="config-conta">Minha conta</h2>
      <p>Para mudar nome, função ou e-mail, peça ao proprietário (tela Usuários).</p>
    </div>
    <EstadoDados {...estado}>
      {dados && <dl className="config-dados">
        <div><dt>Nome</dt><dd>{dados.nome}</dd></div>
        <div><dt>Função</dt><dd>{dados.funcao}</dd></div>
        <div><dt>Perfil</dt><dd>{dados.tipo === 'PROPRIETARIO' ? 'Proprietário (acesso completo)' : 'Funcionário (consulta e manejos)'}</dd></div>
        <div><dt>E-mail de acesso</dt><dd>{dados.email ?? '—'}</dd></div>
      </dl>}
    </EstadoDados>

    <form className="config-senha" onSubmit={trocarSenha} noValidate>
      <h3>Alterar senha</h3>
      <div className="config-senha__campos">
        <Input label="Senha atual" type="password" autoComplete="current-password" value={senhas.atual}
          onChange={e => alterar('atual')(e.target.value)} />
        <Input label="Nova senha" type="password" autoComplete="new-password" value={senhas.nova}
          onChange={e => alterar('nova')(e.target.value)} />
        <Input label="Confirmar nova senha" type="password" autoComplete="new-password" value={senhas.confirmar}
          onChange={e => alterar('confirmar')(e.target.value)} />
      </div>
      <p className="cadastro-form__dica">Pelo menos 6 caracteres. Depois de alterar, a sessão atual continua aberta.</p>
      {erro && <p className="cadastro-form__erro" role="alert">{erro}</p>}
      <div className="cadastro-form__botoes">
        <Button type="submit" loading={salvando} className="cadastro-form__salvar">Alterar senha</Button>
      </div>
    </form>
  </section>
}

/* ---------- Sistema e banco de dados (proprietário) ---------- */

interface InfoSistema {
  banco: { nome: string; versao: string; tamanho: string; horario_servidor: string; latencia_ms: number }
  objetos: { views: number; funcoes: number; triggers: number; restricoes: number }
  tabelas: { tabela: string; registros: number }[]
  regras: { nome: string; tabela: string; momento: string; eventos: string }[]
}

const colunasTabelas: Coluna<InfoSistema['tabelas'][number]>[] = [
  { titulo: 'Tabela', valor: t => <code>{t.tabela}</code> },
  { titulo: 'Registros', valor: t => formatarNumero(t.registros), alinhar: 'direita' },
]

const colunasRegras: Coluna<InfoSistema['regras'][number]>[] = [
  { titulo: 'Trigger', valor: r => <code>{r.nome}</code> },
  { titulo: 'Tabela', valor: r => <code>{r.tabela}</code> },
  { titulo: 'Quando', valor: r => `${r.momento} de ${r.eventos}` },
]

function Sistema() {
  const { dados, ...estado } = useDados<InfoSistema>('/sistema')
  const totalRegistros = dados?.tabelas.reduce((t, x) => t + x.registros, 0) ?? 0

  return <section className="content-card config-secao" aria-labelledby="config-sistema">
    <div className="config-secao__topo config-secao__topo--acoes">
      <div>
        <h2 id="config-sistema">Sistema e banco de dados</h2>
        <p>Situação da conexão e o que existe no banco. Visível só para o proprietário.</p>
      </div>
      <button type="button" className="botao-secundario config-testar" onClick={estado.recarregar} disabled={estado.carregando}>
        <RefreshCw size={16} aria-hidden="true" />Testar conexão
      </button>
    </div>
    <EstadoDados {...estado}>
      {dados && <>
        <p className="config-conexao" role="status">
          <Database size={18} aria-hidden="true" />
          <span><strong>Conectado</strong> ao banco <code>{dados.banco.nome}</code> · PostgreSQL {dados.banco.versao} ·
            {' '}{dados.banco.tamanho} · resposta em {dados.banco.latencia_ms} ms</span>
        </p>
        <dl className="consulta-totais config-objetos">
          <div><dt>Tabelas</dt><dd>{dados.tabelas.length}</dd><p>{formatarNumero(totalRegistros)} registros</p></div>
          <div><dt>Regras (triggers)</dt><dd>{dados.objetos.triggers}</dd><p>executadas pelo próprio banco</p></div>
          <div><dt>Views</dt><dd>{dados.objetos.views}</dd><p>usadas nos relatórios</p></div>
          <div><dt>Funções</dt><dd>{dados.objetos.funcoes}</dd><p>{dados.objetos.restricoes} restrições (PK, FK, UNIQUE, CHECK, EXCLUDE)</p></div>
        </dl>
        <div className="config-listas">
          <details>
            <summary>Registros por tabela</summary>
            <Tabela legenda="Registros por tabela" colunas={colunasTabelas} linhas={dados.tabelas} chave={t => t.tabela} vazio="" />
          </details>
          <details>
            <summary>Regras de negócio no banco ({dados.regras.length} triggers)</summary>
            <Tabela legenda="Triggers" colunas={colunasRegras} linhas={dados.regras} chave={r => `${r.tabela}-${r.nome}`} vazio="" />
          </details>
        </div>
      </>}
    </EstadoDados>
  </section>
}
