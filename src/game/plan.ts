import {
  CAMPFIRES_PER_FLOOR,
  HERO,
  HOSPITAL_MS,
  ITEMS,
  MAX_FLOORS,
  SECONDS_PER_REST_HP,
  SECONDS_PER_WAVE_HP,
  isPotion,
  isWeapon,
  monsterGold,
  monsterHp,
  TRAIL_CLASSES,
  trailClass,
  type TrailClass,
  type DungeonId,
  type ItemId,
  type MonsterId,
  type PotionId,
  type ToolId,
  type WeaponId,
} from './data'
import { floorMap, START, type Wave } from './mapgen'

/** Itens colocados no trecho de trilha que leva até a onda. */
export interface Step {
  waveId: string
  items: ToolId[]
}

export interface FloorPlan {
  steps: Step[]
  /** Escada no fim da trilha deste andar (sobe para o próximo). */
  stairs: { x: number; y: number } | null
  /** itens na trilha até a escada (agem antes de subir; arma vale para a 1ª onda do próximo andar) */
  stairsItems?: ToolId[]
}

/**
 * Trechos de um andar são indexados 0..steps.length: o trecho i leva ao passo i;
 * o trecho steps.length é a trilha da escada.
 */
export const edgeItemsOf = (f: FloorPlan, i: number): ToolId[] => (i < f.steps.length ? f.steps[i].items : f.stairsItems ?? [])

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
  /** monsterId → quantidade de cartas (o nível não distingue a carta) */
  cards: Record<string, number>
  /** rascunho de trilha de cada dungeon (ainda não iniciada) */
  plans: Partial<Record<DungeonId, Plan>>
  /** runs iniciadas, em ordem de fila */
  runs: Run[]
  /** fim da hospitalização mais recente já coletada (epoch ms) */
  hospitalUntil: number
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
  /** se o Alberto morre nesta run: fica hospitalizado até aqui */
  hospitalUntil?: number
}

export type RunStatus = 'running' | 'queued' | 'done'

export const runStatus = (r: Run, now: number): RunStatus => (now >= r.endAt ? 'done' : now >= r.startAt ? 'running' : 'queued')
export const runDurationMs = (r: { result: SimResult }) => Math.max(1000, Math.round(r.result.runTime * 1000))

/** Quando o Alberto fica livre depois desta run (fim + hospital, se morrer). */
export const runFreeAt = (r: Run) => Math.max(r.endAt, r.hospitalUntil ?? 0)
export const hospitalFor = (result: SimResult, endAt: number) => (result.alive ? undefined : endAt + HOSPITAL_MS)

/**
 * Recalcula horários: runs já iniciadas ficam como estão; as da fila começam quando
 * o Alberto fica livre (run anterior terminou e, se morreu, saiu do hospital).
 */
export function retime(runs: Run[], now: number, hospitalUntil = 0): Run[] {
  let prevFree = hospitalUntil
  return runs.map((r) => {
    if (r.startAt <= now) {
      prevFree = Math.max(prevFree, runFreeAt(r))
      return r
    }
    const startAt = Math.max(now, prevFree)
    const endAt = startAt + runDurationMs(r)
    const next = { ...r, startAt, endAt, hospitalUntil: hospitalFor(r.result, endAt) }
    prevFree = runFreeAt(next)
    return next
  })
}

/** Quando uma nova run começaria se entrasse na fila agora. */
export const nextStartAt = (runs: Run[], now: number, hospitalUntil = 0) =>
  Math.max(now, hospitalUntil, ...runs.map(runFreeAt))

/** Até quando o Alberto está hospitalizado agora (0 se não está). */
export function hospitalizedUntil(save: Save, now: number) {
  const t = Math.max(save.hospitalUntil, ...save.runs.filter((r) => r.endAt <= now).map((r) => r.hospitalUntil ?? 0))
  return t > now ? t : 0
}

export const newPlan = (dungeon: DungeonId): Plan => ({ dungeon, floors: [{ steps: [], stairs: null }] })

export function waveById(plan: Plan, floorIdx: number, waveId: string): Wave {
  return floorMap(plan.dungeon, floorIdx + 1).waves.find((w) => w.id === waveId)!
}

export const waveHp = (w: Wave) => w.monsters.reduce((s, m) => s + monsterHp(m, w.level), 0)
export const waveGold = (w: Wave) => w.monsters.reduce((s, m) => s + monsterGold(m, w.level), 0)

// ---------- pathing: distância das trilhas ----------

type P = { x: number; y: number }
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y)

