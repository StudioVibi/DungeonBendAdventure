import { useEffect, useRef } from 'react'
import { particleAt, type Burst, type Particle } from '../game/fx'
import { MAP_W } from '../game/mapgen'

/**
 * Partículas da construção de trilha num <canvas> por cima do mapa.
 * Fica fora do React e fora do <svg>: animar dentro do SVG fazia o navegador repintar o mapa inteiro a cada frame
 * (pesado no Safari), e o setState por frame re-renderizava a cena.
 */
const live: Burst[] = []
let wake: (() => void) | null = null

export function spawnBurst(b: Burst) {
  live.push(b)
  wake?.()
}

const shapes = new WeakMap<Particle, Path2D>()
function shapeOf(p: Particle) {
  let s = shapes.get(p)
  if (!s) {
    if (p.kind === 'pebble') {
      const pts = (p.shape ?? '').trim().split(/\s+/).map((xy) => xy.split(',').map(Number))
      s = new Path2D()
      pts.forEach(([x, y], i) => (i ? s!.lineTo(x, y) : s!.moveTo(x, y)))
      s.closePath()
    } else if (p.kind === 'grass') {
      const h = p.size
      const w = h * 0.34
      s = new Path2D(`M0 0C${w} ${-h * 0.45} ${w * 0.5} ${-h} 0 ${-h}C${-w * 0.5} ${-h} ${-w} ${-h * 0.45} 0 0Z`)
    } else {
      s = new Path2D()
      s.arc(0, 0, p.size, 0, Math.PI * 2)
    }
    shapes.set(p, s)
  }
  return s
}

export function FxCanvas() {
  const ref = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const cv = ref.current!
    const ctx = cv.getContext('2d')!
    let raf = 0
    let running = false
    const frame = (t: number) => {
      const w = cv.clientWidth
      const h = cv.clientHeight
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr)
        cv.height = Math.round(h * dpr)
      }
      const k = (w / MAP_W) * dpr
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, cv.width, cv.height)
      for (let i = live.length - 1; i >= 0; i--) if (t - live[i].start > live[i].total) live.splice(i, 1)
      for (const b of live) {
        for (const p of b.particles) {
          const s = particleAt(p, t - b.start)
          if (!s) continue
          ctx.setTransform(k, 0, 0, k, 0, 0)
          ctx.translate(s.x, s.y)
          ctx.rotate((s.rot * Math.PI) / 180)
          ctx.scale(s.scale, s.scale)
          ctx.globalAlpha = s.opacity
          ctx.fillStyle = p.color
          const path = shapeOf(p)
          ctx.fill(path)
          if (p.kind === 'pebble' || p.kind === 'grass') {
            ctx.lineWidth = 1.2
            ctx.strokeStyle = p.kind === 'pebble' ? '#2a292e' : '#1f4a1a'
            ctx.stroke(path)
          }
        }
      }
      ctx.globalAlpha = 1
      if (live.length) raf = requestAnimationFrame(frame)
      else {
        running = false
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, cv.width, cv.height)
      }
    }
    wake = () => {
      if (running) return
      running = true
      raf = requestAnimationFrame(frame)
    }
    if (live.length) wake()
    return () => {
      cancelAnimationFrame(raf)
      wake = null
    }
  }, [])
  return <canvas ref={ref} className="fx-canvas" />
}
