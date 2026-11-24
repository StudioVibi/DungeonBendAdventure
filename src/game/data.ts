// Dados portados do DungeonBend (data/game/*.json), níveis 1..15 já com levelCap aplicado.
// Gerado a partir de DungeonBend/scripts/dungeon-data.ts (hpLevelsForMonster / goldLevelsForMonster).

export const HERO = {
  name: 'Alberto',
  maxHp: 15, // heroes.json → adventurer.base_max_hp
  frames: [0, 1, 2, 3, 4, 5].map((i) => `/assets/hero/alberto-${i}.webp`),
}

/** Segundos de espera por ponto de vida total de uma onda. */
export const SECONDS_PER_WAVE_HP = 2
/** Segundos de descanso por ponto de vida curado na fogueira. */
export const SECONDS_PER_REST_HP = 2
export const CAMPFIRES_PER_FLOOR = 1

// ---------- Pathing: distância das trilhas ----------
/** Distância (centro a centro, unidades do mapa) onde começa a faixa da distância 1. */
export const TRAIL_MIN = 200
/** Largura fixa de cada faixa de distância. */
export const TRAIL_BAND = 170

export interface TrailClass {
  /** 1..5 */
  d: number
  /** segundos que a trilha soma à run */
  seconds: number
  /** recursos (poções/armas) permitidos */
  resources: number
  /** descansos (fogueira) permitidos */
  rest: number
  /** encaixe único que aceita 1 recurso OU 1 descanso (distância 2) */
  shared: number
}

export const TRAIL_CLASSES: TrailClass[] = [
  { d: 1, seconds: 10, resources: 0, rest: 0, shared: 0 },
  { d: 2, seconds: 20, resources: 0, rest: 0, shared: 1 },
  { d: 3, seconds: 30, resources: 1, rest: 1, shared: 0 },
  { d: 4, seconds: 40, resources: 2, rest: 1, shared: 0 },
  { d: 5, seconds: 50, resources: 3, rest: 1, shared: 0 },
]
/** Distância máxima conectável (fim da faixa 5). */
export const TRAIL_MAX = TRAIL_MIN + TRAIL_BAND * TRAIL_CLASSES.length

/** Categoria de distância de uma trilha, ou null se longe demais. */
export function trailClass(length: number): TrailClass | null {
  if (length > TRAIL_MAX) return null
  const i = Math.max(0, Math.floor((length - TRAIL_MIN) / TRAIL_BAND))
  return TRAIL_CLASSES[Math.min(i, TRAIL_CLASSES.length - 1)]
}
export const POTION_SLOTS = 3
export const WEAPON_SLOTS = 2
export const MAX_FLOORS = 15
export const STARTING_GOLD = 60
/** Herói morto fica hospitalizado por este tempo depois do fim da run. */
export const HOSPITAL_MS = 2 * 60 * 60 * 1000

export type MonsterId = 'rat' | 'bat' | 'spider' | 'slime_green' | 'plant' | 'plant_carnivore'

export interface MonsterDef {
  id: MonsterId
  name: string
  sprite: string
  hp: number[]
  gold: number[]
  /** Recorte da cabeça: centro (fração da largura/altura do sprite) e raio (fração da largura). */
  head: { cx: number; cy: number; r: number }
  ring: string
}

