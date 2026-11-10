// Formato das respostas de /api/consultas (backend/src/routes/consultas.ts)

export interface Piquete {
  id_piquete: number
  nome: string
  area_ha: number
  capacidade_max: number
  animais: number
  ocupacao_pct: number
  vagas: number
  situacao: 'Em uso' | 'Em descanso' | 'Disponível'
  data_liberacao: string | null
}

export interface Carencia {
  brinco: string
  produto: string
  data_aplicacao: string
  carencia_dias: number
  data_liberacao: string
  dias_restantes: number
}

export interface Reforco {
  brinco: string
  produto: string
  ultima_dose: number
  data_ultima_dose: string
  data_proxima_dose: string
  situacao?: 'Atrasado' | 'Em dia'
  dias_atraso: number
}

export interface Campanha {
  brinco: string
  sexo: 'M' | 'F'
  idade_meses: number
  produto: string
  idade_min_meses: number | null
  idade_max_meses: number | null
  prazo_final: string
}

export interface GmdAnimal {
  posicao: number
  brinco: string
  raca: string
  categoria: string
  fornecedor: string | null
  situacao: string
  peso_inicial: number
  peso_final: number
  dias: number
  gmd_kg_dia: number
}

export interface GmdGrupo {
  grupo: string
  animais: number
  gmd_medio_kg_dia: number
}

export interface Painel {
  rebanho: {
    ativos: number
    vendidos: number
    obitos: number
    por_categoria: { categoria: string; total: number }[]
  }
  piquetes: Piquete[]
  carencia: Carencia[]
  reforcos_atrasados: Reforco[]
  campanhas_pendentes: Campanha[]
}
