import { useContext } from 'react'
import { ContextoConfirmacao } from '../components/ui/confirmacaoContexto'

// Janela de confirmação no visual do sistema (substitui o window.confirm).
// Uso: if (!(await confirmar({ titulo: 'Excluir piquete?', mensagem: '...', confirmar: 'Excluir', perigo: true }))) return
export function useConfirmacao() {
  return useContext(ContextoConfirmacao)
}
