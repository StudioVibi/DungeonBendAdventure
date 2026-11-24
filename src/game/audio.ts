import type { DungeonId } from './data'

/**
 * Áudio do jogo (Web Audio).
 * Ganhos seguem a régua do DungeonBend (assets/audio/MIXAGEM.md): os arquivos vindos de lá
 * usam o ganho do catálogo original; os sintetizados (scripts/gen-audio.mjs) foram medidos
 * em LUFS e calculados para o mesmo nível — música na "cama", construção a +2 dB da âncora.
 * Ajuste ao vivo no console: __sfx.catalog.trilha.gain = 0.03, __sfx.setVolume(0.5).
 */
interface SoundDef {
  src: string
  gain: number
  loop?: boolean
  /** rampa de saída do arquivo (s) */
  fade?: { start: number; dur: number }
}

const CATALOG: Record<string, SoundDef> = {
  // música
  trilha: { src: '/assets/audio/music/trilha.mp3', gain: 0.024, loop: true }, // original (sintetizada)
  trilha2: { src: '/assets/audio/music/trilha2.mp3', gain: 0.056, loop: true }, // DungeonBend: dungeon_background_music
  // botões (DungeonBend)
  confirm: { src: '/assets/audio/sfx/confirm.mp3', gain: 0.016 }, // ui_click_1
  back: { src: '/assets/audio/sfx/back.mp3', gain: 0.008 }, // deck_card_remove
  buy: { src: '/assets/audio/sfx/buy.mp3', gain: 0.03, fade: { start: 0.7, dur: 0.3 } }, // upgrade_button
  // construção da estrada (originais)
  'construction-caverna': { src: '/assets/audio/sfx/construction-caverna.mp3', gain: 0.025 },
  'construction-cripta': { src: '/assets/audio/sfx/construction-cripta.mp3', gain: 0.022 },
  'construction-jardim': { src: '/assets/audio/sfx/construction-jardim.mp3', gain: 0.017 },
  'impact-caverna': { src: '/assets/audio/sfx/impact-caverna.mp3', gain: 0.041 },
  'impact-cripta': { src: '/assets/audio/sfx/impact-cripta.mp3', gain: 0.03 },
  'impact-jardim': { src: '/assets/audio/sfx/impact-jardim.mp3', gain: 0.04 },
}

export type SoundName = keyof typeof CATALOG
export type MusicName = 'trilha' | 'trilha2'

const MUTE_KEY = 'dungeonbend-adventure:muted'
const MUSIC_FADE = 1.2

let ctx: AudioContext | null = null
let master: GainNode
let musicBus: GainNode
let sfxBus: GainNode
const buffers = new Map<string, AudioBuffer>()
const loading = new Map<string, Promise<AudioBuffer | null>>()
let muted = typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1'
let volume = 1
let wantedMusic: MusicName | null = null
let current: { name: MusicName; src: AudioBufferSourceNode; gain: GainNode } | null = null
const listeners = new Set<() => void>()

function ensureCtx() {
  if (ctx) return ctx
  ctx = new AudioContext()
  master = ctx.createGain()
  master.gain.value = muted ? 0 : volume
  master.connect(ctx.destination)
  musicBus = ctx.createGain()
  sfxBus = ctx.createGain()
  musicBus.connect(master)
  sfxBus.connect(master)
  for (const name of Object.keys(CATALOG)) void load(name)
  return ctx
}

function load(name: string): Promise<AudioBuffer | null> {
  const hit = loading.get(name)
  if (hit) return hit
  const p = fetch(CATALOG[name].src)
    .then((r) => r.arrayBuffer())
    .then((ab) => ensureCtx().decodeAudioData(ab))
    .then((b) => {
      buffers.set(name, b)
      return b
    })
    .catch(() => null)
  loading.set(name, p)
  return p
}

/** Navegadores só liberam áudio depois de um gesto do jogador. */
function unlock() {
  const c = ensureCtx()
  if (c.state === 'suspended') void c.resume()
  if (wantedMusic && current?.name !== wantedMusic) void startMusic(wantedMusic)
}
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlock, { capture: true })
  window.addEventListener('keydown', unlock, { capture: true })
}

