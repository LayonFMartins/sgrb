import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { Input } from '../../components/ui/Input'
import type { Animal } from '../../types/animais'
import { combina } from '../../utils/busca'
import { formatarData, formatarPeso } from '../../utils/formatar'
import './VendasBaixas.css'

const LIMITE = 8

// Busca de animais ATIVOS para a venda e o óbito: digita o brinco (ou raça, categoria,
// piquete) e clica para adicionar. Mostra o piquete atual e, quando importa, a carência.
export function EscolherAnimal({ animais, ignorar, carencia, rotulo, onEscolher }: {
  animais: Animal[]
  ignorar: string[]                       // brincos já escolhidos (não aparecem de novo)
  carencia?: Map<string, string>          // brinco -> data de liberação (só quando a finalidade é Abate)
  rotulo: string
  onEscolher: (animal: Animal) => void
}) {
  const [busca, setBusca] = useState('')
  const disponiveis = animais.filter(a => a.situacao === 'Ativo' && !ignorar.includes(a.brinco) &&
    combina(busca, a.brinco, a.raca, a.categoria, a.piquete_atual))
  const mostrados = disponiveis.slice(0, LIMITE)

  return <div className="escolher-animal">
    <Input label={rotulo} type="search" value={busca} placeholder="Brinco, raça, categoria ou piquete"
      icon={<Search size={16} />} onChange={e => setBusca(e.target.value)} />
    {mostrados.length === 0
      ? <p className="cadastro-form__dica">{busca.trim()
        ? `Nenhum animal ativo encontrado para “${busca.trim()}”.`
        : 'Nenhum animal ativo disponível.'}</p>
      : <ul className="escolher-animal__lista" aria-label="Animais encontrados">
        {mostrados.map(a => {
          const liberacao = carencia?.get(a.brinco)
          return <li key={a.brinco}>
            <button type="button" className="escolher-animal__item" onClick={() => { onEscolher(a); setBusca('') }}
              aria-label={`Adicionar o animal ${a.brinco}`}>
              <Plus size={14} aria-hidden="true" />
              <strong>{a.brinco}</strong>
              <span>{a.categoria} · {a.raca}</span>
              <span className="texto-secundario">{a.piquete_atual ?? 'sem piquete'} · {formatarPeso(a.ultimo_peso_kg)}</span>
              {liberacao && <span className="etiqueta etiqueta--erro">em carência até {formatarData(liberacao)}</span>}
            </button>
          </li>
        })}
      </ul>}
    {disponiveis.length > LIMITE && <p className="cadastro-form__dica">
      Mostrando {LIMITE} de {disponiveis.length}. Digite o brinco para achar os outros.
    </p>}
  </div>
}
