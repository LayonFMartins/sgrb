import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { salvarToken, solicitar, type Usuario } from '../../auth/auth'

interface LoginErrors {
  email?: string
  password?: string
}

export function LoginForm({ onLogin }: { onLogin: (token: string, usuario: Usuario) => void }) {
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<LoginErrors>({})
  const [notice, setNotice] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    const form = event.currentTarget
    const data = new FormData(form)
    const email = String(data.get('email') ?? '').trim()
    const password = String(data.get('password') ?? '')
    const nextErrors: LoginErrors = {}

    if (!email) nextErrors.email = 'Informe seu e-mail.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = 'Informe um e-mail válido.'
    if (!password) nextErrors.password = 'Informe sua senha.'

    setErrors(nextErrors)
    setNotice('')

    if (Object.keys(nextErrors).length) {
      const fieldName = nextErrors.email ? 'email' : 'password'
      const field = form.elements.namedItem(fieldName)
      if (field instanceof HTMLInputElement) field.focus()
      return
    }

    setLoading(true)
    try {
      const { token, usuario } = await solicitar<{ token: string; usuario: Usuario }>('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha: password }),
      })
      salvarToken(token, data.get('remember') === 'on')
      onLogin(token, usuario)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível entrar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <form className="login-form" onSubmit={handleSubmit} noValidate>
        <Input label="E-mail" name="email" type="email" autoComplete="username" placeholder="seuemail@exemplo.com" required icon={<Mail size={20} />} error={errors.email} onChange={() => { setErrors(current => ({ ...current, email: undefined })); setNotice('') }} />
        <Input label="Senha" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Digite sua senha" required icon={<LockKeyhole size={20} />} error={errors.password} onChange={() => { setErrors(current => ({ ...current, password: undefined })); setNotice('') }} action={
          <button className="login-form__toggle" type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>
            {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
          </button>
        } />
        <div className="login-form__options">
          <label className="login-form__remember"><input type="checkbox" name="remember" />Manter conectado</label>
          <button className="text-button" type="button" onClick={() => setNotice('A recuperação de senha ainda não está disponível nesta versão.')}>Esqueceu a senha?</button>
        </div>
        <Button type="submit" loading={loading}>{loading ? 'Entrando…' : 'Entrar'}</Button>
      </form>
      <footer className="login-card__support">
        <p>Precisa de ajuda?</p>
        <button className="text-button" type="button" onClick={() => setNotice('O canal de suporte ainda não foi configurado.')}>Fale com o suporte</button>
      </footer>
      <p className="login-card__notice" role="status">{notice}</p>
    </>
  )
}
