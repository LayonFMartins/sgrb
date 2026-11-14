// Formato das respostas de /api/baixas (backend/src/routes/baixas.ts)

export type MotivoBaixa = 'VENDA' | 'OBITO'

export interface Saida {
  id_baixa: number
  brinco: string
  data_baixa: string
  motivo: MotivoBaixa
  raca: string
  categoria: string
  sexo: 'M' | 'F'
  // Só na venda:
  comprador: string | null
  peso_final_kg: number | null
  valor_venda: number | null
  numero_gta: string | null
  finalidade: string | null
  destino: string | null
  // Só no óbito:
  causa: string | null
}