interface PlayOpts {
  /** atraso em segundos */
  delay?: number
  /** corta o som depois de N segundos (com rampa curta) */
  stopAfter?: number
  gainMul?: number
}

export function play(name: SoundName, opts: PlayOpts = {}) {
  if (!ctx || ctx.state !== 'running') return
  const def = CATALOG[name]
  const buf = buffers.get(name)
  if (!buf) {
    void load(name)
    return
  }
  const t0 = ctx.currentTime + (opts.delay ?? 0)
  const src = ctx.createBufferSource()
  src.buffer = buf
  const g = ctx.createGain()
  const level = def.gain * (opts.gainMul ?? 1)
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(level, t0 + 0.012)
  if (def.fade) {
    g.gain.setValueAtTime(level, t0 + def.fade.start)
    g.gain.linearRampToValueAtTime(0.0001, t0 + def.fade.start + def.fade.dur)
  }
  if (opts.stopAfter !== undefined) {
    const end = t0 + opts.stopAfter
    g.gain.setValueAtTime(level, Math.max(t0 + 0.013, end - 0.12))
    g.gain.linearRampToValueAtTime(0.0001, end)
    src.stop(end + 0.02)
  }
  src.connect(g).connect(sfxBus)
  src.start(t0)
}

async function startMusic(name: MusicName) {
  const c = ensureCtx()
  if (c.state !== 'running') return
  const buf = buffers.get(name) ?? (await load(name))
  if (!buf || wantedMusic !== name || current?.name === name) return
  const now = c.currentTime
  if (current) {
    const old = current
    old.gain.gain.cancelScheduledValues(now)
    old.gain.gain.setValueAtTime(old.gain.gain.value, now)
    old.gain.gain.linearRampToValueAtTime(0.0001, now + MUSIC_FADE)
    old.src.stop(now + MUSIC_FADE + 0.05)
  }
  const src = c.createBufferSource()
  src.buffer = buf
  src.loop = true
  const gain = c.createGain()
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.linearRampToValueAtTime(CATALOG[name].gain, now + MUSIC_FADE)
  src.connect(gain).connect(musicBus)
  src.start(now)
  current = { name, src, gain }
}

/** Troca a música de fundo (crossfade). null = silêncio. */
export function setMusic(name: MusicName | null) {
  wantedMusic = name
  if (!ctx) return // começa no primeiro gesto
  if (name === null) {
    if (current) {
      const now = ctx.currentTime
      current.gain.gain.linearRampToValueAtTime(0.0001, now + MUSIC_FADE)
      current.src.stop(now + MUSIC_FADE + 0.05)
      current = null
    }
    return
  }
  void startMusic(name)
}

/** Som de construção da estrada: arrasta enquanto a trilha se desenha e bate na chegada. */
export function construction(dungeon: DungeonId, durMs: number, index = 0) {
  const dur = durMs / 1000
  // vários trechos de uma vez (arrastar a trilha): só o primeiro arrasta inteiro, os outros mais baixos
  const mul = index === 0 ? 1 : 0.55
  play(`construction-${dungeon}`, { stopAfter: dur, gainMul: mul })
  play(`impact-${dungeon}`, { delay: dur * 0.92, gainMul: mul })
}

export function isMuted() {
  return muted
}

export function setMuted(m: boolean) {
  muted = m
  localStorage.setItem(MUTE_KEY, m ? '1' : '0')
  if (ctx) master.gain.setTargetAtTime(m ? 0 : volume, ctx.currentTime, 0.05)
  listeners.forEach((l) => l())
}

export function onMuteChange(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// afinação ao vivo pelo console (igual ao DungeonBend)
if (typeof window !== 'undefined') {
  ;(window as unknown as { __sfx: unknown }).__sfx = {
    catalog: CATALOG,
    play,
    setVolume(v: number) {
      volume = v
      if (ctx && !muted) master.gain.value = v
    },
  }
}
