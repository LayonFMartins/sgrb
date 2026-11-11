import { useEffect, useRef, useState, type MouseEvent } from 'react'
import type { Pesagem } from '../../types/animais'
import { formatarData, formatarNumero, formatarPeso, plural } from '../../utils/formatar'

// Gráfico de linha das pesagens de um animal, desenhado em SVG (sem biblioteca).
// Eixo X proporcional às datas; eixo Y em kg.

const ALTURA = 260
const MARGEM = { topo: 36, direita: 24, base: 32, esquerda: 52 }
const DIA = 86_400_000

const paraData = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))

// Divide o intervalo em ~4 marcas "redondas" (10, 20, 50, 100 kg...).
function marcasY(min: number, max: number) {
  const bruto = (max - min) / 4 || 10
  const base = 10 ** Math.floor(Math.log10(bruto))
  const passo = [1, 2, 5, 10].map(m => m * base).find(p => p >= bruto) ?? bruto
  const inicio = Math.floor(min / passo) * passo
  const fim = Math.ceil(max / passo) * passo
  const marcas: number[] = []
  for (let v = inicio; v <= fim + passo / 2; v += passo) marcas.push(v)
  return marcas
}

export function GraficoPeso({ pesagens }: { pesagens: Pesagem[] }) {
  const caixa = useRef<HTMLDivElement>(null)
  const [largura, setLargura] = useState(640)
  const [ativo, setAtivo] = useState<number | null>(null)

  useEffect(() => {
    const el = caixa.current
    if (!el) return
    const observador = new ResizeObserver(([e]) => setLargura(Math.max(280, e.contentRect.width)))
    observador.observe(el)
    return () => observador.disconnect()
  }, [])

  if (pesagens.length === 0) return <p className="tabela-vazia">Nenhuma pesagem registrada.</p>

  const primeira = pesagens[0]
  const ultima = pesagens[pesagens.length - 1]
  const dias = Math.round((paraData(ultima.data_pesagem) - paraData(primeira.data_pesagem)) / DIA)
  const ganho = ultima.peso_kg - primeira.peso_kg
  const gmd = dias > 0 ? ganho / dias : null

  const resumo = <dl className="grafico-resumo">
    <div><dt>Primeira pesagem</dt><dd>{formatarPeso(primeira.peso_kg)}</dd></div>
    <div><dt>Última pesagem</dt><dd>{formatarPeso(ultima.peso_kg)}</dd></div>
    <div><dt>Ganho no período</dt><dd>{ganho >= 0 ? '+' : ''}{formatarPeso(ganho)} <span>em {plural(dias, 'dia', 'dias')}</span></dd></div>
    <div><dt>Ganho médio diário</dt><dd>{gmd === null ? '—' : `${formatarNumero(gmd, 3)} kg/dia`}</dd></div>
  </dl>

  if (pesagens.length === 1) return <>
    {resumo}
    <p className="tabela-vazia">O gráfico aparece a partir da segunda pesagem.</p>
  </>

  const marcas = marcasY(Math.min(...pesagens.map(p => p.peso_kg)), Math.max(...pesagens.map(p => p.peso_kg)))
  const yMin = marcas[0]
  const yMax = marcas[marcas.length - 1]
  const t0 = paraData(primeira.data_pesagem)
  const t1 = paraData(ultima.data_pesagem)
  const larguraUtil = largura - MARGEM.esquerda - MARGEM.direita
  const alturaUtil = ALTURA - MARGEM.topo - MARGEM.base
  const x = (d: string) => MARGEM.esquerda + ((paraData(d) - t0) / (t1 - t0)) * larguraUtil
  const y = (kg: number) => MARGEM.topo + (1 - (kg - yMin) / (yMax - yMin)) * alturaUtil
  const pontos = pesagens.map(p => ({ ...p, px: x(p.data_pesagem), py: y(p.peso_kg) }))
  const caminho = pontos.map((p, i) => `${i ? 'L' : 'M'}${p.px},${p.py}`).join(' ')
  const area = `${caminho} L${pontos[pontos.length - 1].px},${y(yMin)} L${pontos[0].px},${y(yMin)} Z`
  const selecionado = ativo === null ? null : pontos[ativo]

  // Passa o mouse em qualquer lugar do gráfico: destaca a pesagem mais próxima na horizontal.
  function aoMover(e: MouseEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - r.left
    let perto = 0
    pontos.forEach((p, i) => { if (Math.abs(p.px - mx) < Math.abs(pontos[perto].px - mx)) perto = i })
    setAtivo(perto)
  }

  return <>
    {resumo}
    <div className="grafico" ref={caixa}>
      <svg width={largura} height={ALTURA} viewBox={`0 0 ${largura} ${ALTURA}`} role="img" onMouseMove={aoMover} onMouseLeave={() => setAtivo(null)}
        aria-label={`Peso de ${formatarPeso(primeira.peso_kg)} em ${formatarData(primeira.data_pesagem)} a ${formatarPeso(ultima.peso_kg)} em ${formatarData(ultima.data_pesagem)}, ${pesagens.length} pesagens.`}>
        {marcas.map(m => <g key={m} className="grafico-grade">
          <line x1={MARGEM.esquerda} x2={largura - MARGEM.direita} y1={y(m)} y2={y(m)} />
          <text x={MARGEM.esquerda - 8} y={y(m)} dy="0.32em" textAnchor="end">{formatarNumero(m)}</text>
        </g>)}
        <text className="grafico-unidade" x={MARGEM.esquerda - 8} y={MARGEM.topo - 18} textAnchor="end">kg</text>
        {[pontos[0], pontos[pontos.length - 1]].map((p, i) => <text key={i} className="grafico-eixo-x"
          x={p.px} y={ALTURA - 10} textAnchor={i ? 'end' : 'start'}>{formatarData(p.data_pesagem)}</text>)}

        <path className="grafico-area" d={area} />
        <path className="grafico-linha" d={caminho} />
        {selecionado && <line className="grafico-guia" x1={selecionado.px} x2={selecionado.px} y1={MARGEM.topo} y2={y(yMin)} />}
        {pontos.map((p, i) => <circle key={p.data_pesagem} className={`grafico-ponto${ativo === i ? ' grafico-ponto--ativo' : ''}`}
          cx={p.px} cy={p.py} r={ativo === i ? 6 : 4.5} tabIndex={0}
          aria-label={`${formatarData(p.data_pesagem)}: ${formatarPeso(p.peso_kg)}`}
          onFocus={() => setAtivo(i)} onBlur={() => setAtivo(null)} />)}
        {/* Rótulo direto só no último ponto (peso atual) */}
        {ativo === null && <text className="grafico-rotulo" x={pontos[pontos.length - 1].px} y={pontos[pontos.length - 1].py - 12}
          textAnchor="end">{formatarPeso(ultima.peso_kg)}</text>}
      </svg>
      {selecionado && ativo !== null && <div className={`grafico-dica${selecionado.py < 100 ? ' grafico-dica--abaixo' : ''}`} role="status"
        style={{ left: Math.min(Math.max(selecionado.px, 115), largura - 115), top: selecionado.py }}>
        <strong>{formatarPeso(selecionado.peso_kg)}</strong>
        <span>{formatarData(selecionado.data_pesagem)}</span>
        {ativo > 0 && <span>{variacao(pontos[ativo - 1], selecionado)}</span>}
      </div>}
    </div>
  </>
}

// Diferença em relação à pesagem anterior, com o ganho diário daquele intervalo.
function variacao(anterior: Pesagem, atual: Pesagem) {
  const kg = atual.peso_kg - anterior.peso_kg
  const dias = Math.round((paraData(atual.data_pesagem) - paraData(anterior.data_pesagem)) / DIA)
  return `${kg >= 0 ? '+' : ''}${formatarNumero(kg, 1)} kg em ${plural(dias, 'dia', 'dias')} (${formatarNumero(kg / dias, 3)} kg/dia)`
}
