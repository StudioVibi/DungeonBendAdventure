import { useEffect, useRef, useState } from 'react'
import { DUNGEONS, HERO, ITEMS, MONSTERS, CAMPFIRE_ICON, STAIRS_ICON, GOLD_ICON } from '../game/data'

const IMAGES = [
  ...HERO.frames,
  ...Object.values(MONSTERS).map((m) => m.sprite),
  ...Object.values(ITEMS).map((i) => i.icon),
  ...DUNGEONS.map((d) => d.bg),
  CAMPFIRE_ICON,
  STAIRS_ICON,
  GOLD_ICON,
  ...['plain', 'plain-empty', 'caverna', 'cripta', 'jardim', 'shop'].map((n) => `/assets/generated/overworld/${n}.svg`),
]

const AUDIO = [
  '/assets/audio/music/trilha.mp3',
  '/assets/audio/music/trilha2.mp3',
  ...['confirm', 'back', 'buy'].map((n) => `/assets/audio/sfx/${n}.mp3`),
  ...DUNGEONS.flatMap((d) => [`/assets/audio/sfx/construction-${d.id}.mp3`, `/assets/audio/sfx/impact-${d.id}.mp3`]),
]

function loadImage(src: string) {
  return new Promise<void>((res) => {
    const img = new Image()
    img.onload = img.onerror = () => res()
    img.src = src
  })
}
const loadFile = (src: string) =>
  fetch(src)
    .then((r) => r.arrayBuffer())
    .then(() => undefined)
    .catch(() => undefined)

/** Pré-carrega imagens e áudio; qualquer clique ou tecla começa (e destrava o som do navegador). */
export function Loading({ onDone }: { onDone: () => void }) {
  const total = IMAGES.length + AUDIO.length
  const [done, setDone] = useState(0)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    let alive = true
    const tick = () => alive && setDone((n) => n + 1)
    for (const src of IMAGES) void loadImage(src).then(tick)
    for (const src of AUDIO) void loadFile(src).then(tick)
    return () => {
      alive = false
    }
  }, [])

  // a frase só entra depois do motion do título (DungeonBend .8s + Adventure .65s→1.35s)
  const [titleDone, setTitleDone] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setTitleDone(true), 1450)
    return () => clearTimeout(t)
  }, [])
  const ready = done >= total && titleDone
  const loaded = done >= total
  const pct = Math.min(1, done / total)
  const started = useRef(false)
  // pronto: qualquer clique ou tecla começa
  useEffect(() => {
    if (!ready) return
    const go = () => {
      if (started.current) return
      started.current = true
      setLeaving(true)
      setTimeout(onDone, 380)
    }
    window.addEventListener('pointerdown', go)
    window.addEventListener('keydown', go)
    return () => {
      window.removeEventListener('pointerdown', go)
      window.removeEventListener('keydown', go)
    }
  }, [ready, onDone])

  return (
    <div className={`loading ${leaving ? 'leaving' : ''}`}>
      <h1 className="loading-title">
        <span className="lt-main">DungeonBend</span>
        <span className="lt-sub">Adventure</span>
      </h1>
      <div className="loading-foot">
        {ready ? (
          <p className="loading-start">Clique ou aperte qualquer botão para começar</p>
        ) : loaded ? null : (
          <>
            <div className="loading-bar">
              <div style={{ width: `${pct * 100}%` }} />
            </div>
            <div className="loading-pct">Carregando… {Math.round(pct * 100)}%</div>
          </>
        )}
      </div>
    </div>
  )
}
