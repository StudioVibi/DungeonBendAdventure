import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent, type RefObject } from 'react'
import { drawDuration, makeBurst, type Burst } from '../game/fx'
import { TrailFx } from './TrailFx'
import { CAMPFIRE_ICON, HERO, ITEMS, STAIRS_ICON, dungeonById, isWeapon, toolIcon, type ToolId, type TrailClass } from '../game/data'
import { clusterLayout, edgeGeom, ICON_R, type EdgeGeom, type Pt } from '../game/geometry'
import { floorMap, MAP_H, MAP_W, START, type Wave } from '../game/mapgen'
import { stairsTrail, waveById, waveHp, type Plan, type SimResult } from '../game/plan'
import { HeartBadge, MonsterHead, useFrame } from './ui'

/** Sprite animado separado para não re-renderizar o mapa inteiro a cada frame. */
function HeroSprite({ x, y }: { x: number; y: number }) {
  const f = useFrame(HERO.frames.length)
  return <image href={HERO.frames[f]} x={x} y={y} width={110} height={127} />
}

export type Ghost = { kind: 'wave'; stepIdx: number } | { kind: 'item'; stepIdx: number; itemIdx: number } | { kind: 'stairs' }

export interface FloorGeom {
  waves: Wave[]
  /** trecho que leva até a onda de cada passo */
  edges: EdgeGeom[]
  stairsEdge: EdgeGeom | null
  tail: Pt
  tailR: number
}

const START_R = 58
const STAIRS_R = 44

export function floorGeometry(plan: Plan, floorIdx: number): FloorGeom {
  const f = plan.floors[floorIdx]
  const waves = floorMap(plan.dungeon, floorIdx + 1).waves
  let prev: Pt = START
  let prevR = START_R
  let prevId = 'start'
  const edges = f.steps.map((s) => {
    const w = waveById(plan, floorIdx, s.waveId)
    const r = clusterLayout(w).radius + 10
    const e = edgeGeom(prev, w, prevR, r, prevId + s.waveId)
    prev = w
    prevR = r
    prevId = s.waveId
    return e
  })
  const stairsEdge = f.stairs ? edgeGeom(prev, f.stairs, prevR, STAIRS_R + 6, prevId + 'stairs') : null
  return { waves, edges, stairsEdge, tail: prev, tailR: prevR }
}

interface Props {
  plan: Plan
  sim: SimResult
  floorIdx: number
  ghost: Ghost | null
  dropStep: number | null
  /** o trecho sob o item arrastado não aceita esse item */
  dropBlocked: boolean
  /** onda sob o mouse que está longe demais para conectar */
  tooFarWaveId: string | null
  /** de onde sai a próxima trilha */
  tailPt: Pt
  svgRef: RefObject<SVGSVGElement | null>
  hoverWaveId: string | null
  /** linhas-guia durante arrastos (conectar / mudar caminho) */
  guides: [Pt, Pt][]
  /** trecho escondido enquanto está sendo arrastado */
  hiddenEdge: number | 'stairs' | null
  onEdgePointerDown: (e: RPointerEvent, edge: number | 'stairs') => void
  onHoverWave: (id: string | null) => void
  onWaveClick: (waveId: string) => void
  onItemClick: (stepIdx: number, itemIdx: number) => void
  onStairsClick: () => void
  onTailPointerDown: (e: RPointerEvent) => void
  onSvgPointerMove: (e: RPointerEvent) => void
  onSvgPointerUp: (e: RPointerEvent) => void
}

/** `draw`: duração (ms) da animação de construção, se este trecho acabou de ser criado. */
function Trail({ d, ghost, highlight, dead, draw }: { d: string; ghost?: boolean; highlight?: 'good' | 'bad'; dead?: boolean; draw?: number }) {
  return (
    <g
      className={`trail ${ghost ? 'ghost' : ''} ${draw ? 'drawing' : ''}`}
      style={draw ? ({ '--dur': `${draw}ms` } as CSSProperties) : undefined}
      pointerEvents="none"
    >
      <path d={d} pathLength={1} className="trail-bed" style={highlight ? { stroke: highlight === 'bad' ? 'rgba(255, 90, 90, .5)' : 'rgba(255, 214, 120, .55)', strokeWidth: 34 } : undefined} />
      <path d={d} pathLength={1} className="trail-edge" />
      <path d={d} className={dead ? 'trail-dash dead' : 'trail-dash'} />
    </g>
  )
}

