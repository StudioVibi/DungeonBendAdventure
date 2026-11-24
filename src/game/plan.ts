import {
  CAMPFIRES_PER_FLOOR,
  HERO,
  ITEMS,
  MAX_FLOORS,
  SECONDS_PER_REST_HP,
  SECONDS_PER_WAVE_HP,
  isPotion,
  isWeapon,
  monsterGold,
  monsterHp,
  type DungeonId,
  type ItemId,
  type MonsterId,
  type PotionId,
  type ToolId,
  type WeaponId,
} from './data'
import { floorMap, type Wave } from './mapgen'

/** Itens colocados no trecho de trilha que leva até a onda. */
export interface Step {
  waveId: string
  items: ToolId[]
}

export interface FloorPlan {
  steps: Step[]
  /** Escada no fim da trilha deste andar (sobe para o próximo). */
  stairs: { x: number; y: number } | null
}

export interface Plan {
  dungeon: DungeonId
  floors: FloorPlan[]
}

export interface Loadout {
  potions: (PotionId | null)[]
  weapons: (WeaponId | null)[]
}

export interface Save {
  gold: number
  stock: Record<ItemId, number>
  loadout: Loadout
  /** chave `${monsterId}:${level}` → quantidade de cartas */
  cards: Record<string, number>
  /** rascunho de trilha de cada dungeon (ainda não iniciada) */
  plans: Partial<Record<DungeonId, Plan>>
  /** runs iniciadas, em ordem de fila */
  runs: Run[]
}

/** Uma run iniciada: roda em tempo real; a próxima da fila começa quando esta termina. */
export interface Run {
  id: string
  dungeon: DungeonId
  plan: Plan
  result: SimResult
  /** epoch ms */
  startAt: number
  endAt: number
}

export type RunStatus = 'running' | 'queued' | 'done'

export const runStatus = (r: Run, now: number): RunStatus => (now >= r.endAt ? 'done' : now >= r.startAt ? 'running' : 'queued')
export const runDurationMs = (r: { result: SimResult }) => Math.max(1000, Math.round(r.result.runTime * 1000))

/** Recalcula horários: runs já iniciadas ficam como estão; as da fila começam quando a anterior termina. */
export function retime(runs: Run[], now: number): Run[] {
  let prevEnd = 0
  return runs.map((r) => {
    if (r.startAt <= now) {
      prevEnd = Math.max(prevEnd, r.endAt)
      return r
    }
    const startAt = Math.max(now, prevEnd)
    const endAt = startAt + runDurationMs(r)
    prevEnd = endAt
    return { ...r, startAt, endAt }
  })
}

/** Quando uma nova run começaria se entrasse na fila agora. */
export const nextStartAt = (runs: Run[], now: number) => Math.max(now, ...runs.map((r) => r.endAt))

export const newPlan = (dungeon: DungeonId): Plan => ({ dungeon, floors: [{ steps: [], stairs: null }] })

export function waveById(plan: Plan, floorIdx: number, waveId: string): Wave {
  return floorMap(plan.dungeon, floorIdx + 1).waves.find((w) => w.id === waveId)!
}

export const waveHp = (w: Wave) => w.monsters.reduce((s, m) => s + monsterHp(m, w.level), 0)
export const waveGold = (w: Wave) => w.monsters.reduce((s, m) => s + monsterGold(m, w.level), 0)

// ---------- limites de uso ----------

export interface ToolAvailability {
  /** quantas vezes ainda pode ser colocado neste andar */
  left: number
  /** limite por andar (slots na mochila) */
  perFloor: number
  usedOnFloor: number
}

function countTool(floor: FloorPlan, tool: ToolId) {
  let n = 0
  for (const s of floor.steps) for (const t of s.items) if (t === tool) n++
  return n
}

