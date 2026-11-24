import { useEffect, useRef, useState } from 'react'
import { DUNGEONS, HERO, MONSTERS, dungeonById, type DungeonId } from '../game/data'
import LAYOUT from '../game/overworld-layout.json'
import { runStatus, type Run, type Save } from '../game/plan'
import { Gold, HeartIcon, MonsterHeadBadge, SoundToggle, useFrame } from './ui'

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

  return (
    <div className="menu">
      <TopBar {...p} />
      <div className="world-wrap">
        <svg className="world" viewBox={`0 0 ${LAYOUT.scene.w} ${LAYOUT.scene.h}`} preserveAspectRatio="xMidYMid slice">
          <image href="/assets/generated/overworld/plain.svg" width={LAYOUT.scene.w} height={LAYOUT.scene.h} />
          {/* cena por profundidade: quem tem a base mais baixa fica na frente (árvores × barraca × Alberto) */}
          {[
            ...DRAW_ORDER.map((id) => ({ kind: 'place' as const, id, base: PLACES[id].y + PLACES[id].h / 2 - 24 })),
            ...TREES.map((t, i) => ({ kind: 'tree' as const, i, base: t.y })),
            { kind: 'hero' as const, base: heroPos.y + 12 },
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
                  onClick={() => (hover === id ? enter(id) : open(id))}
                >
                  <image href={`/assets/generated/overworld/${id}.svg`} x={pl.x - pl.w / 2} y={pl.y - pl.h / 2} width={pl.w} height={pl.h} />
                </g>
              )
            })}
          {/* marcadores de estado no mundo */}
          {DUNGEONS.map((d) => {
            const pl = PLACES[d.id]
            const run = runOf(d.id)
            const st = run ? runStatus(run, now) : null
            const draft = !run && save.plans[d.id]?.floors.some((f) => f.steps.length)
            const top = `translate(${pl.x} ${pl.y - pl.h / 2 + 6})`
            if (draft) return <SavedTrailMarker key={d.id} transform={top} />
            if (!run || !st) return null
            const label = st === 'running' ? `⚔ ${clock(run.endAt - now)}` : st === 'queued' ? `na fila · ${clock(run.startAt - now)}` : run.result.alive ? '✓ Coletar' : '☠ Relatório'
            const pct = st === 'running' ? (now - run.startAt) / (run.endAt - run.startAt) : 0
            return (
              <g key={d.id} transform={top} className={`world-tag ${st}`} pointerEvents="none">
                <g className="tag-body">
                  <rect x={-70} y={-20} width={140} height={34} rx={17} />
                  <text y={2} textAnchor="middle" dominantBaseline="middle">{label}</text>
                  {st === 'running' && (
                    <>
                      <rect x={-56} y={8} width={112} height={4} rx={2} className="tag-track" />
                      <rect x={-56} y={8} width={112 * pct} height={4} rx={2} className="tag-fill" />
                    </>
                  )}
                </g>
              </g>
            )
          })}
          {p.hospitalUntil > 0 && (
            <g transform={`translate(${heroPos.x} ${heroPos.y - 120})`} className="world-tag hospital" pointerEvents="none">
              <rect x={-62} y={-18} width={124} height={32} rx={16} />
              <text y={2} textAnchor="middle" dominantBaseline="middle">🏥 {clock(p.hospitalUntil - now)}</text>
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
        {p.hospitalUntil > 0 && (
          <div className="hospital-note">
            🏥 {HERO.name} está no hospital — runs na fila começam depois da alta.
            <button className="link-btn" onClick={p.onSkipHospital} title="Atalho de playtest">⏩ dar alta</button>
          </div>
        )}
      </div>
    </div>
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
  const { save, now } = p
  const [openQ, setOpenQ] = useState(false)
  const running = save.runs.find((r) => runStatus(r, now) === 'running')
  const done = save.runs.filter((r) => runStatus(r, now) === 'done').length
  return (
    <header className="topbar">
      <div className="logo">DungeonBend <span>Adventure</span></div>
      <div className="topbar-right">
        {save.runs.length > 0 && (
          <div className="queue-menu">
            <button className={`top-btn ${done ? 'alert' : ''}`} data-sfx="none" onClick={() => setOpenQ((v) => !v)}>
              Fila <b>{save.runs.length}</b>
              {running && <span className="top-timer">⏳ {clock(running.endAt - now)}</span>}
              {done > 0 && <span className="top-done">{done} pronta{done > 1 ? 's' : ''}</span>}
            </button>
            {openQ && <QueueCascade {...p} onClose={() => setOpenQ(false)} />}
          </div>
        )}
        <span className="top-gold"><Gold value={save.gold} size={22} /></span>
        <button className="top-btn" onClick={p.onCollection}>Coleção</button>
        <SoundToggle />
      </div>
    </header>
  )
}

function QueueCascade(p: Props & { onClose: () => void }) {
  const { save, now } = p
  return (
    <div className="queue-drop" onPointerLeave={p.onClose}>
      <ol className="cascade">
        {save.runs.map((r, i) => {
          const st = runStatus(r, now)
          const d = DUNGEONS.find((x) => x.id === r.dungeon)!
          const inHospital = st === 'done' && (r.hospitalUntil ?? 0) > now
          return (
            <li key={r.id} className="cascade-step" style={{ marginLeft: Math.min(i, 4) * 12 }}>
              <div className={`qcard st-${st}`} style={{ borderLeftColor: d.accent }}>
                <div className="qc-top">
                  <span className="qi-name" style={{ color: d.accent }}>{d.name}</span>
                  <span className="qc-info">{r.result.alive ? <Gold value={r.result.gold} size={14} /> : <span className="bad">☠</span>}</span>
                </div>
                {st === 'running' && (
                  <div className="qc-row">
                    <span className="qi-state">⏳ {clock(r.endAt - now)}</span>
                    <button className="link-btn" onClick={p.onSkip} title="Atalho de playtest">⏩</button>
                  </div>
                )}
                {st === 'queued' && (
                  <div className="qc-row">
                    <span className="muted">em {clock(r.startAt - now)}</span>
                    <button className="link-btn" data-sfx="back" onClick={() => p.onCancelQueued(r.id)} title="Tirar da fila">✕</button>
                  </div>
                )}
                {st === 'done' && (
                  <button className="btn primary small-btn qc-collect" onClick={() => p.onOpenReport(r.id)}>Coletar</button>
                )}
              </div>
              {r.hospitalUntil && (st !== 'done' || inHospital) && (
                <div className={`qcard hospital-step ${inHospital ? 'st-running' : ''}`}>
                  🏥 {inHospital ? clock((r.hospitalUntil ?? 0) - now) : 'hospital 2h'}
                </div>
              )}
            </li>
          )
        })}
      </ol>
      <div className="queue-foot"><HeartIcon size={12} /> As runs acontecem uma de cada vez.</div>
    </div>
  )
}