export const MONSTERS: Record<MonsterId, MonsterDef> = {
  rat: {
    id: 'rat',
    name: 'Rat',
    sprite: '/assets/monsters/rat.webp',
    hp: [2, 6, 10, 14, 18, 23, 27, 27, 27, 27, 27, 27, 27, 27, 27],
    gold: [1, 3, 5, 7, 9, 11, 13, 13, 13, 13, 13, 13, 13, 13, 13],
    head: { cx: 0.19, cy: 0.75, r: 0.19 },
    ring: '#8fa3c7',
  },
  bat: {
    id: 'bat',
    name: 'Bat',
    sprite: '/assets/monsters/bat.webp',
    hp: [4, 7, 10, 13, 16, 20, 23, 26, 29, 29, 29, 29, 29, 29, 29],
    gold: [1, 2, 4, 5, 7, 9, 10, 12, 13, 13, 13, 13, 13, 13, 13],
    head: { cx: 0.37, cy: 0.62, r: 0.2 },
    ring: '#a77bd1',
  },
  spider: {
    id: 'spider',
    name: 'Black Widow',
    sprite: '/assets/monsters/spider.webp',
    hp: [6, 10, 14, 18, 22, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26],
    gold: [1, 3, 5, 7, 9, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11],
    head: { cx: 0.32, cy: 0.655, r: 0.18 },
    ring: '#d9534f',
  },
  slime_green: {
    id: 'slime_green',
    name: 'Green Slime',
    sprite: '/assets/monsters/slime-green.webp',
    hp: [4, 6, 9, 11, 14, 16, 19, 21, 24, 26, 29, 31, 34, 36, 39],
    gold: [1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18],
    head: { cx: 0.5, cy: 0.72, r: 0.24 },
    ring: '#5fcf4a',
  },
  plant: {
    id: 'plant',
    name: 'Angry Plant',
    sprite: '/assets/monsters/plant.webp',
    hp: [12, 15, 19, 23, 27, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31],
    gold: [1, 2, 4, 6, 8, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
    head: { cx: 0.39, cy: 0.59, r: 0.28 },
    ring: '#f07a2a',
  },
  plant_carnivore: {
    id: 'plant_carnivore',
    name: 'Carnivorous Plant',
    sprite: '/assets/monsters/plant-carnivore.webp',
    hp: [9, 12, 15, 18, 21, 25, 28, 31, 34, 34, 34, 34, 34, 34, 34],
    gold: [4, 5, 7, 8, 10, 12, 13, 15, 16, 16, 16, 16, 16, 16, 16],
    head: { cx: 0.48, cy: 0.62, r: 0.22 },
    ring: '#d4567a',
  },
}

export const monsterHp = (id: MonsterId, level: number) => MONSTERS[id].hp[Math.min(level, 15) - 1]
export const monsterGold = (id: MonsterId, level: number) => MONSTERS[id].gold[Math.min(level, 15) - 1]

export type DungeonId = 'caverna' | 'cripta' | 'jardim'

export interface DungeonDef {
  id: DungeonId
  name: string
  blurb: string
  pool: MonsterId[]
  bg: string
  accent: string
}

export const DUNGEONS: DungeonDef[] = [
  {
    id: 'caverna',
    name: 'Caverna',
    blurb: 'Túneis úmidos cheios de ratos, morcegos e aranhas.',
    pool: ['rat', 'bat', 'spider'],
    bg: '/assets/generated/bg-caverna.svg',
    accent: '#c9a36a',
  },
  {
    id: 'cripta',
    name: 'Cripta',
    blurb: 'Corredores de pedra tomados por slimes entre os túmulos.',
    pool: ['slime_green'],
    bg: '/assets/generated/bg-cripta.svg',
    accent: '#9fb2d8',
  },
  {
    id: 'jardim',
    name: 'Jardim',
    blurb: 'Um jardim selvagem. As plantas mordem — e batem forte.',
    pool: ['plant', 'plant_carnivore'],
    bg: '/assets/generated/bg-jardim.svg',
    accent: '#8fd46a',
  },
]

export const dungeonById = (id: DungeonId) => DUNGEONS.find((d) => d.id === id)!

export type PotionId = 'potion_s' | 'potion_m' | 'potion_l'
export type WeaponId = 'cleaver' | 'machete' | 'big_machete' | 'giant_cleaver'
export type ItemId = PotionId | WeaponId
export type ToolId = ItemId | 'campfire'

export interface ItemDef {
  id: ItemId
  kind: 'potion' | 'weapon'
  name: string
  icon: string
  /** cura (poção) ou dano flat (arma) */
  value: number
  price: number
}

// Valores de cura/dano do DungeonBend (potions.json / weapons.json). Preços arbitrários para o MVP.
export const ITEMS: Record<ItemId, ItemDef> = {
  potion_s: { id: 'potion_s', kind: 'potion', name: 'Poção pequena', icon: '/assets/items/potion-1.webp', value: 5, price: 10 },
  potion_m: { id: 'potion_m', kind: 'potion', name: 'Poção média', icon: '/assets/items/potion-2.webp', value: 12, price: 30 },
  potion_l: { id: 'potion_l', kind: 'potion', name: 'Poção grande', icon: '/assets/items/potion-3.webp', value: 20, price: 60 },
  cleaver: { id: 'cleaver', kind: 'weapon', name: 'Cleaver', icon: '/assets/items/small-cleaver.webp', value: 5, price: 25 },
  machete: { id: 'machete', kind: 'weapon', name: 'Machete', icon: '/assets/items/machete.webp', value: 7, price: 50 },
  big_machete: { id: 'big_machete', kind: 'weapon', name: 'Big Machete', icon: '/assets/items/big-machete.webp', value: 12, price: 120 },
  giant_cleaver: { id: 'giant_cleaver', kind: 'weapon', name: 'Giant Cleaver', icon: '/assets/items/big-cleaver.webp', value: 16, price: 200 },
}

export const POTION_IDS: PotionId[] = ['potion_s', 'potion_m', 'potion_l']
export const WEAPON_IDS: WeaponId[] = ['cleaver', 'machete', 'big_machete', 'giant_cleaver']

/** A arte dos itens fica 22% (da altura do canvas) abaixo do centro: suba esse tanto para centralizar. */
export const ITEM_ART_OFFSET = 0.22
/** Proporção do canvas dos itens (500×600). */
export const ITEM_ART_RATIO = 600 / 500

export const CAMPFIRE_ICON = '/assets/generated/campfire.svg'
export const STAIRS_ICON = '/assets/generated/stairs.svg'
export const GOLD_ICON = '/assets/items/gold.webp'

export const isPotion = (t: ToolId): t is PotionId => t === 'potion_s' || t === 'potion_m' || t === 'potion_l'
export const isWeapon = (t: ToolId): t is WeaponId => t !== 'campfire' && ITEMS[t as ItemId]?.kind === 'weapon'
export const toolIcon = (t: ToolId) => (t === 'campfire' ? CAMPFIRE_ICON : ITEMS[t].icon)
export const toolName = (t: ToolId) => (t === 'campfire' ? 'Fogueira' : ITEMS[t].name)
