import { ArrowLeftRight, ChartBar, CircleMinus, Contact, FileText, LayoutDashboard, Map, Pill, Settings, ShoppingCart, Syringe, Tags, Users, Weight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'
import type { Permissao } from './auth/permissions'
import { AnimaisPage } from './pages/Animais/AnimaisPage'
import { RelatoriosPage } from './pages/Relatorios/RelatoriosPage'
import { FornecedoresPage } from './pages/Cadastros/FornecedoresPage'
import { PiquetesPage } from './pages/Cadastros/PiquetesPage'
import { ProdutosPage } from './pages/Cadastros/ProdutosPage'
import { UsuariosPage } from './pages/Cadastros/UsuariosPage'
import { RacasPage } from './pages/Cadastros/RacasPage'
import { ComprasPage } from './pages/Compras/ComprasPage'
import { GtaPage } from './pages/Gta/GtaPage'
import { ConfiguracoesPage } from './pages/Configuracoes/ConfiguracoesPage'
import { VendasBaixasPage } from './pages/VendasBaixas/VendasBaixasPage'

interface NavigationItemBase {
  path: string
  label: string
  icon: LucideIcon | 'boi'
  // Tela do módulo. Sem ela, aparece a página genérica "em preparação".
  pagina?: ComponentType
}

type NavigationItem = NavigationItemBase & (
  | { futuro: true; permissao?: never }
  | { futuro?: false; permissao: Permissao }
)

export const navigationGroups: { id: string; label: string; items: NavigationItem[] }[] = [
  { id: 'visao-geral', label: 'Visão geral', items: [
    { path: '/', label: 'Início', icon: LayoutDashboard, permissao: 'inicio.visualizar' },
  ] },
  { id: 'gestao-rebanho', label: 'Gestão do rebanho', items: [
    { path: '/animais', label: 'Animais', icon: 'boi', permissao: 'animais.visualizar', pagina: AnimaisPage },
    { path: '/pesagens', label: 'Pesagens', icon: Weight, futuro: true },
    { path: '/manejo-sanitario', label: 'Manejo sanitário', icon: Syringe, futuro: true },
    { path: '/piquetes', label: 'Piquetes', icon: Map, permissao: 'piquetes.visualizar', pagina: PiquetesPage },
    { path: '/movimentacoes', label: 'Movimentações', icon: ArrowLeftRight, futuro: true },
  ] },
  { id: 'operacoes', label: 'Operações', items: [
    { path: '/compras', label: 'Compras', icon: ShoppingCart, permissao: 'compras.criar', pagina: ComprasPage },
    { path: '/vendas-baixas', label: 'Vendas e baixas', icon: CircleMinus, permissao: 'baixas.visualizar', pagina: VendasBaixasPage },
    { path: '/gta', label: 'Guias de trânsito (GTA)', icon: FileText, permissao: 'gta.visualizar', pagina: GtaPage },
  ] },
  { id: 'cadastros', label: 'Cadastros', items: [
    { path: '/fornecedores', label: 'Fornecedores', icon: Contact, permissao: 'fornecedores.visualizar', pagina: FornecedoresPage },
    { path: '/produtos-sanitarios', label: 'Produtos sanitários', icon: Pill, permissao: 'produtos.visualizar', pagina: ProdutosPage },
    { path: '/usuarios', label: 'Usuários', icon: Users, permissao: 'usuarios.visualizar', pagina: UsuariosPage },
    { path: '/racas', label: 'Raças', icon: Tags, permissao: 'racas.visualizar', pagina: RacasPage },
  ] },
  { id: 'analises', label: 'Análises', items: [
    { path: '/relatorios', label: 'Relatórios e consultas', icon: ChartBar, permissao: 'consultas.visualizar', pagina: RelatoriosPage },
  ] },
  { id: 'sistema', label: 'Sistema', items: [
    { path: '/configuracoes', label: 'Configurações', icon: Settings, permissao: 'configuracoes.visualizar', pagina: ConfiguracoesPage },
  ] },
]

// Somente os módulos com página entram no roteador e no controle de acesso.
export const navigation = navigationGroups.flatMap(group => group.items).filter(
  (item): item is NavigationItemBase & { futuro?: false; permissao: Permissao } => !item.futuro,
)
