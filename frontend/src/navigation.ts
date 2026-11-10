import { ArrowLeftRight, ChartBar, CircleMinus, Contact, FileText, LayoutDashboard, Map, Pill, Settings, ShoppingCart, Syringe, Tags, Users, Weight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Permissao } from './auth/permissions'

interface NavigationItemBase {
  path: string
  label: string
  icon: LucideIcon | 'boi'
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
    { path: '/animais', label: 'Animais', icon: 'boi', permissao: 'animais.visualizar' },
    { path: '/pesagens', label: 'Pesagens', icon: Weight, futuro: true },
    { path: '/manejo-sanitario', label: 'Manejo sanitário', icon: Syringe, futuro: true },
    { path: '/piquetes', label: 'Piquetes', icon: Map, futuro: true },
    { path: '/movimentacoes', label: 'Movimentações', icon: ArrowLeftRight, futuro: true },
  ] },
  { id: 'operacoes', label: 'Operações', items: [
    { path: '/compras', label: 'Compras', icon: ShoppingCart, permissao: 'compras.criar' },
    { path: '/vendas-baixas', label: 'Vendas e baixas', icon: CircleMinus, futuro: true },
    { path: '/gta', label: 'Guias de trânsito (GTA)', icon: FileText, futuro: true },
  ] },
  { id: 'cadastros', label: 'Cadastros', items: [
    { path: '/fornecedores', label: 'Fornecedores', icon: Contact, futuro: true },
    { path: '/produtos-sanitarios', label: 'Produtos sanitários', icon: Pill, futuro: true },
    { path: '/funcionarios', label: 'Funcionários', icon: Users, futuro: true },
    { path: '/racas', label: 'Raças', icon: Tags, permissao: 'racas.visualizar' },
  ] },
  { id: 'analises', label: 'Análises', items: [
    { path: '/relatorios', label: 'Relatórios e consultas', icon: ChartBar, futuro: true },
  ] },
  { id: 'sistema', label: 'Sistema', items: [
    { path: '/configuracoes', label: 'Configurações', icon: Settings, futuro: true },
  ] },
]

// Somente os módulos com página entram no roteador e no controle de acesso.
export const navigation = navigationGroups.flatMap(group => group.items).filter(
  (item): item is NavigationItemBase & { futuro?: false; permissao: Permissao } => !item.futuro,
)
