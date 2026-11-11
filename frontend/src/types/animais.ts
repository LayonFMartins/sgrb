// Formato das respostas de /api/animais (backend/src/routes/animais.ts)

export type Situacao = 'Ativo' | 'Vendido' | 'Óbito'

export interface Animal {
  brinco: string
  sexo: 'M' | 'F'
  raca: string
  data_nascimento: string
  idade_meses: number
  categoria: string
  origem: 'Compra' | 'Nascimento' | 'Rebanho inicial'
  brinco_mae: string | null
  fornecedor: string | null
  situacao: Situacao
  piquete_atual: string | null
  ultimo_peso_kg: number | null
  data_ultimo_peso: string | null
}

export interface EventoHistorico {
  data: string
  evento: string
  detalhe: string | null
}

export interface Pesagem {
  data_pesagem: string
  peso_kg: number
}

export interface AlertasAnimal {
  carencia: { produto: string; data_liberacao: string; dias_restantes: number }[]
  reforcos_atrasados: { produto: string; ultima_dose: number; data_proxima_dose: string; dias_atraso: number }[]
  campanhas: { produto: string; prazo_final: string }[]
}

export interface FichaAnimal extends Animal {
  data_compra: string | null
  valor_compra: number | null
  data_baixa: string | null
  historico: EventoHistorico[]
  pesagens: Pesagem[]
  alertas: AlertasAnimal
}

export interface Cria {
  brinco: string
  sexo: 'M' | 'F'
  data_nascimento: string
  categoria: string
  situacao: Situacao
}

export interface Raca {
  id_raca: number
  nome: string
  animais: number
}
