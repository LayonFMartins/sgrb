import type { Piquete } from '../../types/consultas'
import { formatarData } from '../../utils/formatar'
import '../ui/Tabela.css'
import './LotacaoPiquetes.css'

// Barra de ocupação de cada piquete (usada no painel e na tela de consultas).
export function LotacaoPiquetes({ piquetes }: { piquetes: Piquete[] }) {
  if (!piquetes.length) return <p className="tabela-vazia">Nenhum piquete cadastrado.</p>
  return <ul className="lotacao">
    {piquetes.map(p => {
      const pct = Math.min(100, p.ocupacao_pct)
      const nivel = pct >= 90 ? 'cheio' : pct >= 70 ? 'alto' : 'normal'
      return <li key={p.id_piquete} className="lotacao__item">
        <div className="lotacao__nome">
          <strong>{p.nome}</strong>
          <span>{p.area_ha.toLocaleString('pt-BR')} ha</span>
        </div>
        <div className="lotacao__barra" role="meter" aria-valuemin={0} aria-valuemax={p.capacidade_max}
          aria-valuenow={p.animais} aria-label={`Ocupação de ${p.nome}`}>
          <span className={`lotacao__preenchido lotacao__preenchido--${nivel}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="lotacao__numeros">{p.animais} / {p.capacidade_max}</span>
        <Situacao piquete={p} />
      </li>
    })}
  </ul>
}

function Situacao({ piquete }: { piquete: Piquete }) {
  if (piquete.situacao === 'Em uso') return <span className="etiqueta etiqueta--ok">Em uso</span>
  if (piquete.situacao === 'Em descanso') return <span className="etiqueta etiqueta--alerta">
    Descanso até {formatarData(piquete.data_liberacao)}
  </span>
  return <span className="etiqueta etiqueta--neutra">Disponível</span>
}
