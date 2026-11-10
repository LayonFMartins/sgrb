import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function HomePage() {
  const { usuario } = useAuth()
  return <>
    <header className="page-heading"><h1>Bem-vindo(a), {usuario?.nome}</h1><p>Acompanhe a evolução do seu sistema de gestão do rebanho.</p></header>
    <section className="content-card" aria-labelledby="inicio-status">
      <span className="module-status">Estrutura inicial</span>
      <h2 id="inicio-status">Sua área de trabalho está sendo preparada</h2>
      <p>A autenticação e a navegação já estão disponíveis. As telas dos módulos serão implementadas nas próximas etapas; ainda não há indicadores ou dados do rebanho nesta página.</p>
      <p>Use o menu para consultar os módulos previstos para seu perfil.</p>
    </section>
  </>
}

export function ModulePage({ titulo }: { titulo: string }) {
  return <>
    <header className="page-heading"><h1>{titulo}</h1><p>Área de gestão de {titulo.toLocaleLowerCase('pt-BR')}.</p></header>
    <section className="content-card" aria-labelledby="modulo-status">
      <span className="module-status">Em preparação</span>
      <h2 id="modulo-status">Este módulo ainda não está disponível</h2>
      <p>Esta etapa entrega a navegação e o controle de acesso. A tela e a integração com os dados serão desenvolvidas em seguida.</p>
      <Link to="/">Voltar ao início</Link>
    </section>
  </>
}

export function NotFoundPage() {
  return <section className="content-card"><h1>Página não encontrada</h1><p>O endereço informado não corresponde a uma página do sistema.</p><Link to="/">Voltar ao início</Link></section>
}
