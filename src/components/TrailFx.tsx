import { useEffect, useState } from 'react'
import { particleAt, type Burst } from '../game/fx'

/** Partículas da construção de trilha (renderizadas dentro do <svg> do mapa). */
export function TrailFx({ bursts, onDone }: { bursts: Burst[]; onDone: (id: number) => void }) {
  const [now, setNow] = useState(() => performance.now())

  useEffect(() => {
    if (!bursts.length) return
    let raf = 0
    const tick = (t: number) => {
      setNow(t)
      for (const b of bursts) if (t - b.start > b.total) onDone(b.id)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [bursts, onDone])

  if (!bursts.length) return null
  return (
    <g className="trail-fx" pointerEvents="none">
      {bursts.map((b) =>
        b.particles.map((p, i) => {
          const s = particleAt(p, now - b.start)
          if (!s) return null
          const tr = `translate(${s.x.toFixed(1)} ${s.y.toFixed(1)}) rotate(${s.rot.toFixed(0)}) scale(${s.scale.toFixed(2)})`
          if (p.kind === 'dust') return <circle key={b.id + ':' + i} transform={tr} r={p.size} fill={p.color} opacity={s.opacity} />
          if (p.kind === 'clod') return <circle key={b.id + ':' + i} transform={tr} r={p.size} fill={p.color} opacity={s.opacity} />
          if (p.kind === 'pebble')
            return <polygon key={b.id + ':' + i} transform={tr} points={p.shape} fill={p.color} stroke="#2a2b31" strokeWidth={1.2} opacity={s.opacity} />
          const h = p.size
          const w = h * 0.34
          return (
            <path
              key={b.id + ':' + i}
              transform={tr}
              d={`M0 0C${w} ${-h * 0.45} ${w * 0.5} ${-h} 0 ${-h}C${-w * 0.5} ${-h} ${-w} ${-h * 0.45} 0 0Z`}
              fill={p.color}
              stroke="#1f4a1a"
              strokeWidth={1.2}
              opacity={s.opacity}
            />
          )
        }),
      )}
    </g>
  )
}
