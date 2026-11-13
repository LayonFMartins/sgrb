import { useSearchParams } from 'react-router-dom'

// Valor de filtro guardado no endereço da página (ex.: /animais?situacao=Vendido&busca=nelore).
// Assim o filtro não se perde ao abrir uma ficha e voltar, e o link pode ser enviado já filtrado.
// Funciona como useState: const [busca, setBusca] = useParametro('busca')
export function useParametro(nome: string, padrao = ''): [string, (valor: string) => void] {
  const [params, setParams] = useSearchParams()
  const valor = params.get(nome) ?? padrao
  function alterar(novo: string) {
    setParams(atual => {
      const proximo = new URLSearchParams(atual)
      if (!novo || novo === padrao) proximo.delete(nome)
      else proximo.set(nome, novo)
      return proximo
    }, { replace: true }) // replace: digitar na busca não enche o histórico do "voltar"
  }
  return [valor, alterar]
}
