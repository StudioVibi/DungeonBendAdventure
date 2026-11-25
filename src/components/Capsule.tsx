import type { ReactNode } from 'react'

/**
 * Cápsula do DBA: placa de metal com pontas chanfradas, aro, face, brilho, linha gravada e rebites.
 * O shape é sempre o mesmo; o `tone` troca as cores conforme a informação encapsulada.
 */
export type CapTone =
  | 'hp'
  | 'heal'
  | 'gold'
  | 'time'
  | 'dist'
  | 'weapon'
  | 'run'
  | 'done'
  | 'queue'
  | 'hospital'
  | 'neutral'
  | 'parchment'
  | 'bad'

/** Largura sugerida para um texto (fonte ~13–16) dentro da cápsula SVG. */
export const capWidth = (chars: number, fontSize = 14, extra = 0) => Math.round(chars * fontSize * 0.6 + 30 + extra)

function plate(W: number, H: number, c: number) {
  return `M${-W + c} ${-H}H${W - c}L${W} 0L${W - c} ${H}H${-W + c}L${-W} 0Z`
}

/** Cápsula dentro de um <svg>, centrada em (x, y). */
export function Capsule({
  x = 0,
  y = 0,
  w,
  h = 26,
  tone,
  children,
  className = '',
  opacity,
}: {
  x?: number
  y?: number
  w: number
  h?: number
  tone: CapTone
  children?: ReactNode
  className?: string
  opacity?: number
}) {
  const W = w / 2
  const H = h / 2
  const c = Math.min(H * 0.85, 11)
  // extensão horizontal da face numa altura y (a ponta chanfrada estreita para cima e para baixo)
  const fW = W - 3
  const fH = H - 3
  const fc = c - 1.2
  const ext = (yy: number) => fW - (fc * Math.abs(yy)) / fH
  const y1 = -fH * 0.12
  const stud = W - c * 0.62
  return (
    <g transform={`translate(${x} ${y})`} className={`cap-svg t-${tone} ${className}`} opacity={opacity} pointerEvents="none">
      <path d={plate(W, H, c)} transform="translate(0 2.5)" className="cap-shadow" />
      <path d={plate(W, H, c)} className="cap-dark" />
      <path d={plate(W - 1.5, H - 1.5, c - 0.6)} className="cap-rim" />
      <path d={plate(fW, fH, fc)} className="cap-face" />
      <path d={`M${-(fW - fc)} ${-fH}H${fW - fc}L${ext(y1)} ${y1}H${-ext(y1)}Z`} className="cap-sheen" />
      <path d={plate(W - 5.5, H - 5.5, c - 2.4)} className="cap-line" />
      <circle cx={-stud} cy={0} r={1.9} className="cap-stud" />
      <circle cx={stud} cy={0} r={1.9} className="cap-stud" />
      <g className="cap-ink">{children}</g>
    </g>
  )
}

/** Cápsula em HTML (fora do mapa). */
export function Cap({ tone, children, className = '', title }: { tone: CapTone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span className={`cap t-${tone} ${className}`} title={title}>
      <span className="cap-in">{children}</span>
    </span>
  )
}
