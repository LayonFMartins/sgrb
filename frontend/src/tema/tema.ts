// Tema da interface: claro, escuro ou automático (segue o sistema operacional).
// A escolha é deste navegador (fica no localStorage), não da conta do usuário.
// O index.html aplica o tema salvo antes do React carregar, para a tela não piscar.

export type PreferenciaTema = 'claro' | 'escuro' | 'automatico'
export type Tema = 'light' | 'dark'

const CHAVE = 'sgrb-tema'
const COR_BARRA: Record<Tema, string> = { light: '#faf7f0', dark: '#141a16' }
const consultaEscuro = () => window.matchMedia('(prefers-color-scheme: dark)')

export function lerPreferencia(): PreferenciaTema {
  try {
    const valor = localStorage.getItem(CHAVE)
    if (valor === 'claro' || valor === 'escuro' || valor === 'automatico') return valor
  } catch { /* navegador sem localStorage: usa o padrão */ }
  return 'claro'
}

export function resolverTema(preferencia: PreferenciaTema): Tema {
  if (preferencia === 'automatico') return consultaEscuro().matches ? 'dark' : 'light'
  return preferencia === 'escuro' ? 'dark' : 'light'
}

function aplicar(preferencia: PreferenciaTema) {
  const tema = resolverTema(preferencia)
  document.documentElement.dataset.theme = tema
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COR_BARRA[tema])
}

export function salvarPreferencia(preferencia: PreferenciaTema) {
  try { localStorage.setItem(CHAVE, preferencia) } catch { /* sem localStorage: vale só nesta visita */ }
  aplicar(preferencia)
  window.dispatchEvent(new Event('sgrb-tema'))
}

// Chamado uma vez no main.tsx: no modo automático, acompanha a troca do sistema
// (ex.: o celular passa para o escuro à noite) sem recarregar a página.
export function iniciarTema() {
  aplicar(lerPreferencia())
  consultaEscuro().addEventListener('change', () => {
    if (lerPreferencia() === 'automatico') aplicar('automatico')
  })
}
