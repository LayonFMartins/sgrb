// Formato das respostas dos cadastros (backend/src/routes/fornecedores.ts,
// piquetes.ts, produtos.ts e usuarios.ts)

export interface Fornecedor {
  id_fornecedor: number
  nome_produtor: string
  nome_propriedade: string
  municipio: string
  uf: string
  telefones: string[]
  animais: number
}

export interface PiqueteCadastro {
  id_piquete: number
  nome: string
  area_ha: number
  capacidade_max: number
  descanso_min_dias: number
  animais: number
  ocupacao_pct: number
  vagas: number
  situacao: 'Em uso' | 'Em descanso' | 'Disponível'
  data_liberacao: string | null
}

export type TipoProduto = 'VACINA' | 'VERMIFUGO' | 'ANTIBIOTICO'

export interface ProdutoSanitario {
  id_produto: number
  nome: string
  tipo: TipoProduto
  doenca_alvo: string
  carencia_dias: number
  num_doses: number
  intervalo_reforco_dias: number | null
  sexo_alvo: 'M' | 'F' | null
  idade_min_meses: number | null
  idade_max_meses: number | null
}

export interface UsuarioCadastro {
  id_usuario: number
  nome: string
  funcao: string
  tipo: 'PROPRIETARIO' | 'FUNCIONARIO'
  // Só vem para quem pode editar usuários (proprietário).
  email?: string | null
  ativo: boolean
  tem_login: boolean
}
