import type { ReactNode } from 'react'
import './Tabela.css'

// Mostra "carregando" ou a mensagem de erro; quando os dados chegam, mostra o conteúdo.
export function EstadoDados({ carregando, erro, recarregar, children }: {
  carregando: boolean
  erro: string
  recarregar: () => void
  children: ReactNode
}) {
  if (carregando) return <p className="estado-carregando" role="status">Carregando…</p>
  if (erro) return <div className="estado-erro" role="alert">
    <span>{erro}</span>
    <button type="button" onClick={recarregar}>Tentar novamente</button>
  </div>
  return children
}
