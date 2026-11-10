import { Brand } from '../../components/Brand/Brand'
import { LoginForm } from './LoginForm'
import './Login.css'

export function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-page__brand" aria-label="SGRB — Sistema de Gestão e Rastreabilidade de Rebanho Bovino">
        <Brand />
      </section>
      <section className="login-page__authentication" aria-labelledby="login-title">
        <div className="login-card">
          <div className="login-card__brand"><Brand compact /></div>
          <header className="login-card__heading">
            <h1 id="login-title">Bem-vindo(a)</h1>
            <p>Acesse sua conta para continuar.</p>
          </header>
          <LoginForm />
        </div>
      </section>
    </main>
  )
}
