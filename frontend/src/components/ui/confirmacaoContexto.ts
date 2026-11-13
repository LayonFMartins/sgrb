import { createContext, type ReactNode } from 'react'

export interface PedidoConfirmacao {
  titulo: string
  mensagem: ReactNode
  confirmar?: string   // texto do botão de confirmar (padrão: "Confirmar")
  perigo?: boolean     // ação que apaga ou bloqueia algo: botão vermelho
}

// Sem o provedor (não deveria acontecer), cai na janela nativa do navegador.
export const ContextoConfirmacao = createContext<(pedido: PedidoConfirmacao) => Promise<boolean>>(
  pedido => Promise.resolve(window.confirm(pedido.titulo)),
)