/** Ponto de onde sai a trilha que leva ao passo `stepIdx` (ou à escada, se stepIdx = steps.length). */
export function edgeFrom(plan: Plan, floorIdx: number, stepIdx: number): P {
  const f = plan.floors[floorIdx]
  return stepIdx === 0 ? START : waveById(plan, floorIdx, f.steps[stepIdx - 1].waveId)
}

/** Categoria da trilha que leva ao passo (longe demais conta como 5, mas não deveria existir). */
export function stepTrail(plan: Plan, floorIdx: number, stepIdx: number): TrailClass {
  const w = waveById(plan, floorIdx, plan.floors[floorIdx].steps[stepIdx].waveId)
  return trailClass(dist(edgeFrom(plan, floorIdx, stepIdx), w)) ?? TRAIL_CLASSES[TRAIL_CLASSES.length - 1]
}

export function stairsTrail(plan: Plan, floorIdx: number): TrailClass | null {
  const f = plan.floors[floorIdx]
  if (!f.stairs) return null
  return trailClass(dist(edgeFrom(plan, floorIdx, f.steps.length), f.stairs)) ?? TRAIL_CLASSES[TRAIL_CLASSES.length - 1]
}

/** Categoria de qualquer trecho (passo ou escada). */
export function edgeTrail(plan: Plan, floorIdx: number, edgeIdx: number): TrailClass {
  return edgeIdx < plan.floors[floorIdx].steps.length
    ? stepTrail(plan, floorIdx, edgeIdx)
    : stairsTrail(plan, floorIdx) ?? TRAIL_CLASSES[TRAIL_CLASSES.length - 1]
}

/** Dá para ligar `from` a `to` com uma trilha (dentro da distância 5)? */
export const reachable = (from: P, to: P) => trailClass(dist(from, to)) !== null

/** Esta trilha ainda aceita o item? (encaixes por categoria de distância) */
export function edgeAccepts(items: ToolId[], tool: ToolId, cls: TrailClass): boolean {
  if (cls.shared) return items.length < cls.shared
  const rest = items.filter((t) => t === 'campfire').length
  const res = items.length - rest
  return tool === 'campfire' ? rest < cls.rest : res < cls.resources
}

/** Explicação curta de por que a trilha não aceita mais o item. */
export function edgeRule(cls: TrailClass): string {
  if (cls.d === 1) return 'Distância 1 não permite recursos nem descanso.'
  if (cls.shared) return 'Distância 2 permite 1 recurso OU 1 descanso.'
  return `Distância ${cls.d} permite até ${cls.resources} ${cls.resources === 1 ? 'recurso' : 'recursos'} e 1 descanso.`
}

/** Remove itens que não cabem mais nas trilhas (ex.: trilha encurtou ao trocar a onda). */
export function fitEdges(plan: Plan): { plan: Plan; removed: number } {
  let removed = 0
  const fit = (list: ToolId[], cls: TrailClass) => {
    const items: ToolId[] = []
    for (const t of list) {
      if (edgeAccepts(items, t, cls)) items.push(t)
      else removed++
    }
    return items
  }
  const floors = plan.floors.map((f, fi) => ({
    stairs: f.stairs,
    stairsItems: f.stairs ? fit(f.stairsItems ?? [], edgeTrail(plan, fi, f.steps.length)) : [],
    steps: f.steps.map((s, si) => ({ ...s, items: fit(s.items, stepTrail(plan, fi, si)) })),
  }))
  return { plan: removed ? { ...plan, floors } : plan, removed }
}

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
  for (const t of floor.stairsItems ?? []) if (t === tool) n++
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
    let cut = false
    for (const s of f.steps) {
      // o mapa pode ter mudado de versão: uma onda fora de alcance encerra o andar
      if (!reachable(edgeFrom(out, fi, nf.steps.length), waveById(out, fi, s.waveId) ?? { x: Infinity, y: Infinity })) {
        cut = true
        break
      }
      const ns: Step = { waveId: s.waveId, items: [] }
      nf.steps.push(ns)
      for (const t of s.items) {
        if (availability(save, out, fi, t).left > 0) ns.items.push(t)
        else removed++
      }
    }
    nf.stairsItems = []
    if (cut || (nf.stairs && !reachable(edgeFrom(out, fi, nf.steps.length), nf.stairs))) {
      nf.stairs = null
      break
    }
    for (const t of f.stairsItems ?? []) {
      if (availability(save, out, fi, t).left > 0) nf.stairsItems.push(t)
      else removed++
    }
  }
  return { plan: out, removed }
}

// ---------- edição imutável ----------

const cloneFloors = (p: Plan): FloorPlan[] =>
  p.floors.map((f) => ({ stairs: f.stairs, stairsItems: [...(f.stairsItems ?? [])], steps: f.steps.map((s) => ({ ...s, items: [...s.items] })) }))

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

