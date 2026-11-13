import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Inbox, Plus, SearchX, X } from 'lucide-react'
import { Can } from '../../auth/Can'
import type { Permissao } from '../../auth/permissions'
import './Vazio.css'

interface Acao {
  rotulo: string
  permissao: Permissao          // só aparece para quem pode fazer a ação
  onClick?: () => void
  para?: string              // ou um link para outra tela
}

// Estado vazio das listas: explica o que aconteceu e oferece o próximo passo.
// - Com busca: "nada encontrado" + botão para limpar a busca.
// - Lista realmente vazia: convite para cadastrar o primeiro item.
export function Vazio({ busca, onLimparBusca, titulo, texto, acao }: {
  busca?: string
  onLimparBusca?: () => void
  titulo: string
  texto?: ReactNode
  acao?: Acao | false
}) {
  if (busca?.trim()) {
    return <div className="vazio" role="status">
      <span className="vazio__icone" aria-hidden="true"><SearchX size={22} /></span>
      <p className="vazio__titulo">Nada encontrado para “{busca.trim()}”</p>
      <p className="vazio__texto">Confira a digitação ou procure por outro termo.</p>
      {onLimparBusca && <button type="button" className="vazio__botao vazio__botao--secundario" onClick={onLimparBusca}>
        <X size={16} aria-hidden="true" />Limpar busca
      </button>}
    </div>
  }
  return <div className="vazio" role="status">
    <span className="vazio__icone" aria-hidden="true"><Inbox size={22} /></span>
    <p className="vazio__titulo">{titulo}</p>
    {texto && <p className="vazio__texto">{texto}</p>}
    {acao && <Can permissao={acao.permissao}>
      {acao.para
        ? <Link to={acao.para} className="vazio__botao"><Plus size={16} aria-hidden="true" />{acao.rotulo}</Link>
        : <button type="button" className="vazio__botao" onClick={acao.onClick}><Plus size={16} aria-hidden="true" />{acao.rotulo}</button>}
    </Can>}
  </div>
}
