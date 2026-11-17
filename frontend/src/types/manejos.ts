// Formato das respostas de /api/pesagens, /api/aplicacoes e /api/movimentacoes
// (backend/src/routes/pesagens.ts, aplicacoes.ts e movimentacoes.ts)
import type { TipoProduto } from './cadastros'

// GET /api/pesagens  -> a variação e o GMD vêm da pesagem anterior do mesmo animal
export interface PesagemRegistro {
  brinco: string
  data_pesagem: string
  peso_kg: number
  id_usuario: number
  responsavel: string
  peso_anterior_kg: number | null
  dias: number | null
  gmd_kg_dia: number | null
}

// GET /api/aplicacoes  -> data_liberacao = data da aplicação + carência do produto
export interface AplicacaoRegistro {
  brinco: string
  data_aplicacao: string
  id_produto: number
  produto: string
  tipo: TipoProduto
  num_dose: number
  num_doses: number
  lote_medicamento: string
  id_usuario: number
  responsavel: string
  carencia_dias: number
  data_liberacao: string
}

// GET /api/movimentacoes  -> histórico de ocupação; "atual" = ainda está no piquete
export interface MovimentacaoRegistro {
  brinco: string
  id_piquete: number
  piquete: string
  data_entrada: string
  data_saida: string | null
  atual: boolean
}
