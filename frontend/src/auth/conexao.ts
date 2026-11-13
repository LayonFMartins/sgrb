// Acompanha as requisições à API. Se alguma demorar mais que alguns segundos,
// a tela mostra o aviso "Conectando ao servidor…" (componente AvisoConexao).
// Motivo: o servidor gratuito do Render "dorme" sem uso e leva até ~1 min para acordar.

const LIMITE_MS = 4000
let lentas = 0
const alvo = new EventTarget()

function avisar() {
  alvo.dispatchEvent(new Event('mudou'))
}

// Chame no início da requisição; a função devolvida deve ser chamada no fim.
export function acompanharRequisicao() {
  let ficouLenta = false
  const espera = setTimeout(() => { ficouLenta = true; lentas++; avisar() }, LIMITE_MS)
  return () => {
    clearTimeout(espera)
    if (ficouLenta) { lentas--; avisar() }
  }
}

export function observarConexao(callback: () => void) {
  alvo.addEventListener('mudou', callback)
  return () => alvo.removeEventListener('mudou', callback)
}

export const conexaoLenta = () => lentas > 0
