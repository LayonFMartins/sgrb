// Contrato compartilhado: novas ações precisam entrar no catálogo e na matriz.
export const permissoesConhecidas = [
  'inicio.visualizar',
  'animais.visualizar', 'animais.criar', 'animais.editar', 'animais.excluir',
  'racas.visualizar', 'racas.criar', 'racas.editar', 'racas.excluir',
  'compras.criar', 'gta.visualizar',
  'baixas.visualizar', 'vendas.criar', 'obitos.criar',
  'fornecedores.visualizar', 'fornecedores.criar', 'fornecedores.editar', 'fornecedores.excluir',
  'piquetes.visualizar', 'piquetes.criar', 'piquetes.editar', 'piquetes.excluir',
  'produtos.visualizar', 'produtos.criar', 'produtos.editar', 'produtos.excluir',
  'usuarios.visualizar', 'usuarios.criar', 'usuarios.editar', 'usuarios.desativar',
  'consultas.visualizar',
  'configuracoes.visualizar', 'sistema.visualizar',
] as const;

export type Permissao = typeof permissoesConhecidas[number];
export type TipoUsuario = 'PROPRIETARIO' | 'FUNCIONARIO';

// Sem curinga: novas permissões não são concedidas automaticamente.
const permissoesPorPerfil: Record<TipoUsuario, readonly Permissao[]> = {
  PROPRIETARIO: [
    'inicio.visualizar',
    'animais.visualizar', 'animais.criar', 'animais.editar', 'animais.excluir',
    'racas.visualizar', 'racas.criar', 'racas.editar', 'racas.excluir',
    'compras.criar', 'gta.visualizar',
    'baixas.visualizar', 'vendas.criar', 'obitos.criar',
    'fornecedores.visualizar', 'fornecedores.criar', 'fornecedores.editar', 'fornecedores.excluir',
    'piquetes.visualizar', 'piquetes.criar', 'piquetes.editar', 'piquetes.excluir',
    'produtos.visualizar', 'produtos.criar', 'produtos.editar', 'produtos.excluir',
    'usuarios.visualizar', 'usuarios.criar', 'usuarios.editar', 'usuarios.desativar',
    'consultas.visualizar', 'configuracoes.visualizar', 'sistema.visualizar',
  ],
  // Funcionario so consulta: as listas abastecem os formularios de manejo.
  FUNCIONARIO: [
    'inicio.visualizar', 'animais.visualizar', 'racas.visualizar', 'gta.visualizar',
    // Óbito é registrado por quem está no campo; venda fica só com o proprietário.
    'baixas.visualizar', 'obitos.criar',
    'fornecedores.visualizar', 'piquetes.visualizar', 'produtos.visualizar', 'usuarios.visualizar',
    'consultas.visualizar', 'configuracoes.visualizar',
  ],
};

export function obterPermissoes(tipo: string): Permissao[] {
  if (!Object.hasOwn(permissoesPorPerfil, tipo)) return [];
  return [...permissoesPorPerfil[tipo as TipoUsuario]];
}

export function temPermissao(concedidas: readonly string[] | undefined, permissao: Permissao | undefined): boolean {
  return permissao !== undefined && permissoesConhecidas.includes(permissao) &&
    Array.isArray(concedidas) && concedidas.includes(permissao);
}