function Arrow({ e, ghost, draw }: { e: EdgeGeom; ghost?: boolean; draw?: number }) {
  const p = e.samples[e.samples.length - 1]
  const deg = (e.endAngle * 180) / Math.PI
  return (
    <path
      d="M-14 -10L2 0L-14 10"
      transform={`translate(${p.x} ${p.y}) rotate(${deg})`}
      className={`trail-arrow ${draw ? 'drawing' : ''}`}
      style={draw ? ({ '--dur': `${draw}ms` } as CSSProperties) : undefined}
      opacity={ghost ? 0.6 : 1}
      pointerEvents="none"
    />
  )
}

type SocketKind = 'any' | 'res' | 'rest'

/** Encaixes de uma trilha e em qual encaixe cada item fica. */
function socketLayout(items: ToolId[], cls: TrailClass) {
  const kinds: SocketKind[] = cls.shared ? ['any'] : [...Array<SocketKind>(cls.resources).fill('res'), ...Array<SocketKind>(cls.rest).fill('rest')]
  const used = kinds.map(() => false)
  const slotOf = items.map((t) => {
    const want: SocketKind = cls.shared ? 'any' : t === 'campfire' ? 'rest' : 'res'
    let k = kinds.findIndex((kind, i) => kind === want && !used[i])
    if (k < 0) {
      kinds.push(want) // não deveria acontecer (fitEdges), mas não some com o item
      used.push(false)
      k = kinds.length - 1
    }
    used[k] = true
    return k
  })
  return { kinds, slotOf }
}

const socketT = (e: EdgeGeom, k: number, n: number) => e.t0 + (e.t1 - e.t0) * (0.34 + (0.54 * (k + 0.5)) / n)

/** Marco de distância da trilha (D1..D5 e o tempo que soma). */
function DistanceBadge({ e, cls, ghost }: { e: EdgeGeom; cls: TrailClass; ghost?: boolean }) {
  const pt = e.at(e.t0 + (e.t1 - e.t0) * 0.15)
  return (
    <g transform={`translate(${pt.x} ${pt.y})`} className={`dist-badge d${cls.d}`} opacity={ghost ? 0.85 : 1} pointerEvents="none">
      <rect x={-30} y={-12} width={60} height={24} rx={12} />
      <text x={-14} y={1} textAnchor="middle" dominantBaseline="middle" className="dist-d">D{cls.d}</text>
      <text x={13} y={1} textAnchor="middle" dominantBaseline="middle" className="dist-s">{cls.seconds}s</text>
    </g>
  )
}

