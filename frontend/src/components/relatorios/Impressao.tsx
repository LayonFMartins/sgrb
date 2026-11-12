import { Download, Printer } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import './Impressao.css'

// Linha que só aparece no papel/PDF: o que é o documento, quando e por quem foi emitido.
export function CabecalhoImpressao({ titulo }: { titulo: string }) {
  const { usuario } = useAuth()
  const emitidoEm = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  return <p className="so-impressao cabecalho-impressao">
    SGRB · {titulo} · emitido em {emitidoEm} por {usuario?.nome}
  </p>
}

// Botões "Imprimir" e "Exportar CSV" (este só aparece quando há o que exportar).
export function AcoesImpressao({ rotuloImprimir = 'Imprimir', onExportar }: {
  rotuloImprimir?: string
  onExportar?: () => void
}) {
  return <div className="acoes-impressao nao-imprimir">
    {onExportar && <button type="button" className="botao-secundario acoes-impressao__botao" onClick={onExportar}>
      <Download size={17} aria-hidden="true" />Exportar CSV
    </button>}
    <button type="button" className="botao-secundario acoes-impressao__botao" onClick={() => window.print()}>
      <Printer size={17} aria-hidden="true" />{rotuloImprimir}
    </button>
  </div>
}
