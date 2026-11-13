import { LinkAnimal } from '../../components/animais/LinkAnimal'
import { CabecalhoFicha, Dado } from '../../components/cadastro/CabecalhoFicha'
import { EstadoDados } from '../../components/ui/EstadoDados'
import { Tabela, type Coluna } from '../../components/ui/Tabela'
import { useDados } from '../../hooks/useDados'
import type { AnimalNoPiquete, PiqueteCadastro, PiqueteDetalhe } from '../../types/cadastros'
import { formatarData, formatarNumero, plural } from '../../utils/formatar'
import { nomeSexo } from '../Animais/animal'
import '../Animais/Animais.css'

const ETIQUETA_SITUACAO: Record<PiqueteCadastro['situacao'], string> = {
  'Em uso': 'ok',
  'Em descanso': 'alerta',
  'Disponível': 'neutra',
}

// Dias entre a entrada e hoje. As datas são comparadas como "AAAA-MM-DD" em UTC
// para não haver diferença de um dia por causa do fuso horário.
function diasDesde(data: string) {
  const hoje = new Date().toLocaleDateString('sv-SE')
  return Math.max(0, Math.round((Date.parse(`${hoje}T00:00Z`) - Date.parse(`${data.slice(0, 10)}T00:00Z`)) / 86_400_000))
}

const colunas: Coluna<AnimalNoPiquete>[] = [
  { titulo: 'Brinco', valor: a => <LinkAnimal brinco={a.brinco} />, csv: a => a.brinco },
  { titulo: 'Categoria', valor: a => a.categoria },
  { titulo: 'Sexo', valor: a => nomeSexo(a.sexo) },
  { titulo: 'Entrou em', valor: a => formatarData(a.data_entrada), ordenar: a => a.data_entrada },
  { titulo: 'No piquete há', valor: a => plural(diasDesde(a.data_entrada), 'dia', 'dias'),
    ordenar: a => diasDesde(a.data_entrada), alinhar: 'direita' },
]

// Ficha do piquete: /piquetes?ficha=1 (dados de GET /api/piquetes/:id).
export function FichaPiquete({ id }: { id: string }) {
  const { dados: p, ...estado } = useDados<PiqueteDetalhe>(`/piquetes/${encodeURIComponent(id)}`)

  return <>
    <CabecalhoFicha lista="/piquetes" rotuloLista="Voltar para os piquetes" titulo={p ? `Piquete ${p.nome}` : 'Piquete'}>
      {p && <>
        {formatarNumero(p.area_ha, 2)} ha · {plural(p.capacidade_max, 'cabeça', 'cabeças')} no máximo{' '}
        <span className={`etiqueta etiqueta--${ETIQUETA_SITUACAO[p.situacao]}`}>{p.situacao}</span>
      </>}
    </CabecalhoFicha>

    <EstadoDados {...estado}>
      {p && <div className="ficha">
        <section className="content-card" aria-labelledby="piquete-dados">
          <h2 id="piquete-dados">Lotação</h2>
          <dl className="ficha-dados">
            <Dado rotulo="Animais agora">{p.animais} de {p.capacidade_max} ({formatarNumero(p.ocupacao_pct, 0)}%)</Dado>
            <Dado rotulo="Vagas">{p.vagas}</Dado>
            <Dado rotulo="Área">{formatarNumero(p.area_ha, 2)} ha</Dado>
            <Dado rotulo="Descanso mínimo">{plural(p.descanso_min_dias, 'dia', 'dias')}</Dado>
            {p.data_liberacao && <Dado rotulo="Liberado a partir de">{formatarData(p.data_liberacao)}</Dado>}
            <Dado rotulo="Já passaram por ele">{plural(p.animais_historico, 'animal', 'animais')}</Dado>
          </dl>
        </section>

        <section className="content-card" aria-labelledby="piquete-animais">
          <h2 id="piquete-animais">Animais no piquete agora</h2>
          <Tabela legenda={`Animais no piquete ${p.nome}`} colunas={colunas} linhas={p.animais_no_piquete}
            chave={a => a.brinco}
            vazio={p.situacao === 'Em descanso' && p.data_liberacao
              ? `Nenhum animal agora: o piquete está em descanso até ${formatarData(p.data_liberacao)}.`
              : 'Nenhum animal neste piquete agora.'} />
        </section>
      </div>}
    </EstadoDados>
  </>
}