export function availability(save: Save, plan: Plan, floorIdx: number, tool: ToolId): ToolAvailability {
  const floor = plan.floors[floorIdx]
  const usedOnFloor = countTool(floor, tool)
  if (tool === 'campfire') {
    return { perFloor: CAMPFIRES_PER_FLOOR, usedOnFloor, left: Math.max(0, CAMPFIRES_PER_FLOOR - usedOnFloor) }
  }
  const slots = isPotion(tool) ? save.loadout.potions : save.loadout.weapons
  const perFloor = slots.filter((s) => s === tool).length
  // a mochila renova a cada andar: o limite é só o número de slots com esse item
  return { perFloor, usedOnFloor, left: Math.max(0, perFloor - usedOnFloor) }
}

/** Remove do plano tudo que a mochila/estoque atual não permite mais. */
export function sanitizePlan(plan: Plan, save: Save): { plan: Plan; removed: number } {
  let removed = 0
  const out: Plan = { dungeon: plan.dungeon, floors: [] }
  for (const f of plan.floors) {
    const nf: FloorPlan = { steps: [], stairs: f.stairs }
    out.floors.push(nf)
    const fi = out.floors.length - 1
    for (const s of f.steps) {
      const ns: Step = { waveId: s.waveId, items: [] }
      nf.steps.push(ns)
      for (const t of s.items) {
        if (availability(save, out, fi, t).left > 0) ns.items.push(t)
        else removed++
      }
    }
  }
  return { plan: out, removed }
}

// ---------- edição imutável ----------

const cloneFloors = (p: Plan) => p.floors.map((f) => ({ stairs: f.stairs, steps: f.steps.map((s) => ({ ...s, items: [...s.items] })) }))

export function appendWave(plan: Plan, floorIdx: number, waveId: string): Plan {
  const floors = cloneFloors(plan)
  floors[floorIdx].steps.push({ waveId, items: [] })
  return { ...plan, floors }
}

/** Corta a trilha logo depois da onda indicada (mantém a escada, se houver). */
export function truncateAfter(plan: Plan, floorIdx: number, stepIdx: number): Plan {
  const floors = cloneFloors(plan)
  floors[floorIdx].steps = floors[floorIdx].steps.slice(0, stepIdx + 1)
  return { ...plan, floors }
}

export function addItem(plan: Plan, floorIdx: number, stepIdx: number, tool: ToolId): Plan {
  const floors = cloneFloors(plan)
  floors[floorIdx].steps[stepIdx].items.push(tool)
  return { ...plan, floors }
}

export function removeItem(plan: Plan, floorIdx: number, stepIdx: number, itemIdx: number): Plan {
  const floors = cloneFloors(plan)
  floors[floorIdx].steps[stepIdx].items.splice(itemIdx, 1)
  return { ...plan, floors }
}

export function setStairs(plan: Plan, floorIdx: number, pos: { x: number; y: number }): Plan {
  const floors = cloneFloors(plan)
  floors[floorIdx].stairs = pos
  if (floors.length === floorIdx + 1 && floorIdx + 1 < MAX_FLOORS) floors.push({ steps: [], stairs: null })
  return { ...plan, floors }
}

export function removeStairs(plan: Plan, floorIdx: number): Plan {
  const floors = cloneFloors(plan).slice(0, floorIdx + 1)
  floors[floorIdx].stairs = null
  return { ...plan, floors }
}

// ---------- simulação ----------

export interface ItemResult {
  tool: ToolId
  /** vida depois do item */
  hp: number
  healed: number
}

export interface StepResult {
  wave: Wave
  waveHp: number
  weaponDmg: number
  damage: number
  hpBefore: number
  items: ItemResult[]
  hpAfter: number
  dead: boolean
  /** o Alberto já tinha morrido antes desta onda */
  afterDeath: boolean
  time: number
}

export interface FloorResult {
  hpStart: number
  hpEnd: number
  steps: StepResult[]
  time: number
}