/** Troca a onda de um passo (mantém os itens do trecho e o caminho de saída). */
export function replaceWave(plan: Plan, floorIdx: number, stepIdx: number, waveId: string): Plan {
  const floors = cloneFloors(plan)
  floors[floorIdx].steps[stepIdx].waveId = waveId
  return { ...plan, floors }
}

/** `edgeIdx` = índice do trecho (steps.length = trilha da escada). */
export function addItem(plan: Plan, floorIdx: number, edgeIdx: number, tool: ToolId): Plan {
  const floors = cloneFloors(plan)
  edgeItemsOf(floors[floorIdx], edgeIdx).push(tool)
  return { ...plan, floors }
}

export function removeItem(plan: Plan, floorIdx: number, edgeIdx: number, itemIdx: number): Plan {
  const floors = cloneFloors(plan)
  edgeItemsOf(floors[floorIdx], edgeIdx).splice(itemIdx, 1)
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
  floors[floorIdx].stairsItems = []
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
  /** categoria de distância da trilha até esta onda */
  trail: TrailClass
  time: number
}

export interface FloorResult {
  hpStart: number
  hpEnd: number
  steps: StepResult[]
  /** trilha da escada (itens usados antes de subir) */
  stairs: { trail: TrailClass; items: ItemResult[]; afterDeath: boolean } | null
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

  /** dano de arma da trilha da escada, que vale para a 1ª onda do próximo andar */
  let carriedDmg = 0

  const floors: FloorResult[] = plan.floors.map((f, fi) => {
    const hpStart = hp
    let floorTime = 0
    const floorPotions: Partial<Record<PotionId, number>> = {}
    /** aplica os itens de um trecho; devolve resultados, dano de arma e tempo de descanso */
    const applyItems = (list: ToolId[], afterDeath: boolean) => {
      let weaponDmg = 0
      let restTime = 0
      const results: ItemResult[] = list.map((tool) => {
        let healed = 0
        if (tool === 'campfire') {
          healed = Math.max(0, max - hp)
          hp = max
          restTime += healed * SECONDS_PER_REST_HP
        } else if (isPotion(tool)) {
          healed = Math.max(0, Math.min(max, hp + ITEMS[tool].value) - hp)
          hp += healed
          if (!afterDeath) floorPotions[tool] = (floorPotions[tool] ?? 0) + 1
        } else if (isWeapon(tool)) {
          weaponDmg += ITEMS[tool].value
        }
        return { tool, hp, healed }
      })
      return { results, weaponDmg, restTime }
    }
    const steps = f.steps.map((s, si) => {
      const wave = waveById(plan, fi, s.waveId)
      const afterDeath = death !== null
      const hpBefore = hp
      const trail = stepTrail(plan, fi, si)
      const applied = applyItems(s.items, afterDeath)
      const items = applied.results
      const weaponDmg = applied.weaponDmg + carriedDmg
      carriedDmg = 0
      let stepTime = trail.seconds + applied.restTime
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
            kills[m] = (kills[m] ?? 0) + 1
          }
        }
      }
      floorTime += stepTime
      return { wave, waveHp: total, weaponDmg, damage, hpBefore, items, hpAfter: hp, dead, afterDeath, trail, time: stepTime }
    })
    // trilha até a escada também leva tempo, e pode ter itens
    const st = stairsTrail(plan, fi)
    let stairs: FloorResult['stairs'] = null
    if (st) {
      const afterDeath = death !== null
      const applied = applyItems(f.stairsItems ?? [], afterDeath)
      minHp = Math.min(minHp, hp)
      carriedDmg += applied.weaponDmg
      const t = st.seconds + applied.restTime
      floorTime += t
      if (!afterDeath) runTime += t
      stairs = { trail: st, items: applied.results, afterDeath }
    }
    totalTime += floorTime
    // poção consumida = slot usado em algum andar (renova por andar, mas é gasta ao fim da run)
    for (const [id, n] of Object.entries(floorPotions) as [PotionId, number][]) potionsUsed[id] = Math.max(potionsUsed[id] ?? 0, n)
    return { hpStart, hpEnd: hp, steps, stairs, time: floorTime }
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

/** Aceita a chave antiga `monstro:nível` e devolve só o monstro. */
export const cardMonster = (k: string) => k.split(':')[0] as MonsterId

/** Soma cartas por monstro (ignorando nível de chaves antigas). */
export function mergeCards(...sources: Record<string, number>[]) {
  const out: Record<string, number> = {}
  for (const src of sources) for (const [k, n] of Object.entries(src)) out[cardMonster(k)] = (out[cardMonster(k)] ?? 0) + n
  return out
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
