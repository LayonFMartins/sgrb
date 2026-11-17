import { Selecao } from '../cadastro/FormularioCadastro'
import type { UsuarioCadastro } from '../../types/cadastros'

// Responsável pelo manejo (pesagem, aplicação sanitária). Nem sempre é quem está
// logado: os vaqueiros não têm login, então quem registra escolhe aqui, entre os
// usuários ativos (GET /usuarios?ativo=true). O banco recusa usuário inativo (RI-26).
export function SelecaoResponsavel({ usuarios, valor, onChange, className }: {
  usuarios: UsuarioCadastro[]
  valor: string
  onChange: (valor: string) => void
  className?: string
}) {
  return <Selecao label="Responsável" value={valor} required className={className}
    onChange={e => onChange(e.target.value)}>
    <option value="">Escolha o responsável</option>
    {usuarios.map(u => <option key={u.id_usuario} value={u.id_usuario}>{u.nome} · {u.funcao}</option>)}
  </Selecao>
}
