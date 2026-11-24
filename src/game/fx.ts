import type { DungeonId } from './data'
import type { Pt } from './geometry'

/** Efeito de construção da trilha, por bioma. */
export type FxKind = 'dust' | 'pebble' | 'grass' | 'clod'

export interface Particle {
  kind: FxKind
  x: number
  y: number
  vx: number
  vy: number
  /** gravidade (px/s²) — negativa sobe */
  g: number
  /** atraso (ms) desde o início da construção */
  delay: number
  /** vida (s) */
  life: number
  rot: number
  vrot: number
  size: number
  color: string
  /** amplitude do balanço lateral (grama) */
  sway: number
  /** forma pré-calculada (pedrinha) */
  shape?: string
}

export interface Burst {
  id: number
  start: number
  particles: Particle[]
  /** ms até a última partícula sumir */
  total: number
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]

export function polylineLength(pts: Pt[]) {
  let l = 0
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
  return l
}

/** Duração (ms) do desenho da trilha, proporcional ao comprimento. */
export const drawDuration = (pts: Pt[]) => Math.round(Math.max(420, Math.min(1000, 320 + polylineLength(pts) * 0.5)))

/** Ponto e normal ao longo da polilinha em t∈[0,1] (por comprimento). */
function along(pts: Pt[], t: number) {
  const total = polylineLength(pts)
  let target = t * total
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const seg = Math.hypot(b.x - a.x, b.y - a.y)
    if (target <= seg || i === pts.length - 1) {
      const k = seg ? Math.min(1, target / seg) : 0
      const tx = (b.x - a.x) / (seg || 1)
      const ty = (b.y - a.y) / (seg || 1)
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, nx: -ty, ny: tx, tx, ty }
    }
    target -= seg
  }
  const p = pts[pts.length - 1]
  return { x: p.x, y: p.y, nx: 0, ny: -1, tx: 1, ty: 0 }
}

function pebbleShape(size: number) {
  const n = 5 + Math.floor(Math.random() * 3)
  const pts: string[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const r = size * rnd(0.7, 1.15)
    pts.push(`${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r * 0.8).toFixed(1)}`)
  }
  return pts.join(' ')
}

const DUST_COLORS = { caverna: ['#b9a48a', '#9c8b78', '#cbb89c', '#8a7a68'], cripta: ['#9a9ca6', '#7d7f8a'], jardim: ['#8a6a3e', '#a07c4a'] }

function dust(d: DungeonId, x: number, y: number, nx: number, ny: number, delay: number, strength = 1): Particle {
  const side = Math.random() < 0.5 ? -1 : 1
  const sp = rnd(18, 55) * strength
  return {
    kind: 'dust',
    x: x + rnd(-6, 6),
    y: y + rnd(-6, 6),
    vx: nx * side * sp + rnd(-12, 12),
    vy: ny * side * sp - rnd(14, 38),
    g: -12,
    delay,
    life: rnd(0.8, 1.35),
    rot: 0,
    vrot: 0,
    size: rnd(5, 11) * (d === 'caverna' ? 1 : 0.75),
    color: pick(DUST_COLORS[d]),
    sway: 0,
  }
}

/** Gera as partículas da construção de um trecho de trilha. */
export function makeBurst(dungeon: DungeonId, pts: Pt[], dur: number, id: number): Burst {
  const len = polylineLength(pts)
  const ps: Particle[] = []
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, Math.round(v)))

  if (dungeon === 'caverna') {
    const n = clamp(len / 13, 14, 60)
    for (let i = 0; i < n; i++) {
      const t = Math.random()
      const p = along(pts, t)
      ps.push(dust(dungeon, p.x, p.y, p.nx, p.ny, t * dur))
    }
  }

  if (dungeon === 'cripta') {
    const n = clamp(len / 15, 14, 56)
    for (let i = 0; i < n; i++) {
      const t = Math.random()
      const p = along(pts, t)
      const side = Math.random() < 0.5 ? -1 : 1
      const sp = rnd(60, 150)
      const size = rnd(4, 8.5)
      ps.push({
        kind: 'pebble',
        x: p.x,
        y: p.y,
        vx: p.nx * side * sp + p.tx * rnd(-30, 30),
        vy: p.ny * side * sp - rnd(130, 230),
        g: 680,
        delay: t * dur,
        life: rnd(0.55, 0.85),
        rot: rnd(0, 360),
        vrot: rnd(-720, 720),
        size,
        color: pick(['#8d8f9a', '#6f717c', '#a5a7b2', '#5d5f69']),
        sway: 0,
        shape: pebbleShape(size),
      })
    }
    for (let i = 0; i < n / 3; i++) {
      const t = Math.random()
      const p = along(pts, t)
      ps.push(dust(dungeon, p.x, p.y, p.nx, p.ny, t * dur, 0.7))
    }
  }

  if (dungeon === 'jardim') {
    const n = clamp(len / 16, 12, 52)
    for (let i = 0; i < n; i++) {
      const t = Math.random()
      const p = along(pts, t)
      const side = Math.random() < 0.5 ? -1 : 1
      const sp = rnd(40, 115)
      ps.push({
        kind: 'grass',
        x: p.x,
        y: p.y,
        vx: p.nx * side * sp + p.tx * rnd(-25, 25),
        vy: p.ny * side * sp - rnd(150, 250),
        g: 330,
        delay: t * dur,
        life: rnd(0.95, 1.45),
        rot: rnd(-40, 40),
        vrot: rnd(-540, 540),
        size: rnd(13, 21),
        color: pick(['#9ad35a', '#b8e07a', '#7cc35e', '#c9e88a', '#6fbf4a']),
        sway: rnd(8, 20),
      })
    }
    for (let i = 0; i < n / 4; i++) {
      const t = Math.random()
      const p = along(pts, t)
      const side = Math.random() < 0.5 ? -1 : 1
      ps.push({
        kind: 'clod',
        x: p.x,
        y: p.y,
        vx: p.nx * side * rnd(40, 100),
        vy: p.ny * side * rnd(40, 100) - rnd(120, 200),
        g: 650,
        delay: t * dur,
        life: rnd(0.5, 0.75),
        rot: 0,
        vrot: 0,
        size: rnd(2.5, 4.5),
        color: pick(['#6b4f2a', '#7f5f35', '#5a4022']),
        sway: 0,
      })
    }
  }

  // impacto na chegada: anel de poeira do bioma
  const end = pts[pts.length - 1]
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + rnd(-0.2, 0.2)
    ps.push(dust(dungeon, end.x, end.y, Math.cos(a), Math.sin(a), dur, 1.3))
  }

  const total = Math.max(...ps.map((p) => p.delay + p.life * 1000))
  return { id, start: performance.now(), particles: ps, total }
}

/** Estado de uma partícula num instante (ms desde o início do burst), ou null se não visível. */
export function particleAt(p: Particle, elapsed: number) {
  const a = (elapsed - p.delay) / 1000
  if (a < 0 || a > p.life) return null
  const k = a / p.life
  let x = p.x + p.vx * a
  const y = p.y + p.vy * a + 0.5 * p.g * a * a
  if (p.sway) x += Math.sin(a * 11) * p.sway * k
  const rot = p.rot + p.vrot * a
  let opacity = 1
  let scale = 1
  if (p.kind === 'dust') {
    opacity = 0.55 * Math.pow(1 - k, 1.3) * Math.min(1, a * 8)
    scale = 1 + 1.6 * k
  } else if (p.kind === 'grass') {
    opacity = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1
  } else {
    opacity = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1
  }
  return { x, y, rot, opacity, scale }
}
