import { useEffect, useId, useState } from 'react'
import { HERO } from '../game/data'
import { MAP_W } from '../game/mapgen'
import { formatTime, type SimResult } from '../game/plan'
import { Capsule, capWidth } from './Capsule'

/**
 * Dispara um motion quando o valor confirmado muda (prévias não contam).
 * A diferença é derivada durante o render (sem efeito + setState), então não custa um render extra.
 */
function useChangeFx(value: number) {
  const [prev, setPrev] = useState(value)
  const [fx, setFx] = useState<{ diff: number; key: number } | null>(null)
  if (value !== prev) {
    setPrev(value)
    setFx({ diff: value - prev, key: (fx?.key ?? 0) + 1 })
  }
  useEffect(() => {
    if (!fx) return
    const t = setTimeout(() => setFx(null), 1300)
    return () => clearTimeout(t)
  }, [fx])
  return fx
}

const HEART = 'M12 21s-7.5-4.6-9.6-9.2C.8 7.6 3.3 3.5 7.2 3.5c2.1 0 3.7 1.1 4.8 2.7 1.1-1.6 2.7-2.7 4.8-2.7 3.9 0 6.4 4.1 4.8 8.3C19.5 16.4 12 21 12 21z'
const H_TOP = 3.5
const H_BOT = 21
const S = 8

/**
 * Vida: frasco de vidro em forma de coração pendurado no canto superior esquerdo.
 * Construir uma trilha faz o frasco sofrer o dano da onda; itens de cura fazem ele regenerar.
 */
export function LifeFlask({ hp, preview }: { hp: number; preview: number | null }) {
  const id = useId()
  const fx = useChangeFx(hp)
  const lvl = (v: number) => H_BOT - Math.max(0, Math.min(1, v / HERO.maxHp)) * (H_BOT - H_TOP)
  const dead = hp <= 0
  const showPrev = preview !== null && preview !== hp
  const x = 30
  const y = 30
  return (
    <g className={`life-flask ${dead ? 'dead' : ''} ${fx && fx.diff < 0 ? 'late' : ''}`} transform={`translate(${x} ${y})`} pointerEvents="none">
      {/* correntes */}
      <path d={`M${4.2 * S} -40 L${6.2 * S} ${4.6 * S}M${19.8 * S} -40 L${17.8 * S} ${4.6 * S}`} className="lf-chain" />
      <g key={fx?.key} className={`lf-body ${fx ? (fx.diff < 0 ? 'hit' : 'heal') : ''}`}>
        <g transform={`scale(${S})`}>
          <clipPath id={id}>
            <path d={HEART} />
          </clipPath>
          <path d={HEART} className="lf-back" />
          <g clipPath={`url(#${id})`}>
            <g className="lf-liquid" style={{ transform: `translateY(${lvl(hp)}px)` }}>
              <path d="M-24 0 q3 -1 6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 V30 H-24 Z" className="lf-fill" />
              <path d="M-24 0 q3 -1 6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0" className="lf-surface" />
            </g>
            {fx && fx.diff > 0 && (
              <g className="lf-bubbles">
                <circle cx={8} cy={19} r={0.9} />
                <circle cx={13} cy={20} r={0.7} />
                <circle cx={16} cy={18.5} r={1} />
              </g>
            )}
            {showPrev && <path d={`M0 ${lvl(preview!)} H24`} className={`lf-ghost ${preview! < hp ? 'down' : 'up'}`} />}
            <rect width={24} height={24} className="lf-flash" />
          </g>
          <path d={HEART} className="lf-rim2" />
          <path d={HEART} className="lf-rim" />
          <path d="M5.2 7.2c-1.2 1-1.4 2.6-1 3.8" className="lf-shine" />
          <path d="M17.6 6.2c.9.3 1.6 1 1.8 1.9" className="lf-shine small" />
        </g>
        <text x={12 * S} y={12.4 * S} textAnchor="middle" dominantBaseline="middle" className="lf-hp">
          {hp}
        </text>
        <text x={12 * S} y={16.4 * S} textAnchor="middle" dominantBaseline="middle" className="lf-max">
          / {HERO.maxHp}
        </text>
      </g>
      {showPrev && (
        <Capsule x={24 * S + 36} y={11 * S} w={capWidth(String(preview).length + 2, 17)} h={30} tone={preview! < hp ? 'hp' : 'heal'} className="cap-lg">
          <text y={1} textAnchor="middle" dominantBaseline="middle">→ {preview}</text>
        </Capsule>
      )}
      {fx && (
        <g key={'f' + fx.key} className={`lf-float ${fx.diff < 0 ? 'down' : 'up'}`}>
          <Capsule x={12 * S} y={fx.diff < 0 ? 24 * S : -6} w={capWidth(String(Math.abs(fx.diff)).length + 3, 17)} h={30} tone={fx.diff < 0 ? 'hp' : 'heal'} className="cap-lg">
            <text y={1} textAnchor="middle" dominantBaseline="middle">
              {fx.diff < 0 ? '−' : '+'}
              {Math.abs(fx.diff)} ♥
            </text>
          </Capsule>
        </g>
      )}
    </g>
  )
}

