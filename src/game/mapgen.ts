import { dungeonById, MONSTERS, type DungeonId, type MonsterId } from './data'

export const MAP_W = 1600
export const MAP_H = 900
export const START = { x: 130, y: 770 }

export interface Wave {
  id: string
  x: number
  y: number
  level: number
  /** um ícone por monstro */
  monsters: MonsterId[]
}

export interface FloorMap {
  floor: number // 1-based (= nível dos monstros)
  waves: Wave[]
}

function hashString(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const WAVES_PER_FLOOR = 9
/** Orçamentos de HP (em nível 1) para as ondas de cada andar: mistura de fáceis e difíceis. */
const BUDGETS = [4, 6, 8, 10, 12, 14, 17, 20, 26]
const MAX_MONSTERS = 7
/** áreas do fundo reservadas para os mostradores diegéticos (vida e ampulheta) */
export const HUD_ZONES = [
  { x0: 0, x1: 390, y1: 270 },
  { x0: 1280, x1: MAP_W, y1: 330 },
]

const cache = new Map<string, FloorMap>()

/** Ondas pré-definidas (determinísticas) por dungeon + andar. */
export function floorMap(dungeon: DungeonId, floor: number): FloorMap {
  const key = `${dungeon}:${floor}`
  const hit = cache.get(key)
  if (hit) return hit
  const rand = mulberry32(hashString(key))
  const pool = dungeonById(dungeon).pool

  // posições: amostragem com distância mínima
  const pts: { x: number; y: number }[] = []
  let minDist = 215
  for (let tries = 0; pts.length < WAVES_PER_FLOOR; tries++) {
    if (tries > 4000) {
      minDist -= 10
      tries = 0
    }
    const p = { x: 260 + rand() * (MAP_W - 400), y: 110 + rand() * (MAP_H - 230) }
    if (Math.hypot(p.x - START.x, p.y - START.y) < 260) continue
    // cantos de cima ficam livres para a vida (esquerda) e a ampulheta (direita)
    if (HUD_ZONES.some((z) => p.x > z.x0 && p.x < z.x1 && p.y < z.y1)) continue
    if (pts.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < minDist)) continue
    pts.push(p)
  }

  const budgets = [...BUDGETS]
  for (let i = budgets.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[budgets[i], budgets[j]] = [budgets[j], budgets[i]]
  }
  const waves: Wave[] = pts.map((p, i) => {
    // 1 ou 2 tipos por onda
    const types = [pool[Math.floor(rand() * pool.length)]]
    if (rand() < 0.45) {
      const other = pool[Math.floor(rand() * pool.length)]
      if (!types.includes(other)) types.push(other)
    }
    const budget = budgets[i]
    const monsters: MonsterId[] = []
    let sum = 0
    for (let guard = 0; guard < 40 && monsters.length < MAX_MONSTERS; guard++) {
      const fits = types.filter((t) => sum + MONSTERS[t].hp[0] <= budget)
      if (fits.length === 0) break
      const t = fits[Math.floor(rand() * fits.length)]
      monsters.push(t)
      sum += MONSTERS[t].hp[0]
    }
    if (monsters.length === 0) {
      const cheapest = [...types].sort((a, b) => MONSTERS[a].hp[0] - MONSTERS[b].hp[0])[0]
      monsters.push(cheapest)
    }
    monsters.sort()
    return { id: `${floor}-${i}`, x: Math.round(p.x), y: Math.round(p.y), level: floor, monsters }
  })

  const result = { floor, waves }
  cache.set(key, result)
  return result
}
