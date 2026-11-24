import { useEffect, useId, useState, useSyncExternalStore } from 'react'
import { isMuted, onMuteChange, setMuted } from '../game/audio'
import { GOLD_ICON, HERO, MONSTERS, type MonsterId } from '../game/data'

const SPRITE_RATIO = 600 / 520

/** Ícone circular com o recorte da cabeça do monstro (dentro de um <svg>). */
export function MonsterHead({ monster, cx, cy, r, dim = false }: { monster: MonsterId; cx: number; cy: number; r: number; dim?: boolean }) {
  const id = useId()
  const m = MONSTERS[monster]
  const w = r / m.head.r
  const h = w * SPRITE_RATIO
  return (
    <g opacity={dim ? 0.45 : 1}>
      <clipPath id={id}>
        <circle cx={cx} cy={cy} r={r} />
      </clipPath>
      <circle cx={cx} cy={cy} r={r} fill="#241d1a" />
      <image href={m.sprite} x={cx - m.head.cx * w} y={cy - m.head.cy * h} width={w} height={h} clipPath={`url(#${id})`} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3e6c8" strokeWidth={3} />
    </g>
  )
}

/** Versão HTML (fora do mapa) do ícone de cabeça. */
export function MonsterHeadBadge({ monster, size = 40 }: { monster: MonsterId; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className="head-badge">
      <MonsterHead monster={monster} cx={20} cy={20} r={18} />
    </svg>
  )
}

const HEART_PATH =
  'M12 21s-7.5-4.6-9.6-9.2C.8 7.6 3.3 3.5 7.2 3.5c2.1 0 3.7 1.1 4.8 2.7 1.1-1.6 2.7-2.7 4.8-2.7 3.9 0 6.4 4.1 4.8 8.3C19.5 16.4 12 21 12 21z'

/** Coração com a vida do Alberto (dentro de um <svg>). */
export function HeartBadge({ x, y, hp, size = 34, ghost = false, grey = false }: { x: number; y: number; hp: number; size?: number; ghost?: boolean; grey?: boolean }) {
  const dead = hp <= 0
  const s = size / 24
  const fill = grey ? '#6b6461' : dead ? '#2b1f22' : '#e0474c'
  return (
    <g transform={`translate(${x} ${y})`} opacity={ghost ? 0.7 : 1} pointerEvents="none">
      <g transform={`translate(${-size / 2} ${-size / 2}) scale(${s})`}>
        <path d={HEART_PATH} fill={fill} stroke={dead && !grey ? '#ff5b5b' : '#2a1414'} strokeWidth={1.6} strokeLinejoin="round" />
        {!dead && !grey && <path d="M6.5 6.2c-1.6.3-2.4 1.8-2.2 3.2" stroke="#fff" strokeOpacity={0.6} strokeWidth={1.4} fill="none" strokeLinecap="round" />}
      </g>
      <text x={0} y={size * 0.12} textAnchor="middle" dominantBaseline="middle" className="heart-text" fontSize={size * 0.42} fill={dead && !grey ? '#ff6b6b' : '#fff'}>
        {hp}
      </text>
    </g>
  )
}

export function HeartIcon({ size = 18, dead = false }: { size?: number; dead?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ verticalAlign: 'middle' }}>
      <path d={HEART_PATH} fill={dead ? '#2b1f22' : '#e0474c'} stroke={dead ? '#ff5b5b' : '#2a1414'} strokeWidth={1.6} />
    </svg>
  )
}

export function useFrame(frames: number, ms = 140) {
  const [f, setF] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setF((v) => (v + 1) % frames), ms)
    return () => clearInterval(t)
  }, [frames, ms])
  return f
}

export function HeroImg({ size = 120 }: { size?: number }) {
  const f = useFrame(HERO.frames.length)
  return <img src={HERO.frames[f]} width={size} height={size * SPRITE_RATIO} alt={HERO.name} draggable={false} />
}

export function Gold({ value, size = 20 }: { value: number | string; size?: number }) {
  return (
    <span className="gold">
      <img src={GOLD_ICON} width={size} height={size * SPRITE_RATIO} alt="" draggable={false} />
      {value}
    </span>
  )
}

// pré-carrega todos os frames do herói para a animação não piscar
HERO.frames.forEach((src) => {
  const i = new Image()
  i.src = src
})

/** Botão de som (mudo salvo entre visitas). */
export function SoundToggle() {
  const muted = useSyncExternalStore(onMuteChange, isMuted)
  return (
    <button className="btn ghost sound-toggle" data-sfx="none" onClick={() => setMuted(!muted)} title={muted ? 'Ligar som' : 'Desligar som'}>
      {muted ? '🔇' : '🔊'}
    </button>
  )
}
