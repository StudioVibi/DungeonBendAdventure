import type { Wave } from './mapgen'

export interface Pt {
  x: number
  y: number
}

export const ICON_R = 25

/** Offsets (em unidades de "diâmetro") dos ícones de um aglomerado de n monstros. */
function clusterUnits(n: number): Pt[] {
  if (n === 1) return [{ x: 0, y: 0 }]
  if (n === 2) return [{ x: -0.5, y: 0 }, { x: 0.5, y: 0 }]
  if (n === 3) return [{ x: -0.5, y: 0.29 }, { x: 0.5, y: 0.29 }, { x: 0, y: -0.58 }]
  if (n === 4) return [{ x: -0.5, y: -0.5 }, { x: 0.5, y: -0.5 }, { x: -0.5, y: 0.5 }, { x: 0.5, y: 0.5 }]
  const ring = n - 1
  const pts: Pt[] = [{ x: 0, y: 0 }]
  for (let i = 0; i < ring; i++) {
    const a = -Math.PI / 2 + (i / ring) * Math.PI * 2 + (ring === 4 ? Math.PI / 4 : 0)
    pts.push({ x: Math.cos(a), y: Math.sin(a) })
  }
  return pts
}

export function clusterLayout(wave: Wave) {
  const step = ICON_R * 2 + 4
  const pts = clusterUnits(wave.monsters.length).map((p) => ({ x: wave.x + p.x * step, y: wave.y + p.y * step }))
  const radius = Math.max(...pts.map((p) => Math.hypot(p.x - wave.x, p.y - wave.y))) + ICON_R
  return { pts, radius }
}

export interface EdgeGeom {
  d: string
  samples: Pt[]
  at: (t: number) => Pt
  t0: number
  t1: number
  /** ângulo da tangente no fim (para a seta) */
  endAngle: number
}

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

/** Trecho de trilha curvo de a até b, recortado pelos raios dos nós. */
export function edgeGeom(a: Pt, b: Pt, ra: number, rb: number, seed: string): EdgeGeom {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
  const nx = -(b.y - a.y) / len
  const ny = (b.x - a.x) / len
  const bend = (hash(seed) % 2 ? 1 : -1) * Math.min(90, len * 0.16)
  const c = { x: (a.x + b.x) / 2 + nx * bend, y: (a.y + b.y) / 2 + ny * bend }
  const at = (t: number): Pt => ({
    x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
    y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y,
  })
  const t0 = Math.min(0.45, ra / len)
  const t1 = Math.max(0.55, 1 - rb / len)
  const N = 28
  const samples: Pt[] = []
  for (let i = 0; i <= N; i++) samples.push(at(t0 + ((t1 - t0) * i) / N))
  const d = samples.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('')
  const pe = samples[N]
  const pp = samples[N - 1]
  return { d, samples, at, t0, t1, endAngle: Math.atan2(pe.y - pp.y, pe.x - pp.x) }
}

export function distToPolyline(p: Pt, pts: Pt[]) {
  let best = Infinity
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const l2 = dx * dx + dy * dy || 1
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2))
    best = Math.min(best, Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)))
  }
  return best
}
