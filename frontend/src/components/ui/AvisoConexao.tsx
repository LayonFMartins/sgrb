import { useSyncExternalStore } from 'react'
import { LoaderCircle } from 'lucide-react'
import { conexaoLenta, observarConexao } from '../../auth/conexao'
import './AvisoConexao.css'

// Faixa no topo da tela enquanto o servidor demora a responder.
export function AvisoConexao() {
  const lenta = useSyncExternalStore(observarConexao, conexaoLenta)
  return <div className="aviso-conexao-area" role="status" aria-live="polite">
    {lenta && <div className="aviso-conexao">
      <LoaderCircle size={20} className="aviso-conexao__icone" aria-hidden="true" />
      <div>
        <strong>Conectando ao servidor…</strong>
        <p>Na primeira vez do dia ele pode levar até 1 minuto para iniciar. Não precisa recarregar a página.</p>
      </div>
    </div>}
  </div>
}
