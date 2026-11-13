import type { ReactNode } from 'react'
import './Tabela.css'

// Enquanto carrega, mostra blocos cinza no lugar do conteúdo (esqueleto); em caso de erro,
// a mensagem e "Tentar novamente"; quando os dados chegam, mostra o conteúdo.
export function EstadoDados({ carregando, erro, recarregar, children }: {
  carregando: boolean
  erro: string
  recarregar: () => void
  children: ReactNode
}) {
  if (carregando) return <div className="esqueleto" role="status">
    <span className="sr-only">Carregando…</span>
    {[0, 1, 2, 3].map(i => <span key={i} className="esqueleto__linha" aria-hidden="true" />)}
  </div>
  if (erro) return <div className="estado-erro" role="alert">
    <span>{erro}</span>
    <button type="button" onClick={recarregar}>Tentar novamente</button>
  </div>
  return children
}
