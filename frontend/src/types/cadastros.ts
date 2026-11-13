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
  // Animais diferentes que já passaram pelo piquete (com histórico não dá para excluir).
  animais_historico: number
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
  // Aplicações já registradas (com aplicações não dá para excluir).
  aplicacoes: number
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

// GET /api/piquetes/:id  -> piquete + animais que estão nele agora
export interface AnimalNoPiquete {
  brinco: string
  data_entrada: string
  sexo: 'M' | 'F'
  categoria: string
}

export interface PiqueteDetalhe extends PiqueteCadastro {
  animais_no_piquete: AnimalNoPiquete[]
}

// GET /api/fornecedores/:id/compras  -> uma linha por compra (data + GTA de entrada)
export interface CompraFornecedor {
  data_compra: string
  numero_gta: string | null
  finalidade: string | null
  animais: number
  valor_total: number
  ainda_na_fazenda: number
  brincos: string[]
}
