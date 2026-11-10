import { useState } from 'react'
import { mensagemDeErro } from '../utils/enviar'

// Estado do formulário de um cadastro: aberto/fechado, novo ou edição,
// valores dos campos, "salvando" e mensagem de erro do backend.
// Uso:
//   const f = useFormulario(VAZIO)
//   f.abrirNovo() / f.abrirEdicao(id, valores) / f.alterar('nome', 'P01')
//   f.executar(() => enviar(...), recarregar)
export function useFormulario<F extends object>(vazio: F) {
  const [valores, setValores] = useState<F | null>(null)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function abrir(id: number | null, inicial: F) {
    setEditandoId(id)
    setValores(inicial)
    setErro('')
  }

  function fechar() {
    setValores(null)
    setEditandoId(null)
    setErro('')
  }

  function alterar<K extends keyof F>(campo: K, valor: F[K]) {
    setValores(atual => atual && { ...atual, [campo]: valor })
  }

  // Roda a ação (POST/PUT); se der certo, fecha o formulário e recarrega a lista.
  async function executar(acao: () => Promise<unknown>, depois: () => void) {
    setSalvando(true)
    setErro('')
    try {
      await acao()
      fechar()
      depois()
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setSalvando(false)
    }
  }

  return {
    aberto: valores !== null,
    valores: valores ?? vazio,
    editando: editandoId !== null,
    editandoId,
    salvando,
    erro,
    abrirNovo: () => abrir(null, vazio),
    abrirEdicao: (id: number, inicial: F) => abrir(id, inicial),
    fechar,
    alterar,
    executar,
  }
}

// Ações de linha (excluir, desativar): guarda a mensagem de erro para mostrar acima da tabela.
export function useAcaoLinha() {
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function executar(acao: () => Promise<unknown>, depois: () => void) {
    setOcupado(true)
    setAviso('')
    try {
      await acao()
      depois()
    } catch (e) {
      setAviso(mensagemDeErro(e))
    } finally {
      setOcupado(false)
    }
  }

  return { aviso, ocupado, executar, limparAviso: () => setAviso('') }
}
