import { Search } from 'lucide-react'
import { Input } from '../ui/Input'
import './Cadastro.css'

// Campo "Buscar" das listas de cadastro (mesmo visual da busca de Animais).
export function CampoBusca({ valor, onChange, placeholder }: {
  valor: string
  onChange: (valor: string) => void
  placeholder: string
}) {
  return <Input label="Buscar" className="cadastro-busca" type="search" value={valor} placeholder={placeholder}
    icon={<Search size={16} />} onChange={e => onChange(e.target.value)} />
}