export interface SimResult {
  floors: FloorResult[]
  alive: boolean
  hpEnd: number
  /** quanto de vida falta para sobreviver (0 se vivo) */
  deficit: number
  death: { floor: number; step: number } | null
  /** tempo do plano inteiro */
  totalTime: number
  /** tempo que de fato passa na dungeon (até a morte ou a saída) */
  runTime: number
  /** ouro dos monstros derrotados (só é recebido se sair vivo) */
  goldLoot: number
  gold: number
  kills: Record<string, number>
  potionsUsed: Partial<Record<PotionId, number>>
  wavesCleared: number
}

export function simulate(plan: Plan): SimResult {
  const max = HERO.maxHp
  let hp = max
  let minHp = Infinity
  let death: SimResult['death'] = null
  let totalTime = 0
  let runTime = 0
  let goldLoot = 0
  let wavesCleared = 0
  const kills: Record<string, number> = {}
  const potionsUsed: Partial<Record<PotionId, number>> = {}

  const floors: FloorResult[] = plan.floors.map((f, fi) => {
    const hpStart = hp
    let floorTime = 0
    const floorPotions: Partial<Record<PotionId, number>> = {}
    const steps = f.steps.map((s, si) => {
      const wave = waveById(plan, fi, s.waveId)
      const afterDeath = death !== null
      const hpBefore = hp
      let weaponDmg = 0
      let stepTime = 0
      const items: ItemResult[] = s.items.map((tool) => {
        let healed = 0
        if (tool === 'campfire') {
          healed = Math.max(0, max - hp)
          hp = max
          stepTime += healed * SECONDS_PER_REST_HP
        } else if (isPotion(tool)) {
          healed = Math.max(0, Math.min(max, hp + ITEMS[tool].value) - hp)
          hp += healed
          if (!afterDeath) floorPotions[tool] = (floorPotions[tool] ?? 0) + 1
        } else if (isWeapon(tool)) {
          weaponDmg += ITEMS[tool].value
        }
        return { tool, hp, healed }
      })
      const total = waveHp(wave)
      const damage = Math.max(0, total - weaponDmg)
      hp -= damage
      stepTime += total * SECONDS_PER_WAVE_HP
      const dead = hp <= 0
      minHp = Math.min(minHp, hp)
      if (!afterDeath) {
        runTime += stepTime
        if (dead) death = { floor: fi, step: si }
        else {
          wavesCleared++
          goldLoot += waveGold(wave)
          for (const m of wave.monsters) {
            const k = `${m}:${wave.level}`
            kills[k] = (kills[k] ?? 0) + 1
          }
        }
      }
      floorTime += stepTime
      return { wave, waveHp: total, weaponDmg, damage, hpBefore, items, hpAfter: hp, dead, afterDeath, time: stepTime }
    })
    totalTime += floorTime
    // poção consumida = slot usado em algum andar (renova por andar, mas é gasta ao fim da run)
    for (const [id, n] of Object.entries(floorPotions) as [PotionId, number][]) potionsUsed[id] = Math.max(potionsUsed[id] ?? 0, n)
    return { hpStart, hpEnd: hp, steps, time: floorTime }
  })

  const alive = death === null
  return {
    floors,
    alive,
    hpEnd: hp,
    deficit: alive ? 0 : 1 - minHp,
    death,
    totalTime,
    runTime,
    goldLoot,
    gold: alive ? goldLoot : 0,
    kills,
    potionsUsed,
    wavesCleared,
  }
}

export const cardKey = (m: MonsterId, level: number) => `${m}:${level}`
export const parseCardKey = (k: string) => {
  const [m, l] = k.split(':')
  return { monster: m as MonsterId, level: Number(l) }
}

export function formatTime(totalSeconds: number) {
  const s = Math.round(totalSeconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h) return `${h}h ${m}m`
  if (m) return `${m}m ${String(sec).padStart(2, '0')}s`
  return `${sec}s`
}
