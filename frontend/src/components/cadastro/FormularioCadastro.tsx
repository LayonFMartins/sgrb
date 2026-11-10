import { useId, type FormEvent, type ReactNode, type SelectHTMLAttributes } from 'react'
import { Button } from '../ui/Button'
import '../ui/controls.css'
import './Cadastro.css'

// Cartão com o formulário de cadastro/edição (abre acima da tabela).
export function FormularioCadastro({ titulo, salvando, erro, onSalvar, onCancelar, children }: {
  titulo: string
  salvando: boolean
  erro: string
  onSalvar: () => void
  onCancelar: () => void
  children: ReactNode
}) {
  const tituloId = useId()
  function enviar(e: FormEvent) {
    e.preventDefault()
    onSalvar()
  }
  return <section className="content-card cadastro-form" aria-labelledby={tituloId}>
    <h2 id={tituloId}>{titulo}</h2>
    <form onSubmit={enviar} noValidate>
      <div className="cadastro-form__campos">{children}</div>
      {erro && <p className="cadastro-form__erro" role="alert">{erro}</p>}
      <div className="cadastro-form__botoes">
        <button type="button" className="botao-secundario" onClick={onCancelar} disabled={salvando}>Cancelar</button>
        <Button type="submit" loading={salvando} className="cadastro-form__salvar">Salvar</Button>
      </div>
    </form>
  </section>
}

// Campo de seleção com o mesmo visual do Input.
export function Selecao({ label, children, className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  children: ReactNode
}) {
  const id = useId()
  return <div className={`field ${className}`}>
    <label htmlFor={id}>{label}</label>
    <div className="field__control">
      <select {...props} id={id} className="cadastro-select">{children}</select>
    </div>
  </div>
}

// Cabeçalho da página com o botão "Novo ..." à direita.
export function CabecalhoCadastro({ titulo, descricao, acao }: {
  titulo: string
  descricao: string
  acao?: ReactNode
}) {
  return <header className="page-heading cadastro-cabecalho">
    <div>
      <h1>{titulo}</h1>
      <p>{descricao}</p>
    </div>
    {acao}
  </header>
}

// Aviso de erro de uma ação da tabela (ex.: excluir registro em uso).
export function AvisoErro({ mensagem, onFechar }: { mensagem: string; onFechar: () => void }) {
  if (!mensagem) return null
  return <div className="estado-erro cadastro-aviso" role="alert">
    <span>{mensagem}</span>
    <button type="button" onClick={onFechar}>Fechar</button>
  </div>
}