export function MapView(p: Props) {
  const { plan, sim, floorIdx, ghost } = p
  const floor = plan.floors[floorIdx]
  const fr = sim.floors[floorIdx]
  const g = floorGeometry(plan, floorIdx)
  const dungeon = dungeonById(plan.dungeon)
  const stepOf = new Map(floor.steps.map((s, i) => [s.waveId, i]))
  const ghostWaveStep = ghost?.kind === 'wave' ? ghost.stepIdx : -1

  // ---- motion: construção de trilha ----
  // chave de cada trecho = origem>destino; trechos novos (fora de prévias) se desenham e levantam partículas do bioma
  const edgeKey = (i: number) => `${i === 0 ? 'start' : floor.steps[i - 1].waveId}>${floor.steps[i].waveId}`
  const stairsKey = floor.stairs ? `${floor.steps.at(-1)?.waveId ?? 'start'}>stairs@${floor.stairs.x},${floor.stairs.y}` : null
  const realEdges: { key: string; geom: EdgeGeom }[] = g.edges.map((e, i) => ({ key: edgeKey(i), geom: e }))
  if (stairsKey && g.stairsEdge) realEdges.push({ key: stairsKey, geom: g.stairsEdge })
  const keysSig = realEdges.map((e) => e.key).join('|')
  const ctx = `${plan.dungeon}:${floorIdx}`
  const seen = useRef<{ ctx: string; keys: Set<string> } | null>(null)
  const [drawing, setDrawing] = useState<Record<string, number>>({})
  const [bursts, setBursts] = useState<Burst[]>([])
  const burstId = useRef(0)
  const onBurstDone = useCallback((id: number) => setBursts((bs) => (bs.some((b) => b.id === id) ? bs.filter((b) => b.id !== id) : bs)), [])

  useLayoutEffect(() => {
    if (ghost) return // prévias não contam como construção
    const prev = seen.current
    seen.current = { ctx, keys: new Set(realEdges.map((e) => e.key)) }
    if (!prev || prev.ctx !== ctx) return // troca de andar/dungeon: não anima o que já existia
    const fresh = realEdges.filter((e) => !prev.keys.has(e.key))
    if (!fresh.length) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const add: Record<string, number> = {}
    const newBursts: Burst[] = []
    for (const e of fresh) {
      const dur = drawDuration(e.geom.samples)
      add[e.key] = dur
      if (!reduce) newBursts.push(makeBurst(plan.dungeon, e.geom.samples, dur, ++burstId.current))
    }
    setDrawing((d) => ({ ...d, ...add }))
    if (newBursts.length) setBursts((bs) => [...bs, ...newBursts])
    const maxDur = Math.max(...Object.values(add))
    setTimeout(() => {
      setDrawing((d) => {
        const n = { ...d }
        for (const k of Object.keys(add)) if (n[k] === add[k]) delete n[k]
        return n
      })
    }, maxDur + 400)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keysSig, ctx, !!ghost])

  return (
    <svg
      ref={p.svgRef}
      className="map"
      viewBox={`0 0 ${MAP_W} ${MAP_H}`}
      preserveAspectRatio="xMidYMid meet"
      onPointerMove={p.onSvgPointerMove}
      onPointerUp={p.onSvgPointerUp}
    >
      <image href={dungeon.bg} x={0} y={0} width={MAP_W} height={MAP_H} preserveAspectRatio="xMidYMid slice" />

      {/* trilhas */}
      {g.edges.map((e, i) =>
        p.hiddenEdge === i ? null : (
          <Trail key={'e' + edgeKey(i)} d={e.d} ghost={i === ghostWaveStep} highlight={p.dropStep === i ? (p.dropBlocked ? 'bad' : 'good') : undefined} dead={fr.steps[i]?.afterDeath} draw={drawing[edgeKey(i)]} />
        ),
      )}
      {g.stairsEdge && p.hiddenEdge !== 'stairs' && (
        <Trail key={'s' + stairsKey} d={g.stairsEdge.d} ghost={ghost?.kind === 'stairs'} draw={stairsKey ? drawing[stairsKey] : undefined} />
      )}
      {g.edges.map((e, i) => (p.hiddenEdge === i ? null : <Arrow key={'a' + edgeKey(i)} e={e} ghost={i === ghostWaveStep} draw={drawing[edgeKey(i)]} />))}
      {p.tooFarWaveId && (() => {
        const w = g.waves.find((x) => x.id === p.tooFarWaveId)!
        return <line x1={p.tailPt.x} y1={p.tailPt.y} x2={w.x} y2={w.y} className="link-line far" pointerEvents="none" />
      })()}
      {p.guides.map(([a, b], i) => (
        <line key={'g' + i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="link-line" pointerEvents="none" />
      ))}
      <TrailFx bursts={bursts} onDone={onBurstDone} />
      {/* área de clique/arraste das trilhas (fica sob as ondas) */}
      {!ghost &&
        g.edges.map((e, i) => (
          <path key={'h' + i} d={e.d} className="edge-hit" onPointerDown={(ev) => p.onEdgePointerDown(ev, i)}>
            <title>{i === g.edges.length - 1 && !floor.stairs ? 'Clique para apagar · arraste para mudar a onda' : 'Arraste para mudar a onda'}</title>
          </path>
        ))}
      {!ghost && g.stairsEdge && (
        <path d={g.stairsEdge.d} className="edge-hit" onPointerDown={(ev) => p.onEdgePointerDown(ev, 'stairs')}>
          <title>Clique para apagar a escada · arraste para mover</title>
        </path>
      )}

      {/* ondas */}
      {g.waves.map((w) => {
        const si = stepOf.get(w.id)
        const inPath = si !== undefined
        const r = si !== undefined ? fr.steps[si] : undefined
        const { pts, radius } = clusterLayout(w)
        const isGhost = si === ghostWaveStep
        const hovered = p.hoverWaveId === w.id && !inPath
        const total = w.monsters.length
        const label = r && r.weaponDmg > 0 ? r.damage : null
        const greyed = r?.afterDeath
        return (
          <g
            key={w.id}
            className={`wave ${inPath && !isGhost ? 'in-path' : ''} ${hovered ? 'hovered' : ''} ${p.tooFarWaveId === w.id ? 'too-far' : ''}`}
            onPointerEnter={() => p.onHoverWave(w.id)}
            onPointerLeave={() => p.onHoverWave(null)}
            onClick={() => p.onWaveClick(w.id)}
          >
            <circle cx={w.x} cy={w.y} r={radius + 14} className="wave-hit" />
            <circle cx={w.x} cy={w.y} r={radius + 8} className="wave-halo" />
            {pts.map((pt, i) => (
              <MonsterHead key={i} monster={w.monsters[i]} cx={pt.x} cy={pt.y} r={total >= 5 ? ICON_R - 1 : ICON_R} dim={greyed} />
            ))}
            {/* custo da onda */}
            <g transform={`translate(${w.x} ${w.y + radius + 16})`} pointerEvents="none">
              <rect x={-30} y={-12} width={60} height={24} rx={12} className="cost-pill" />
              {label !== null ? (
                <>
                  <text x={-10} y={1} className="cost-text struck" textAnchor="middle" dominantBaseline="middle">{r!.waveHp}</text>
                  <text x={14} y={1} className="cost-text" textAnchor="middle" dominantBaseline="middle">−{label}</text>
                </>
              ) : (
                <text x={0} y={1} className="cost-text" textAnchor="middle" dominantBaseline="middle">−{waveHp(w)} ♥</text>
              )}
            </g>
            {inPath && (
              <g transform={`translate(${w.x - radius * 0.78} ${w.y - radius * 0.78})`} pointerEvents="none" opacity={isGhost ? 0.6 : 1}>
                <circle r={13} className="order-dot" />
                <text y={1} textAnchor="middle" dominantBaseline="middle" className="order-text">{si! + 1}</text>
              </g>
            )}
            {r && <HeartBadge x={w.x + radius * 0.85} y={w.y - radius * 0.8} hp={r.hpAfter} ghost={isGhost} grey={r.afterDeath} />}
            {p.tooFarWaveId === w.id && (
              <text x={w.x} y={w.y - radius - 14} textAnchor="middle" className="death-text" pointerEvents="none">
                longe demais
              </text>
            )}
            {r?.dead && !r.afterDeath && (
              <text x={w.x} y={w.y - radius - 14} textAnchor="middle" className="death-text" pointerEvents="none">
                ☠ morre aqui
              </text>
            )}
          </g>
        )
      })}

      {/* encaixes e itens nas trilhas (quantidade depende da distância) */}
      {floor.steps.map((s, si) => {
        const e = g.edges[si]
        const r = fr.steps[si]
        if (!r || p.hiddenEdge === si) return null
        const { kinds, slotOf } = socketLayout(s.items, r.trail)
        const filled = new Set(slotOf)
        const isDrop = p.dropStep === si
        return (
          <g key={'sk' + si}>
            <DistanceBadge e={e} cls={r.trail} ghost={si === ghostWaveStep} />
            {kinds.map((kind, k) =>
              filled.has(k) ? null : (
                <g
                  key={k}
                  transform={`translate(${e.at(socketT(e, k, kinds.length)).x} ${e.at(socketT(e, k, kinds.length)).y})`}
                  className={`socket ${isDrop ? (p.dropBlocked ? 'blocked' : 'open') : ''}`}
                  pointerEvents="none"
                >
                  <circle r={17} />
                  {kind === 'rest' ? (
                    <image href={CAMPFIRE_ICON} x={-12} y={-12} width={24} height={24} opacity={0.45} />
                  ) : kind === 'any' ? (
                    <>
                      <path d="M-6 0h12M0 -6v12" className="socket-plus" />
                      <image href={CAMPFIRE_ICON} x={4} y={2} width={13} height={13} opacity={0.5} />
                    </>
                  ) : (
                    <path d="M-6 0h12M0 -6v12" className="socket-plus" />
                  )}
                </g>
              ),
            )}
            {s.items.map((tool, ii) => {
              const pt = e.at(socketT(e, slotOf[ii], kinds.length))
              const res = r.items[ii]
              const isGhost = ghost?.kind === 'item' && ghost.stepIdx === si && ghost.itemIdx === ii
              return (
                <g
                  key={`${si}-${ii}`}
                  className={`path-item ${isGhost ? 'ghost' : ''}`}
                  transform={`translate(${pt.x} ${pt.y})`}
                  onClick={(ev) => {
                    ev.stopPropagation()
                    p.onItemClick(si, ii)
                  }}
                >
                  <title>Clique para remover</title>
                  <circle r={24} className="item-disc" />
                  <image href={toolIcon(tool)} x={-22} y={-26} width={44} height={50} />
                  {isWeapon(tool) ? (
                    <g transform="translate(0 34)">
                      <rect x={-20} y={-10} width={40} height={20} rx={10} className="weapon-pill" />
                      <text y={1} textAnchor="middle" dominantBaseline="middle" className="weapon-text">⚔{ITEMS[tool].value}</text>
                    </g>
                  ) : (
                    res && (
                      <>
                        <text y={-30} textAnchor="middle" className="heal-text">+{res.healed}</text>
                        <HeartBadge x={0} y={38} hp={res.hp} size={26} grey={r.afterDeath} />
                      </>
                    )
                  )}
                </g>
              )
            })}
          </g>
        )
      })}
      {g.stairsEdge && p.hiddenEdge !== 'stairs' && (() => {
        const cls = stairsTrail(plan, floorIdx)
        return cls ? <DistanceBadge e={g.stairsEdge} cls={cls} ghost={ghost?.kind === 'stairs'} /> : null
      })()}

      {/* início do andar */}
      <g className="start-node" onPointerDown={floor.steps.length === 0 ? p.onTailPointerDown : undefined}>
        <ellipse cx={START.x} cy={START.y + 52} rx={46} ry={12} fill="#000" opacity={0.35} />
        {floorIdx > 0 && <image href={STAIRS_ICON} x={START.x - 70} y={START.y + 6} width={50} height={50} opacity={0.9} />}
        <HeroSprite x={START.x - 55} y={START.y - 72} />
        <HeartBadge x={START.x + 52} y={START.y - 52} hp={fr.hpStart} />
      </g>

      {/* escada */}
      {floor.stairs && (
        <g
          className={`stairs-node ${ghost?.kind === 'stairs' ? 'ghost' : ''}`}
          transform={`translate(${floor.stairs.x} ${floor.stairs.y})`}
          onClick={p.onStairsClick}
        >
          <title>Escada: sobe para o andar {floorIdx + 2}. Clique para remover.</title>
          <circle r={STAIRS_R} className="stairs-disc" />
          <image href={STAIRS_ICON} x={-38} y={-40} width={76} height={76} />
          <text y={STAIRS_R + 18} textAnchor="middle" className="stairs-text">Andar {floorIdx + 2}</text>
        </g>
      )}

      {/* alça para arrastar a trilha a partir do fim */}
      {floor.steps.length > 0 && !ghost && (
        <g className="tail-handle" transform={`translate(${g.tail.x} ${g.tail.y})`} onPointerDown={p.onTailPointerDown}>
          <title>Arraste para conectar a próxima onda</title>
          <circle r={g.tailR + 2} className="tail-ring" />
        </g>
      )}
    </svg>
  )
}
