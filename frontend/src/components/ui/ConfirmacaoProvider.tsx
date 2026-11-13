import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'
import { ContextoConfirmacao, type PedidoConfirmacao } from './confirmacaoContexto'
import './Confirmacao.css'

type Pedido = PedidoConfirmacao & { responder: (ok: boolean) => void }

// Fica em volta do app (App.tsx). Usa o <dialog> do navegador: prende o foco na janela,
// fecha com Esc e é lido corretamente por leitores de tela.
export function ConfirmacaoProvider({ children }: { children: ReactNode }) {
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const janela = useRef<HTMLDialogElement>(null)

  const confirmar = useCallback((novo: PedidoConfirmacao) =>
    new Promise<boolean>(responder => setPedido({ ...novo, responder })), [])

  useEffect(() => {
    if (pedido && !janela.current?.open) janela.current?.showModal()
  }, [pedido])

  function responder(ok: boolean) {
    pedido?.responder(ok)
    janela.current?.close()
    setPedido(null)
  }

  return <ContextoConfirmacao.Provider value={confirmar}>
    {children}
    <dialog ref={janela} className="confirmacao" aria-labelledby="confirmacao-titulo" aria-describedby="confirmacao-mensagem"
      onCancel={e => { e.preventDefault(); responder(false) }}
      onClick={e => { if (e.target === janela.current) responder(false) }}>
      {pedido && <div className="confirmacao__caixa">
        <div className="confirmacao__topo">
          {pedido.perigo && <span className="confirmacao__icone" aria-hidden="true"><TriangleAlert size={20} /></span>}
          <h2 id="confirmacao-titulo">{pedido.titulo}</h2>
        </div>
        <p id="confirmacao-mensagem">{pedido.mensagem}</p>
        <div className="confirmacao__botoes">
          <button type="button" className="confirmacao__cancelar" autoFocus onClick={() => responder(false)}>Cancelar</button>
          <button type="button" className={`confirmacao__confirmar${pedido.perigo ? ' confirmacao__confirmar--perigo' : ''}`}
            onClick={() => responder(true)}>{pedido.confirmar ?? 'Confirmar'}</button>
        </div>
      </div>}
    </dialog>
  </ContextoConfirmacao.Provider>
}
