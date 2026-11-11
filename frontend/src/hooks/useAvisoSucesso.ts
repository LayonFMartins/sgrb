import { useCallback, useState } from 'react'

// Aviso rápido depois de salvar ("Animal 0301 registrado."). Uso:
//   const sucesso = useAvisoSucesso()
//   sucesso.mostrar('Animal 0301 registrado.')
//   <AvisoSucesso {...sucesso} />
export function useAvisoSucesso() {
  const [aviso, setAviso] = useState<{ texto: string; id: number } | null>(null)
  const mostrar = useCallback((texto: string) => setAviso({ texto, id: Date.now() }), [])
  const fechar = useCallback(() => setAviso(null), [])
  return { aviso, mostrar, fechar }
}
