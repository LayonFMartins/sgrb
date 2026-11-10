import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import './controls.css'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  icon?: ReactNode
  action?: ReactNode
}

export function Input({ label, error, icon, action, id, className = '', ...props }: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const errorId = `${inputId}-error`
  const describedBy = [props['aria-describedby'], error ? errorId : undefined].filter(Boolean).join(' ') || undefined

  return (
    <div className={`field ${className}`}>
      <label htmlFor={inputId}>{label}</label>
      <div className={`field__control${error ? ' field__control--invalid' : ''}`}>
        {icon && <span className="field__icon" aria-hidden="true">{icon}</span>}
        <input {...props} id={inputId} aria-invalid={error ? true : undefined} aria-describedby={describedBy} />
        {action}
      </div>
      {error && <p className="field__error" id={errorId}>{error}</p>}
    </div>
  )
}
