import type { PointerEvent as RPointerEvent, RefObject } from 'react'
import { HERO, ITEMS, STAIRS_ICON, dungeonById, isWeapon, toolIcon } from '../game/data'
import { clusterLayout, edgeGeom, ICON_R, type EdgeGeom, type Pt } from '../game/geometry'
import { floorMap, MAP_H, MAP_W, START, type Wave } from '../game/mapgen'
import { waveById, waveHp, type Plan, type SimResult } from '../game/plan'
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

function Trail({ d, ghost, highlight, dead }: { d: string; ghost?: boolean; highlight?: boolean; dead?: boolean }) {
  return (
    <g className={ghost ? 'trail ghost' : 'trail'} pointerEvents="none">
      <path d={d} className="trail-bed" style={highlight ? { stroke: 'rgba(255, 214, 120, .55)', strokeWidth: 34 } : undefined} />
      <path d={d} className="trail-edge" />
      <path d={d} className={dead ? 'trail-dash dead' : 'trail-dash'} />
    </g>
  )
}

function Arrow({ e, ghost }: { e: EdgeGeom; ghost?: boolean }) {
  const p = e.samples[e.samples.length - 1]
  const deg = (e.endAngle * 180) / Math.PI
  return (
    <path
      d="M-14 -10L2 0L-14 10"
      transform={`translate(${p.x} ${p.y}) rotate(${deg})`}
      className="trail-arrow"
      opacity={ghost ? 0.6 : 1}
      pointerEvents="none"
    />
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
          <Trail key={'e' + i} d={e.d} ghost={i === ghostWaveStep} highlight={p.dropStep === i} dead={fr.steps[i]?.afterDeath} />
        ),
      )}
      {g.stairsEdge && p.hiddenEdge !== 'stairs' && <Trail d={g.stairsEdge.d} ghost={ghost?.kind === 'stairs'} />}
      {g.edges.map((e, i) => (p.hiddenEdge === i ? null : <Arrow key={'a' + i} e={e} ghost={i === ghostWaveStep} />))}
      {p.guides.map(([a, b], i) => (
        <line key={'g' + i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="link-line" pointerEvents="none" />
      ))}
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
            className={`wave ${inPath && !isGhost ? 'in-path' : ''} ${hovered ? 'hovered' : ''}`}
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
            {r?.dead && !r.afterDeath && (
              <text x={w.x} y={w.y - radius - 14} textAnchor="middle" className="death-text" pointerEvents="none">
                ☠ morre aqui
              </text>
            )}
          </g>
        )
      })}

      {/* itens nas trilhas */}
      {floor.steps.map((s, si) =>
        s.items.map((tool, ii) => {
          const e = g.edges[si]
          const n = s.items.length
          const t = e.t0 + (e.t1 - e.t0) * (0.22 + (0.56 * (ii + 1)) / (n + 1))
          const pt = e.at(t)
          const res = fr.steps[si]?.items[ii]
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
                    <HeartBadge x={0} y={38} hp={res.hp} size={26} grey={fr.steps[si].afterDeath} />
                  </>
                )
              )}
            </g>
          )
        }),
      )}

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
