import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { DUNGEONS, GOLD_ICON, HERO, MONSTERS, dungeonById, type DungeonId } from '../game/data'
import LAYOUT from '../game/overworld-layout.json'
import { runStatus, type Run, type Save } from '../game/plan'
import { Gold, MonsterHeadBadge, SoundToggle, useFrame } from './ui'
import { Cap, Capsule } from './Capsule'

type PlaceId = DungeonId | 'shop'
const PLACES = LAYOUT.places as Record<PlaceId, { x: number; y: number; w: number; h: number; door: { x: number; y: number } }>
/** ordem de desenho (de trás para frente) */
const DRAW_ORDER: PlaceId[] = ['cripta', 'caverna', 'jardim', 'shop']
const TREES = LAYOUT.trees as { x: number; y: number; s: number }[]

/** Marcador de trilha salva: bandeirinha de pergaminho com um mapinho. */
function SavedTrailMarker({ transform }: { transform: string }) {
  return (
    <g transform={transform} className="saved-marker" pointerEvents="none">
      <g className="saved-body">
        <path d="M-68 -18 H68 L60 -2 L68 14 H-68 L-60 -2 Z" className="saved-ribbon" />
        <g transform="translate(-42 -2)">
          <path d="M-11 -8 l7 -3 l8 3 l7 -3 v15 l-7 3 l-8 -3 l-7 3z" className="saved-map" />
          <path d="M-4 -11 v15 M4 -8 v15" className="saved-fold" />
          <path d="M-8 3 q4 -8 8 -4 t7 -5" className="saved-route" />
        </g>
        <text x={12} y={0} textAnchor="middle" dominantBaseline="middle">Trilha salva</text>
      </g>
    </g>
  )
}

