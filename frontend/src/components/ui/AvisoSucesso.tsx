import { useEffect } from 'react'
import { CircleCheck, X } from 'lucide-react'
import type { useAvisoSucesso } from '../../hooks/useAvisoSucesso'
import './AvisoSucesso.css'

// Aviso no canto da tela; o estado vem de hooks/useAvisoSucesso.
export function AvisoSucesso({ aviso, fechar }: ReturnType<typeof useAvisoSucesso>) {
  // Some sozinho depois de 4 segundos; o id reinicia o tempo a cada novo aviso.
  useEffect(() => {
    if (!aviso) return
    const tempo = window.setTimeout(fechar, 4000)
    return () => window.clearTimeout(tempo)
  }, [aviso, fechar])

  return <div className="aviso-sucesso-area" role="status" aria-live="polite">
    {aviso && <div className="aviso-sucesso" key={aviso.id}>
      <CircleCheck size={20} aria-hidden="true" />
      <span>{aviso.texto}</span>
      <button type="button" onClick={fechar} aria-label="Fechar aviso"><X size={16} aria-hidden="true" /></button>
    </div>}
  </div>
}
