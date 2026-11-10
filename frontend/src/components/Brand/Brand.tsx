import brandMark from '../../assets/boi.svg'
import './Brand.css'

interface BrandProps {
  compact?: boolean
}

export function Brand({ compact = false }: BrandProps) {
  return (
    <div className={`brand${compact ? ' brand--compact' : ''}`}>
      <div className="brand__identity">
        {!compact && <img src={brandMark} alt="" width="116" height="116" />}
        <span className="brand__name">SGRB</span>
      </div>
      <span className="brand__accent" aria-hidden="true" />
      <p className="brand__description">
        {compact
          ? 'Gestão e Rastreabilidade de Rebanho Bovino'
          : 'Sistema de Gestão e Rastreabilidade de Rebanho Bovino'}
      </p>
    </div>
  )
}