export function clock(ms: number) {
  const t = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const sec = String(t % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

interface Props {
  save: Save
  now: number
  hospitalUntil: number
  onPick: (d: DungeonId) => void
  onShop: () => void
  onCollection: () => void
  onOpenReport: (runId: string) => void
  onCancelQueued: (runId: string) => void
  onSkip: () => void
  onSkipHospital: () => void
  onDiscard: (d: DungeonId) => void
}

function Hero({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  const f = useFrame(HERO.frames.length)
  const w = 110 * scale
  return <image href={HERO.frames[f]} x={x - w / 2} y={y - w * 1.0} width={w} height={w * 1.155} />
}

export function MainMenu(p: Props) {
  const { save, now } = p
  const [hover, setHover] = useState<PlaceId | null>(null)
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const placeRefs = useRef<Partial<Record<PlaceId, SVGGElement | null>>>({})

  const runOf = (d: DungeonId) => save.runs.find((r) => r.dungeon === d)
  const running = save.runs.find((r) => runStatus(r, now) === 'running')

  const open = (id: PlaceId) => {
    clearTimeout(closeTimer.current)
    setHover(id)
    setAnchor(placeRefs.current[id]?.getBoundingClientRect() ?? null)
  }
  const scheduleClose = () => {
    clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setHover(null), 160)
  }
  useEffect(() => () => clearTimeout(closeTimer.current), [])

  const enter = (id: PlaceId) => {
    if (id === 'shop') return p.onShop()
    const run = runOf(id)
    if (run && runStatus(run, now) === 'done') return p.onOpenReport(run.id)
    if (!run) p.onPick(id)
  }

  // o Alberto vai para a porta da dungeon onde está a run
  const heroPos = running ? { x: PLACES[running.dungeon].door.x + 52, y: PLACES[running.dungeon].door.y + 14 } : LAYOUT.hero

  // cenário (lugares, árvores, Alberto) memorizado: o relógio de 1s só redesenha etiquetas e fila
  const enterRef = useRef(enter)
  useEffect(() => {
    enterRef.current = enter
  })
  const statusSig = DUNGEONS.map((d) => {
    const r = runOf(d.id)
    return r ? runStatus(r, now) : '-'
  }).join()
  const runningId = running?.dungeon ?? null
  const scene = useMemo(
    () => (
      <>
        {[
            ...DRAW_ORDER.map((id) => ({ kind: 'place' as const, id, base: PLACES[id].y + PLACES[id].h / 2 - 24 })),
            ...TREES.map((t, i) => ({ kind: 'tree' as const, i, base: t.y })),
            { kind: 'hero' as const, base: running ? PLACES[running.dungeon].y + PLACES[running.dungeon].h / 2 - 23 : heroPos.y + 12 },
          ]
            .sort((a, b) => a.base - b.base)
            .map((it) => {
              if (it.kind === 'tree') {
                const t = TREES[it.i]
                return (
                  <image
                    key={'t' + it.i}
                    href="/assets/generated/overworld/tree.svg"
                    x={t.x - 70 * t.s}
                    y={t.y - 130 * t.s}
                    width={140 * t.s}
                    height={150 * t.s}
                    pointerEvents="none"
                  />
                )
              }
              if (it.kind === 'hero')
                return (
                  <g key="hero" className="world-hero" pointerEvents="none">
                    <ellipse cx={heroPos.x} cy={heroPos.y + 12} rx={30} ry={8} fill="#000" opacity={0.2} />
                    <Hero x={heroPos.x} y={heroPos.y} scale={running ? 0.8 : 1} />
                  </g>
                )
              const id = it.id
              const pl = PLACES[id]
              const run = id !== 'shop' ? runOf(id) : undefined
              const st = run ? runStatus(run, now) : null
              return (
                <g
                  key={id}
                  ref={(el) => {
                    placeRefs.current[id] = el
                  }}
                  className={`place ${hover === id ? 'hot' : ''} ${st ? 'st-' + st : ''}`}
                  onPointerEnter={() => open(id)}
                  onPointerLeave={scheduleClose}
                  onClick={() => (hover === id ? enterRef.current(id) : open(id))}
                >
                  <image href={`/assets/generated/overworld/${id}.svg`} x={pl.x - pl.w / 2} y={pl.y - pl.h / 2} width={pl.w} height={pl.h} />
                </g>
              )
            })}
      </>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hover, statusSig, runningId],
  )

  return (
    <div className="menu">
      <TopBar {...p} />
      <div className="menu-body">
      <div className="world-wrap">
        <svg className="world" viewBox={`0 0 ${LAYOUT.scene.w} ${LAYOUT.scene.h}`} preserveAspectRatio="xMidYMax meet">
          <image href="/assets/generated/overworld/plain.svg" width={LAYOUT.scene.w} height={LAYOUT.scene.h} />
          {scene}
          {/* marcadores de estado no mundo */}
          {DUNGEONS.map((d) => {
            const pl = PLACES[d.id]
            const run = runOf(d.id)
            const st = run ? runStatus(run, now) : null
            const draft = !run && save.plans[d.id]?.floors.some((f) => f.steps.length)
            const top = `translate(${pl.x} ${pl.y - pl.h / 2 + 2})`
            if (draft) return <SavedTrailMarker key={d.id} transform={top} />
            if (!run || !st) return null
            return <WorldTag key={d.id} transform={top} run={run} st={st} now={now} pos={queuePos(save.runs, run.id, now)} />
          })}
          {p.hospitalUntil > 0 && (
            <g transform={`translate(${heroPos.x} ${heroPos.y - 118})`} className="world-tag hospital">
              <Capsule w={190} h={50} tone="hospital" className="cap-xl">
                <CrossIcon x={-62} />
                <text x={16} y={1} textAnchor="middle" dominantBaseline="middle">{clock(p.hospitalUntil - now)}</text>
              </Capsule>
            </g>
          )}
        </svg>

        {hover && anchor && (
          <PlaceCard
            key={hover}
            id={hover}
            anchor={anchor}
            save={save}
            now={now}
            onEnter={() => enter(hover)}
            onDiscard={p.onDiscard}
            onKeep={() => clearTimeout(closeTimer.current)}
            onLeave={scheduleClose}
          />
        )}
      </div>
      <QueueRail {...p} />
      </div>
    </div>
  )
}

// ---------------- etiqueta no mundo (acima da dungeon) ----------------

function queuePos(runs: Run[], id: string, now: number) {
  return runs.filter((r) => runStatus(r, now) === 'queued').findIndex((r) => r.id === id) + 1
}

function HourglassIcon({ x = 0, y = 0, s = 1 }: { x?: number; y?: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} className="ico-hourglass">
      <path d="M-7 -10h14M-7 10h14" className="ico-frame" />
      <path d="M-5.5 -10c0 6 5.5 6.5 5.5 10c0 3.5-5.5 4-5.5 10M5.5 -10c0 6-5.5 6.5-5.5 10c0 3.5 5.5 4 5.5 10" className="ico-glass" />
      <path d="M-3.5 -6.5h7l-3.5 4.5z" className="ico-sand top" />
      <path d="M-4 9.5c1-3.5 3-4.5 4-4.5s3 1 4 4.5z" className="ico-sand" />
      <path d="M0 -2v7" className="ico-stream" />
    </g>
  )
}

function CrossIcon({ x = 0, y = 0 }: { x?: number; y?: number }) {
  return <path transform={`translate(${x} ${y})`} d="M-3.5 -10h7v6.5h6.5v7h-6.5v6.5h-7v-6.5h-6.5v-7h6.5z" className="ico-cross" />
}

function WorldTag({ transform, run, st, now, pos }: { transform: string; run: Run; st: ReturnType<typeof runStatus>; now: number; pos: number }) {
  const W = 232
  const H = 54
  const pct = st === 'running' ? Math.min(1, (now - run.startAt) / (run.endAt - run.startAt)) : 0
  const tone = st === 'running' ? 'run' : st === 'queued' ? 'queue' : run.result.alive ? 'done' : 'bad'
  const iconX = -W / 2 + 40
  return (
    <g transform={transform} className={`world-tag ${st}`} pointerEvents="none">
      <g className="tag-body">
        {/* haste que liga a placa ao lugar */}
        <path d={`M0 ${H / 2 - 2} L-9 ${H / 2 + 12} H9 Z`} className={`tag-pin t-${tone}`} />
        <Capsule w={W} h={H} tone={tone} className="cap-xl">
          {st === 'running' && (
            <>
              <HourglassIcon x={iconX} s={1.35} />
              <text x={20} y={-4} textAnchor="middle" dominantBaseline="middle">{clock(run.endAt - now)}</text>
              <path d="M-38 15h116" className="tag-track" />
              <path d={`M-38 15h${Math.max(0.01, 116 * pct)}`} className="tag-fill" />
            </>
          )}
          {st === 'queued' && (
            <>
              <text x={iconX} y={2} textAnchor="middle" dominantBaseline="middle" className="tag-num">#{pos}</text>
              <text x={20} y={2} textAnchor="middle" dominantBaseline="middle">em {clock(run.startAt - now)}</text>
            </>
          )}
          {st === 'done' &&
            (run.result.alive ? (
              <>
                <image href={GOLD_ICON} x={iconX - 17} y={-18} width={34} height={39} />
                <text x={20} y={2} textAnchor="middle" dominantBaseline="middle">Coletar +{run.result.gold}</text>
              </>
            ) : (
              <>
                <text x={iconX} y={3} textAnchor="middle" dominantBaseline="middle" className="tag-skull">☠</text>
                <text x={20} y={2} textAnchor="middle" dominantBaseline="middle">Relatório</text>
              </>
            ))}
        </Capsule>
      </g>
    </g>
  )
}

// ---------------- card do lugar ----------------

function PlaceCard(p: {
  id: PlaceId
  anchor: DOMRect
  save: Save
  now: number
  onEnter: () => void
  onDiscard: (d: DungeonId) => void
  onKeep: () => void
  onLeave: () => void
}) {
  const { id, anchor, save, now } = p
  const [confirming, setConfirming] = useState(false)
  const W = 300
  const right = anchor.left + anchor.width / 2 < window.innerWidth / 2
  const left = right ? Math.min(anchor.right - anchor.width * 0.12, window.innerWidth - W - 16) : Math.max(16, anchor.left + anchor.width * 0.12 - W)
  const top = Math.max(76, Math.min(anchor.top + anchor.height * 0.15, window.innerHeight - 300))

  let body
  if (id === 'shop') {
    body = (
      <>
        <div className="pc-title">Barraca do mercador</div>
        <p className="pc-text">Poções e armas para a mochila. Volte sempre que o ouro apertar no bolso.</p>
        <div className="pc-actions">
          <button className="pc-cta" onClick={p.onEnter}>Abrir loja</button>
        </div>
      </>
    )
  } else {
    const d = dungeonById(id)
    const run = save.runs.find((r) => r.dungeon === id)
    const st = run ? runStatus(run, now) : null
    const draft = save.plans[id]
    const draftWaves = draft?.floors.reduce((n, f) => n + f.steps.length, 0) ?? 0
    const status = statusLine(run, st, now)
    body = (
      <>
        <div className="pc-title">{d.name}</div>
        <p className="pc-text">{d.blurb}</p>
        <div className="pc-monsters">
          {d.pool.map((m) => (
            <span key={m} className="pc-monster">
              <MonsterHeadBadge monster={m} size={34} />
              {MONSTERS[m].name}
            </span>
          ))}
        </div>
        {status && <p className="pc-status">{status}</p>}
        {st === 'running' && (
          <div className="pc-progress">
            <div style={{ width: `${((now - run!.startAt) / (run!.endAt - run!.startAt)) * 100}%` }} />
          </div>
        )}
        <div className="pc-actions">
          <button className="pc-cta" onClick={p.onEnter} disabled={st === 'running' || st === 'queued'}>
            {st === 'done' ? 'Ver relatório' : st ? 'Trancada até acabar' : draftWaves ? 'Continuar trilha' : 'Entrar'}
          </button>
          {!run && draftWaves > 0 && !confirming && (
            <button className="pc-link" data-sfx="back" onClick={() => setConfirming(true)}>
              descartar trilha
            </button>
          )}
        </div>
        {confirming && (
          <div className="pc-confirm">
            <span className="pc-confirm-text">Apagar a trilha salva desta dungeon?</span>
            <div className="pc-confirm-actions">
              <button className="pc-soft-danger" data-sfx="back" onClick={() => p.onDiscard(id)}>
                Descartar
              </button>
              <button className="pc-link" onClick={() => setConfirming(false)}>
                manter
              </button>
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <div className={`place-card ${right ? 'from-left' : 'from-right'}`} style={{ left, top, width: W }} onPointerEnter={p.onKeep} onPointerLeave={p.onLeave}>
      {body}
    </div>
  )
}

function statusLine(run: Run | undefined, st: ReturnType<typeof runStatus> | null, now: number) {
  if (run && st === 'running') return `O ${HERO.name} está lá dentro — volta em ${clock(run.endAt - now)}.`
  if (run && st === 'queued') return `Na fila: começa em ${clock(run.startAt - now)}.`
  if (run && st === 'done') return run.result.alive ? `Run concluída: ${run.result.gold} de ouro esperando.` : `O ${HERO.name} caiu lá dentro.`
  return null
}

// ---------------- barra superior ----------------

function TopBar(p: Props) {
  return (
    <header className="topbar">
      <div className="logo">DungeonBend <span>Adventure</span></div>
      <div className="topbar-right">
        <Cap tone="gold" className="big" title="Seu ouro">
          <Gold value={p.save.gold} size={22} />
        </Cap>
        <button className="top-btn" onClick={p.onCollection}>Coleção</button>
        <SoundToggle />
      </div>
    </header>
  )
}

// ---------------- fila (barra lateral fixa) ----------------

function QueueRail(p: Props) {
  const { save, now } = p
  const hospital = p.hospitalUntil > now
  return (
    <aside className="queue-rail">
      <div className="qr-head">
        <span className="qr-title">Fila</span>
        <span className="qr-sub">uma run de cada vez</span>
      </div>
      {hospital && (
        <div className="qr-hospital">
          <Cap tone="hospital">✚ {clock(p.hospitalUntil - now)}</Cap>
          <span>{HERO.name} no hospital. A fila espera a alta.</span>
          <button className="link-btn" onClick={p.onSkipHospital} title="Atalho de playtest">⏩ dar alta</button>
        </div>
      )}
      {save.runs.length === 0 ? (
        <p className="qr-empty">Nenhuma run em andamento. Planeje uma trilha numa dungeon e ela aparece aqui.</p>
      ) : (
        <ol className="qr-list">
          {save.runs.map((r) => {
            const st = runStatus(r, now)
            const d = DUNGEONS.find((x) => x.id === r.dungeon)!
            const inHospital = st === 'done' && (r.hospitalUntil ?? 0) > now
            const pct = st === 'running' ? Math.min(1, (now - r.startAt) / (r.endAt - r.startAt)) : st === 'done' ? 1 : 0
            return (
              <li key={r.id} className={`qr-item st-${st}`}>
                <span className="qr-node" style={{ borderColor: d.accent }} />
                <div className="qr-card" style={{ '--acc': d.accent } as CSSProperties}>
                  <img className="qr-thumb" src={`/assets/generated/overworld/${d.id}.svg`} alt="" />
                  <div className="qr-main">
                    <div className="qr-name">{d.name}</div>
                    {st === 'running' && (
                      <div className="qr-row">
                        <Cap tone="run" className="small">⏳ {clock(r.endAt - now)}</Cap>
                        <button className="link-btn" onClick={p.onSkip} title="Atalho de playtest">⏩</button>
                      </div>
                    )}
                    {st === 'queued' && (
                      <div className="qr-row">
                        <Cap tone="queue" className="small">em {clock(r.startAt - now)}</Cap>
                        <button className="link-btn" data-sfx="back" onClick={() => p.onCancelQueued(r.id)} title="Tirar da fila">✕</button>
                      </div>
                    )}
                    {st === 'done' && (
                      <button className="qr-collect" onClick={() => p.onOpenReport(r.id)}>
                        {r.result.alive ? <>Coletar <Gold value={`+${r.result.gold}`} size={16} /></> : '☠ Ver relatório'}
                      </button>
                    )}
                  </div>
                  {st !== 'queued' && (
                    <div className="qr-bar">
                      <div style={{ width: `${pct * 100}%` }} />
                    </div>
                  )}
                </div>
                {r.hospitalUntil && (st !== 'done' || inHospital) && (
                  <div className="qr-hosp">✚ {inHospital ? clock((r.hospitalUntil ?? 0) - now) : 'depois: hospital'}</div>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </aside>
  )
}
