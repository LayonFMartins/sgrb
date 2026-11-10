import { useCallback, useEffect, useState } from 'react'
import { solicitar } from '../auth/auth'

interface Resultado<T> {
  chave: string
  dados: T | null
  erro: string
}

// Busca dados da API (GET) com o token do usuário logado.
// Uso: const { dados, carregando, erro, recarregar } = useDados<Tipo[]>('/consultas/lotacao')
export function useDados<T>(caminho: string) {
  const [versao, setVersao] = useState(0)
  const chave = `${caminho}#${versao}`
  const [resultado, setResultado] = useState<Resultado<T>>({ chave: '', dados: null, erro: '' })

  useEffect(() => {
    const controle = new AbortController()
    solicitar<T>(caminho, { signal: controle.signal })
      .then(dados => setResultado({ chave, dados, erro: '' }))
      .catch(e => {
        if (controle.signal.aborted) return
        setResultado({ chave, dados: null, erro: e instanceof Error ? e.message : 'Não foi possível carregar os dados.' })
      })
    return () => controle.abort()
  }, [caminho, chave])

  // Enquanto a resposta da busca atual não chega, está carregando.
  const carregando = resultado.chave !== chave
  const recarregar = useCallback(() => setVersao(v => v + 1), [])
  return {
    dados: carregando ? null : resultado.dados,
    carregando,
    erro: carregando ? '' : resultado.erro,
    recarregar,
  }
}
