import { Link, useLocation } from 'react-router-dom'
import '../animais/LinkAnimal.css'

// Nome que abre a ficha de um cadastro na mesma tela (ex.: /piquetes?ficha=1),
// com o mesmo visual do link do brinco. Guarda a tela de origem para o "Voltar".
export function LinkFicha({ para, children, titulo }: { para: string; children: string; titulo: string }) {
  const local = useLocation()
  return <Link className="link-animal" to={para} state={{ voltar: local.pathname + local.search }} title={titulo}>
    {children}
  </Link>
}
