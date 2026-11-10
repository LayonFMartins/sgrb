import type { ButtonHTMLAttributes } from 'react'
import { LoaderCircle } from 'lucide-react'
import './controls.css'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
}

export function Button({ children, loading = false, disabled, className = '', ...props }: ButtonProps) {
  return (
    <button {...props} className={`button ${className}`} disabled={disabled || loading} aria-busy={loading}>
      {loading && <LoaderCircle className="button__spinner" size={18} aria-hidden="true" />}
      {children}
    </button>
  )
}