/** Quanto da ampulheta já escorreu para um tempo total (curva suave, nunca enche de vez). */
const sandOf = (t: number) => 1 - Math.exp(-t / 600)

/** Tempo: ampulheta de madeira no canto superior direito. */
export function Hourglass({ time, preview }: { time: number; preview: number | null }) {
  const id = useId()
  const fx = useChangeFx(time)
  const f = sandOf(time)
  const W = 120
  const x = MAP_W - W - 40
  const y = 18
  const showPrev = preview !== null && preview !== time
  // areia de cima: ocupa a parte de baixo do bulbo superior; de baixo: um monte que cresce
  const topY = 82 - (1 - f) * 58
  const botY = 150 - f * 56
  return (
    <g className={`hourglass ${fx && fx.diff > 0 ? 'late' : ''}`} transform={`translate(${x} ${y})`} pointerEvents="none">
      <g key={fx?.key} className={`hg-body ${fx && fx.diff > 0 ? 'pour' : ''}`}>
        <clipPath id={id}>
          <path d="M26 18 C26 58, 56 70, 56 85 C56 100, 26 112, 26 152 H94 C94 112, 64 100, 64 85 C64 70, 94 58, 94 18 Z" />
        </clipPath>
        <path d="M26 18 C26 58, 56 70, 56 85 C56 100, 26 112, 26 152 H94 C94 112, 64 100, 64 85 C64 70, 94 58, 94 18 Z" className="hg-back" />
        <g clipPath={`url(#${id})`}>
          <rect x={0} y={topY} width={W} height={90} className="hg-sand hg-sand-top" />
          <path d={`M10 152 V${botY + 12} Q60 ${botY - 10} 110 ${botY + 12} V152 Z`} className="hg-sand hg-sand-bot" />
          <path d={`M60 84 V${botY + 2}`} className="hg-stream" />
        </g>
        <path d="M26 18 C26 58, 56 70, 56 85 C56 100, 26 112, 26 152 H94 C94 112, 64 100, 64 85 C64 70, 94 58, 94 18 Z" className="hg-glass" />
        <path d="M33 26 C34 48, 44 60, 50 68" className="hg-shine" />
        <path d="M33 146 C34 128, 40 116, 46 108" className="hg-shine" />
        {/* moldura de madeira */}
        <rect x={10} y={150} width={14} height={4} className="hg-wood" />
        <rect x={6} y={12} width={10} height={146} rx={4} className="hg-post" />
        <rect x={104} y={12} width={10} height={146} rx={4} className="hg-post" />
        <rect x={0} y={0} width={W} height={16} rx={5} className="hg-plate" />
        <rect x={0} y={152} width={W} height={16} rx={5} className="hg-plate" />
        <path d="M8 5h104M8 157h104" className="hg-grain" />
        <circle cx={11} cy={8} r={2.4} className="hg-nail" />
        <circle cx={109} cy={8} r={2.4} className="hg-nail" />
        <circle cx={11} cy={160} r={2.4} className="hg-nail" />
        <circle cx={109} cy={160} r={2.4} className="hg-nail" />
      </g>
      <Capsule x={W / 2} y={192} w={capWidth(formatTime(time).length, 17)} h={30} tone="time" className="cap-lg">
        <text y={1} textAnchor="middle" dominantBaseline="middle">{formatTime(time)}</text>
      </Capsule>
      {showPrev && (
        <Capsule x={W / 2} y={228} w={capWidth(formatTime(preview!).length + 2, 15)} h={26} tone={preview! > time ? 'run' : 'heal'}>
          <text y={1} textAnchor="middle" dominantBaseline="middle">→ {formatTime(preview!)}</text>
        </Capsule>
      )}
      {fx && fx.diff > 0 && (
        <g key={'f' + fx.key} className="hg-float">
          <Capsule x={-34} y={84} w={capWidth(formatTime(fx.diff).length + 1, 15)} h={26} tone="run">
            <text y={1} textAnchor="middle" dominantBaseline="middle">+{formatTime(fx.diff)}</text>
          </Capsule>
        </g>
      )}
    </g>
  )
}

/** Estado do Alberto (situação), em texto puro logo abaixo dele. */
export function HeroState({ x, y, sim, shown, preview, empty }: { x: number; y: number; sim: SimResult; shown: SimResult; preview: boolean; empty: boolean }) {
  const text = (r: SimResult) => (r.alive ? 'Survives' : `Deficit ${r.deficit} · floor ${r.death!.floor + 1}, wave ${r.death!.step + 1}`)
  const changed = preview && (shown.alive !== sim.alive || shown.deficit !== sim.deficit)
  if (empty && !changed) return null
  return (
    <g transform={`translate(${x} ${y})`} className="hero-state" pointerEvents="none">
      {!empty && (
        <text className={sim.alive ? 'ok' : 'bad'} dominantBaseline="middle">
          {(sim.alive ? '✓ ' : '☠ ') + text(sim)}
        </text>
      )}
      {changed && (
        <text y={empty ? 0 : 32} className={`next ${shown.alive ? 'ok' : 'bad'}`} dominantBaseline="middle">
          → {text(shown)}
        </text>
      )}
    </g>
  )
}
