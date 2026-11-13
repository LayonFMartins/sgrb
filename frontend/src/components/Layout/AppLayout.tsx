import { useEffect, useRef, useState } from 'react'
import { ChevronDown, LogOut, Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { usePermissions } from '../../auth/permissions'
import { navigation, navigationGroups } from '../../navigation'
import './Layout.css'

export function AppLayout() {
  const { usuario, sair } = useAuth()
  const { pode } = usePermissions()
  const [recolhido, setRecolhido] = useState(false)
  const [gruposFechados, setGruposFechados] = useState<string[]>([])
  const menuButton = useRef<HTMLButtonElement>(null)
  const location = useLocation()
  // O menu do celular fica aberto só na página em que foi aberto: ao navegar (inclusive
  // pelo "voltar" do navegador) ele fecha sozinho, sem precisar de efeito.
  const [abertoEm, setAbertoEm] = useState<string | null>(null)
  const aberto = abertoEm === location.pathname
  const setAberto = (abrir: boolean) => setAbertoEm(abrir ? location.pathname : null)
  const primeiroItem = useRef<HTMLAnchorElement>(null)
  const naInicio = location.pathname === '/'
  const pagina = navigation.find(item => item.path === location.pathname)?.label ?? 'Página não encontrada'

  useEffect(() => {
    document.title = `${pagina} | SGRB`
  }, [pagina])

  useEffect(() => {
    if (!aberto) return
    const fechar = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setAbertoEm(null); menuButton.current?.focus() }
    }
    window.addEventListener('keydown', fechar)
    // Menu aberto no celular: a página de trás não rola e o foco vai para o menu
    document.body.classList.add('menu-aberto')
    primeiroItem.current?.focus()
    return () => {
      window.removeEventListener('keydown', fechar)
      document.body.classList.remove('menu-aberto')
    }
  }, [aberto])

  function fecharMenu() {
    setAberto(false)
    menuButton.current?.focus()
  }

  return <div className={`app-shell${recolhido ? ' app-shell--collapsed' : ''}`}>
    <a className="skip-link" href="#conteudo">Ir para o conteúdo</a>
    <aside className={`sidebar${aberto ? ' sidebar--open' : ''}`} aria-label="Navegação principal">
      <div className="sidebar-identity">
        <Link className="sidebar-brand" to="/" onClick={() => setAberto(false)}>SGRB<span>Gestão de rebanho</span></Link>
        <button className="sidebar-fechar" type="button" aria-label="Fechar menu" onClick={fecharMenu}><X size={20} aria-hidden="true" /></button>
        <button className="sidebar-collapse" type="button" aria-label={recolhido ? 'Expandir menu lateral' : 'Recolher menu lateral'} aria-expanded={!recolhido} aria-controls="menu-principal" onClick={() => setRecolhido(value => !value)}>
          {recolhido ? <PanelLeftOpen size={19} aria-hidden="true" /> : <PanelLeftClose size={19} aria-hidden="true" />}
        </button>
      </div>
      <nav id="menu-principal" aria-label="Módulos">
        {navigationGroups.map(group => {
          const items = group.items.filter(item => item.futuro || pode(item.permissao))
          const expandido = recolhido || !gruposFechados.includes(group.id)
          if (!items.length && group.id !== 'sistema') return null
          return <section className="nav-group" key={group.id} aria-label={group.label}>
            <button className="nav-group-toggle" type="button" aria-expanded={expandido} aria-controls={`grupo-${group.id}`} onClick={() => setGruposFechados(atual => atual.includes(group.id) ? atual.filter(id => id !== group.id) : [...atual, group.id])}>
              {group.label}<ChevronDown size={14} aria-hidden="true" />
            </button>
            <div id={`grupo-${group.id}`} className="nav-group-items" hidden={!expandido}>
              {items.map((item, indice) => {
                const icon = item.icon === 'boi'
                  ? <span className="nav-icon nav-icon--animal" aria-hidden="true" />
                  : <item.icon className="nav-icon" size={18} strokeWidth={1.75} aria-hidden="true" />
                return item.futuro
                  ? <span className="nav-item nav-item--planned" key={item.path} role="link" aria-disabled="true" aria-label={`${item.label} — em preparação`} title={`${item.label} — em preparação`}>
                    {icon}<span className="nav-label">{item.label}</span><span className="sr-only"> — em preparação</span>
                  </span>
                  : <NavLink ref={group === navigationGroups[0] && indice === 0 ? primeiroItem : undefined} className="nav-item" aria-label={item.label} title={item.label} key={item.path} to={item.path} end={item.path === '/'} onClick={() => setAberto(false)}>
                    {icon}<span className="nav-label">{item.label}</span>
                  </NavLink>
              })}
              {group.id === 'sistema' && <button className="nav-item sidebar-logout" type="button" aria-label="Sair" title="Sair" onClick={sair}><LogOut className="nav-icon" size={18} strokeWidth={1.75} aria-hidden="true" /><span className="nav-label">Sair</span></button>}
            </div>
          </section>
        })}
      </nav>
      <p className="sidebar-footer">Itens esmaecidos: em preparação.</p>
    </aside>
    {/* Fundo escurecido atrás do menu do celular; tocar nele fecha o menu */}
    {aberto && <div className="menu-fundo" aria-hidden="true" onClick={fecharMenu} />}
    <div className="app-body">
      <header className="app-header">
        <button ref={menuButton} className="menu-toggle" type="button" aria-label={aberto ? 'Fechar menu' : 'Abrir menu'} aria-expanded={aberto} aria-controls="menu-principal" onClick={() => setAberto(!aberto)}>
          {aberto ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
        {/* O nome da página já aparece no título dela; aqui fica a marca (leva ao Início) */}
        <div className="header-centro">
          <Link to="/" className="header-marca" aria-label="SGRB: ir para o Início" title="Ir para o Início">
            <span className="header-marca__boi" aria-hidden="true" />
            {naInicio && <span className="header-page">Início</span>}
          </Link>
          <div className="header-user"><strong>{usuario?.nome}</strong><span>{usuario?.tipo === 'PROPRIETARIO' ? 'Proprietário' : 'Funcionário'}</span></div>
        </div>
        <button className="logout-button mobile-logout" type="button" aria-label="Encerrar sessão" onClick={sair}><LogOut size={18} aria-hidden="true" />Sair</button>
      </header>
      <main id="conteudo" className="app-content" tabIndex={-1}><Outlet /></main>
    </div>
  </div>
}
