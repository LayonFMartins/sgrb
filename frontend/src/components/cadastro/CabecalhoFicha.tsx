import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import '../../pages/Animais/Animais.css'

// Topo das fichas de piquete e fornecedor: "Voltar" + título + subtítulo.
// O "Voltar" retorna à tela de onde a ficha foi aberta (com os filtros), ou à lista.
export function CabecalhoFicha({ lista, rotuloLista, titulo, children }: {
  lista: string
  rotuloLista: string
  titulo: string
  children?: ReactNode
}) {
  const origem = (useLocation().state as { voltar?: string } | null)?.voltar
  return <header className="page-heading">
    <Link to={origem ?? lista} className="ficha-voltar"><ArrowLeft size={16} aria-hidden="true" />{rotuloLista}</Link>
    <h1>{titulo}</h1>
    {children && <p>{children}</p>}
  </header>
}

// Um item da lista de dados da ficha (rótulo em cima, valor embaixo).
export function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return <div><dt>{rotulo}</dt><dd>{children}</dd></div>
}
