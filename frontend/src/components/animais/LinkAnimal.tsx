import { Link, useLocation } from 'react-router-dom'
import { usePermissions } from '../../auth/permissions'
import './LinkAnimal.css'

// Brinco que leva à ficha do animal (/animais?ficha=0001).
// Sem permissão para ver animais, aparece só o texto.
export function LinkAnimal({ brinco, className = '' }: { brinco: string; className?: string }) {
  const { pode } = usePermissions()
  const local = useLocation()
  if (!pode('animais.visualizar')) return <strong className={className}>{brinco}</strong>
  return <Link className={`link-animal ${className}`} to={`/animais?ficha=${encodeURIComponent(brinco)}`}
    // A ficha usa isto no "Voltar": retorna à tela de origem com os filtros que estavam aplicados
    state={{ voltar: local.pathname + local.search }}
    title={`Abrir a ficha do animal ${brinco}`}>{brinco}</Link>
}
