import { useEffect, useState } from 'react'
import { DUNGEONS, HERO, ITEMS, MONSTERS, CAMPFIRE_ICON, STAIRS_ICON, GOLD_ICON } from '../game/data'
import { HeroImg } from './ui'

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

const TIPS = [
  'Trilhas mais longas levam mais tempo — e têm mais encaixes para itens.',
  'Uma arma na trilha da escada vale para a primeira onda do próximo andar.',
  'Morrer na dungeon custa 2 horas de hospital.',
  'A mochila renova a cada andar: cada slot pode ser usado de novo.',
  'Monstros derrotados viram cartas para a coleção.',
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

/** Pré-carrega imagens e áudio; o clique final também destrava o som do navegador. */
export function Loading({ onDone }: { onDone: () => void }) {
  const total = IMAGES.length + AUDIO.length
  const [done, setDone] = useState(0)
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)])
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

  const ready = done >= total
  const pct = Math.min(1, done / total)
  const go = () => {
    setLeaving(true)
    setTimeout(onDone, 380)
  }
  // Enter também entra (sem foco automático no botão, que desenhava um contorno)
  useEffect(() => {
    if (!ready) return
    const onKey = (e: KeyboardEvent) => e.key === 'Enter' && go()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  return (
    <div className={`loading ${leaving ? 'leaving' : ''}`}>
      <div className="loading-card">
        <div className="loading-logo">
          DungeonBend <span>Adventure</span>
        </div>
        <HeroImg size={150} />
        {ready ? (
          <button className="loading-go" onClick={go}>
            Entrar
          </button>
        ) : (
          <>
            <div className="loading-bar">
              <div style={{ width: `${pct * 100}%` }} />
            </div>
            <div className="loading-pct">Carregando… {Math.round(pct * 100)}%</div>
          </>
        )}
        <p className="loading-tip">{tip}</p>
      </div>
    </div>
  )
}
