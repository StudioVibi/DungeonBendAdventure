import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react'
import {
  CAMPFIRE_ICON,
  ITEMS,
  STAIRS_ICON,
  dungeonById,
  isPotion,
  type ToolId,
} from '../game/data'
import { clusterLayout, distToPolyline, type Pt } from '../game/geometry'
import { MAP_H, MAP_W, START } from '../game/mapgen'
import {
  addItem,
  appendWave,
  availability,
  removeItem,
  removeStairs,
  replaceWave,
  edgeAccepts,
  edgeItemsOf,
  edgeTrail,
  edgeFrom,
  edgeRule,
  fitEdges,
  reachable,
  setStairs,
  simulate,
  truncateAfter,
  type Plan,
  type Save,
} from '../game/plan'
import { MapView, floorGeometry, type Ghost } from './MapView'
import { SoundToggle } from './ui'
import { HeroState, Hourglass, LifeFlask } from './Gauges'
import { FxCanvas } from './TrailFx'
import { Cap } from './Capsule'

type DragTool = ToolId | 'stairs'

interface Props {
  save: Save
  plan: Plan
  floorIdx: number
  setFloorIdx: (i: number) => void
  commit: (plan: Plan) => void
  undo: () => void
  canUndo: boolean
  /** já existe run em andamento: esta entraria na fila */
  queued: boolean
  onShop: () => void
  onCollection: () => void
  onLeave: () => void
  onFinish: () => void
}

/** Memorizado: o relógio de 1s do App não redesenha o mapa quando nada mudou. */
export const DungeonScreen = memo(function DungeonScreen(props: Props) {
  const { plan, floorIdx, commit, setFloorIdx, undo } = props
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [drag, setDrag] = useState<{ tool: DragTool; cx: number; cy: number } | null>(null)
  const [hoverWaveId, setHoverWaveId] = useState<string | null>(null)
  const [linking, setLinking] = useState(false)
  const [linkPointer, setLinkPointer] = useState<Pt | null>(null)
  /** arrastando um trecho de trilha para trocar a onda de destino (ou mover a escada) */
  const [edgeDrag, setEdgeDrag] = useState<{ edge: number | 'stairs'; start: Pt; pointer: Pt; moved: boolean } | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const hintTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const flashHint = (msg: string) => {
    setHint(msg)
    clearTimeout(hintTimer.current)
    hintTimer.current = setTimeout(() => setHint(null), 2200)
  }
  /** depois de soltar um item, o hover não mostra prévia até o ponteiro sair da onda (senão parece que a trilha foi criada) */
  const hoverLock = useRef(false)
  const onHoverWave = useCallback((id: string | null) => {
    if (id === null) hoverLock.current = false
    else if (hoverLock.current) return
    setHoverWaveId(id)
  }, [])
  const planRef = useRef(plan)
  planRef.current = plan

  const floor = plan.floors[floorIdx]
  /** ponto de onde sai a próxima trilha (fim do caminho deste andar) */
  const tailPt = edgeFrom(plan, floorIdx, floor.steps.length)
  const FAR_HINT = 'Longe demais: só dá para conectar até a distância 5.'
  const dungeon = dungeonById(plan.dungeon)
  const sim = useMemo(() => simulate(plan), [plan])

  const toSvg = useCallback((cx: number, cy: number): Pt | null => {
    const svg = svgRef.current
    if (!svg) return null
    const m = svg.getScreenCTM()
    if (!m) return null
    const p = new DOMPoint(cx, cy).matrixTransform(m.inverse())
    return { x: p.x, y: p.y }
  }, [])

  // ---- alvo de soltura do item arrastado ----
  const dropTarget = useMemo(() => {
    if (!drag) return null
    const p = toSvg(drag.cx, drag.cy)
    if (!p || p.x < 0 || p.y < 0 || p.x > MAP_W || p.y > MAP_H) return null
    if (drag.tool === 'stairs') {
      const pos = { x: Math.round(p.x), y: Math.round(p.y) }
      return { kind: 'stairs' as const, pos, ok: reachable(tailPt, pos), reason: FAR_HINT }
    }
    const g = floorGeometry(plan, floorIdx)
    let best = -1
    let bestD = 80
    g.edges.forEach((e, i) => {
      const w = g.waves.find((wv) => wv.id === floor.steps[i].waveId)!
      const dWave = Math.max(0, Math.hypot(p.x - w.x, p.y - w.y) - clusterLayout(w).radius)
      const d = Math.min(distToPolyline(p, e.samples), dWave)
      if (d < bestD) {
        bestD = d
        best = i
      }
    })
    // trilha da escada também recebe itens (trecho de índice steps.length)
    if (g.stairsEdge && floor.stairs) {
      const dStairs = Math.max(0, Math.hypot(p.x - floor.stairs.x, p.y - floor.stairs.y) - 44)
      const d = Math.min(distToPolyline(p, g.stairsEdge.samples), dStairs)
      if (d < bestD) {
        bestD = d
        best = floor.steps.length
      }
    }
    if (best < 0) return null
    const cls = edgeTrail(plan, floorIdx, best)
    const ok = edgeAccepts(edgeItemsOf(floor, best), drag.tool, cls)
    return { kind: 'edge' as const, stepIdx: best, ok, reason: edgeRule(cls) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, plan, floorIdx, floor.steps, toSvg])

  // ---- prévia (plano hipotético para feedback instantâneo) ----
  /** onda candidata sob o ponteiro ao arrastar um trecho */
  const edgeCandidate = useMemo(() => {
    if (!edgeDrag?.moved || edgeDrag.edge === 'stairs') return null
    const p = edgeDrag.pointer
    const i = edgeDrag.edge
    const prev = edgeFrom(plan, floorIdx, i)
    const nextStep = floor.steps[i + 1]
    const next = nextStep ? floorGeometry(plan, floorIdx).waves.find((w) => w.id === nextStep.waveId)! : floor.stairs
    const w = floorGeometry(plan, floorIdx).waves.find(
      (wv) =>
        !floor.steps.some((s) => s.waveId === wv.id) &&
        Math.hypot(p.x - wv.x, p.y - wv.y) < clusterLayout(wv).radius + 6 &&
        reachable(prev, wv) &&
        (!next || reachable(wv, next)),
    )
    return w?.id ?? null
  }, [edgeDrag, plan, floorIdx, floor.steps])

  const hoverFree = hoverWaveId && !linking && !drag && !edgeDrag && !floor.steps.some((s) => s.waveId === hoverWaveId) ? hoverWaveId : null
  const hoverWave = hoverFree ? floorGeometry(plan, floorIdx).waves.find((w) => w.id === hoverFree) : undefined
  const hoverAppendable = hoverWave && reachable(tailPt, hoverWave) ? hoverWave.id : null
  const tooFarWaveId = hoverWave && !hoverAppendable ? hoverWave.id : null
  const preview = useMemo((): { plan: Plan; ghost: Ghost; removed?: number } | null => {
    if (edgeDrag?.moved) {
      if (edgeDrag.edge === 'stairs') {
        const pos = { x: Math.round(edgeDrag.pointer.x), y: Math.round(edgeDrag.pointer.y) }
        if (!reachable(tailPt, pos)) return null
        return { plan: setStairs(plan, floorIdx, pos), ghost: { kind: 'stairs' } }
      }
      if (edgeCandidate) {
        // a troca pode mudar a distância das trilhas: itens que não cabem mais saem
        const fitted = fitEdges(replaceWave(plan, floorIdx, edgeDrag.edge, edgeCandidate))
        return { plan: fitted.plan, ghost: { kind: 'wave', stepIdx: edgeDrag.edge }, removed: fitted.removed }
      }
      return null
    }
    if (dropTarget?.kind === 'edge' && dropTarget.ok && drag && drag.tool !== 'stairs') {
      const p2 = addItem(plan, floorIdx, dropTarget.stepIdx, drag.tool)
      return { plan: p2, ghost: { kind: 'item', stepIdx: dropTarget.stepIdx, itemIdx: edgeItemsOf(p2.floors[floorIdx], dropTarget.stepIdx).length - 1 } }
    }
    if (dropTarget?.kind === 'stairs' && dropTarget.ok) return { plan: setStairs(plan, floorIdx, dropTarget.pos), ghost: { kind: 'stairs' } }
    if (hoverAppendable) return { plan: appendWave(plan, floorIdx, hoverAppendable), ghost: { kind: 'wave', stepIdx: floor.steps.length } }
    return null
  }, [edgeDrag, edgeCandidate, dropTarget, drag, plan, floorIdx, hoverAppendable, floor.steps.length, tailPt])
  const previewSim = useMemo(() => (preview ? simulate(preview.plan) : null), [preview])
  const shown = previewSim ?? sim

  // ---- arrastar itens da mochila ----
  const dropRef = useRef<typeof dropTarget>(null)
  dropRef.current = dropTarget
  const dragging = drag !== null
  const dragTool = drag?.tool
  useEffect(() => {
    if (!dragging || !dragTool) return
    const move = (e: PointerEvent) => setDrag((d) => (d ? { ...d, cx: e.clientX, cy: e.clientY } : d))
    const up = (e: PointerEvent) => {
      const t = dropRef.current
      const cur = planRef.current
      if (t && !t.ok) flashHint(t.reason)
      else if (t?.kind === 'edge' && dragTool !== 'stairs') commit(addItem(cur, floorIdx, t.stepIdx, dragTool))
      else if (t?.kind === 'stairs') {
        // não troca de andar sozinho: o jogador sobe clicando na escada ou na aba
        commit(setStairs(cur, floorIdx, t.pos))
      }
      setDrag(null)
      // só trava se o item foi solto em cima de uma onda
      if (document.elementFromPoint(e.clientX, e.clientY)?.closest('.wave')) {
        hoverLock.current = true
        setHoverWaveId(null)
      }
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setDrag(null)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('keydown', key)
    }
  }, [dragging, dragTool, commit, floorIdx, setFloorIdx])

  // ---- arrastar a trilha (conectar várias ondas em sequência) ----
  const onTailPointerDown = (e: RPointerEvent) => {
    e.preventDefault()
    svgRef.current?.setPointerCapture(e.pointerId)
    setLinking(true)
    setLinkPointer(toSvg(e.clientX, e.clientY))
  }
  const onEdgePointerDown = (e: RPointerEvent, edge: number | 'stairs') => {
    e.preventDefault()
    e.stopPropagation()
    const p = toSvg(e.clientX, e.clientY)
    if (!p) return
    svgRef.current?.setPointerCapture(e.pointerId)
    setHoverWaveId(null)
    setEdgeDrag({ edge, start: p, pointer: p, moved: false })
  }

  const onSvgPointerMove = (e: RPointerEvent) => {
    if (edgeDrag) {
      const p = toSvg(e.clientX, e.clientY)
      if (!p) return
      const moved = edgeDrag.moved || Math.hypot(p.x - edgeDrag.start.x, p.y - edgeDrag.start.y) > 10
      setEdgeDrag({ ...edgeDrag, pointer: p, moved })
      return
    }
    if (!linking) return
    const p = toSvg(e.clientX, e.clientY)
    if (!p) return
    setLinkPointer(p)
    const cur = planRef.current
    const f = cur.floors[floorIdx]
    const g = floorGeometry(cur, floorIdx)
    const from = edgeFrom(cur, floorIdx, f.steps.length)
    const hit = g.waves.find(
      (w) => !f.steps.some((s) => s.waveId === w.id) && Math.hypot(p.x - w.x, p.y - w.y) < clusterLayout(w).radius && reachable(from, w),
    )
    if (hit) {
      const next = appendWave(cur, floorIdx, hit.id)
      planRef.current = next
      commit(next)
    }
  }
  const onSvgPointerUp = (e: RPointerEvent) => {
    if (edgeDrag) {
      svgRef.current?.releasePointerCapture(e.pointerId)
      const { edge, moved } = edgeDrag
      setEdgeDrag(null)
      if (!moved) {
        // clique: só apaga se for a última trilha do andar
        if (edge === 'stairs') commit(removeStairs(plan, floorIdx))
        else if (edge === floor.steps.length - 1 && !floor.stairs) commit(truncateAfter(plan, floorIdx, edge - 1))
        else flashHint('Só a última trilha do andar pode ser apagada. Arraste uma trilha para trocar a onda.')
        return
      }
      if (preview) {
        commit(preview.plan)
        if (preview.removed) flashHint(`A distância mudou: ${preview.removed} ${preview.removed === 1 ? 'item saiu' : 'itens saíram'} da trilha.`)
      } else if (edge === 'stairs') flashHint(FAR_HINT)
      return
    }
    if (!linking) return
    svgRef.current?.releasePointerCapture(e.pointerId)
    setLinking(false)
    setLinkPointer(null)
  }

  const onWaveClick = (waveId: string) => {
    const idx = floor.steps.findIndex((s) => s.waveId === waveId)
    if (idx < 0) {
      const w = floorGeometry(plan, floorIdx).waves.find((x) => x.id === waveId)!
      if (reachable(tailPt, w)) commit(appendWave(plan, floorIdx, waveId))
      else flashHint(FAR_HINT)
    }
    else if (idx < floor.steps.length - 1) commit(truncateAfter(plan, floorIdx, idx))
    setHoverWaveId(null)
  }

  // ---- teclado ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undo()
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        const f = planRef.current.floors[floorIdx]
        if (f.steps.length) commit(truncateAfter(planRef.current, floorIdx, f.steps.length - 2))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, floorIdx, commit])

  const guides = useMemo((): [Pt, Pt][] => {
    if (linking && linkPointer) return [[floorGeometry(plan, floorIdx).tail, linkPointer]]
    if (!edgeDrag?.moved || preview) return []
    const g = floorGeometry(plan, floorIdx)
    const wavePt = (i: number) => g.waves.find((w) => w.id === floor.steps[i].waveId)!
    const e = edgeDrag.edge === 'stairs' ? floor.steps.length : edgeDrag.edge
    const prev = e === 0 ? START : wavePt(e - 1)
    const next = e + 1 < floor.steps.length ? wavePt(e + 1) : edgeDrag.edge !== 'stairs' && floor.stairs ? floor.stairs : null
    return next ? [[prev, edgeDrag.pointer], [edgeDrag.pointer, next]] : [[prev, edgeDrag.pointer]]
  }, [linking, linkPointer, edgeDrag, preview, plan, floorIdx, floor])
  const hiddenEdge = edgeDrag?.moved && !preview ? edgeDrag.edge : null

  const totalSteps = plan.floors.reduce((s, f) => s + f.steps.length, 0)
  const startDrag = (tool: DragTool) => (e: RPointerEvent) => {
    e.preventDefault()
    setDrag({ tool, cx: e.clientX, cy: e.clientY })
  }

  const showPrev = !!previewSim
  return (
    <div className="dungeon-screen">
      <TopBar {...props} dungeonName={dungeon.name} />

      <div className="map-area">
        <div className={`map-frame ${drag ? 'dragging' : ''} ${linking || edgeDrag?.moved ? 'linking' : ''}`}>
          {hint && <div className="map-hint flash">{hint}</div>}
          <FxCanvas />
          <MapView
            plan={preview?.plan ?? plan}
            sim={shown}
            floorIdx={floorIdx}
            ghost={preview?.ghost ?? null}
            dropStep={dropTarget?.kind === 'edge' ? dropTarget.stepIdx : null}
            dropBlocked={!!dropTarget && !dropTarget.ok}
            tooFarWaveId={tooFarWaveId}
            tailPt={tailPt}
            svgRef={svgRef}
            hoverWaveId={hoverWaveId}
            guides={guides}
            hiddenEdge={hiddenEdge}
            onEdgePointerDown={onEdgePointerDown}
            onHoverWave={onHoverWave}
            onWaveClick={onWaveClick}
            onItemClick={(si, ii) => commit(removeItem(plan, floorIdx, si, ii))}
            onStairsClick={() => floorIdx + 1 < plan.floors.length && setFloorIdx(floorIdx + 1)}
            onTailPointerDown={onTailPointerDown}
            onSvgPointerMove={onSvgPointerMove}
            onSvgPointerUp={onSvgPointerUp}
            canRest={availability(props.save, plan, floorIdx, 'campfire').left > 0}
            onRestSocket={(si) => {
              const ok = edgeAccepts(edgeItemsOf(floor, si), 'campfire', edgeTrail(plan, floorIdx, si))
              if (ok) commit(addItem(plan, floorIdx, si, 'campfire'))
              else flashHint(edgeRule(edgeTrail(plan, floorIdx, si)))
            }}
            hud={
              <>
                <LifeFlask hp={sim.hpEnd} preview={showPrev ? shown.hpEnd : null} />
                <Hourglass time={sim.totalTime} preview={showPrev ? shown.totalTime : null} />
                <HeroState x={START.x - 100} y={START.y + 80} sim={sim} shown={shown} preview={showPrev} empty={!totalSteps} />
              </>
            }
          />
          {floor.steps.length === 0 && !drag && (
            <div className="map-hint">
              {floorIdx === 0
                ? 'Clique numa onda (ou arraste a partir do Alberto) para traçar a trilha.'
                : `Andar ${floorIdx + 1}: monstros com +${floorIdx} nível. Continue a trilha!`}
            </div>
          )}
          {drag && drag.tool !== 'stairs' && floor.steps.length === 0 && <div className="map-hint">Conecte uma onda primeiro para colocar itens na trilha.</div>}

          {/* andares: divisórias de caderno saindo da borda do mapa */}
          <nav className="floor-tabs">
            {plan.floors.map((f, i) => {
              const fr = sim.floors[i]
              const dead = !!sim.death && sim.death.floor <= i
              const closable = i > 0 && i === plan.floors.length - 1
              return (
                <button
                  key={i}
                  className={`tab ${i === floorIdx ? 'active' : ''} ${dead ? 'dead' : ''}`}
                  style={{ '--tab': TAB_COLORS[i % TAB_COLORS.length] } as CSSProperties}
                  onClick={() => props.setFloorIdx(i)}
                  title={`Andar ${i + 1} · nível ${i + 1} · ${f.steps.length} ${f.steps.length === 1 ? 'onda' : 'ondas'}`}
                >
                  <span className="tab-num">{i + 1}</span>
                  <span className="tab-hp">{dead ? '☠' : fr.hpEnd}</span>
                  {closable && (
                    <span
                      className="tab-close"
                      data-sfx="back"
                      title="Fechar este andar (remove a escada do andar anterior)"
                      onClick={(e) => {
                        e.stopPropagation()
                        commit(removeStairs(plan, i - 1))
                        if (floorIdx >= i) props.setFloorIdx(i - 1)
                      }}
                    >
                      ×
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      <Bag {...props} onStart={startDrag} dragging={drag?.tool ?? null} stairsUsed={!!floor.stairs} totalSteps={totalSteps} />

      {drag && (
        <img
          className={`drag-ghost ${drag.tool === 'stairs' || drag.tool === 'campfire' ? '' : 'item-art'}`}
          src={drag.tool === 'stairs' ? STAIRS_ICON : drag.tool === 'campfire' ? CAMPFIRE_ICON : ITEMS[drag.tool].icon}
          style={{ left: drag.cx, top: drag.cy }}
          alt=""
        />
      )}
    </div>
  )
})

/** cores das divisórias (como as de um caderno) */
const TAB_COLORS = ['#e0614f', '#f0b44f', '#7cc06a', '#5fa8d8', '#a57fd8']

// ---------------- topo: só navegação e ajustes ----------------

function TopBar(p: Props & { dungeonName: string }) {
  return (
    <header className="dungeon-top">
      <button className="btn ghost" data-sfx="back" onClick={p.onLeave}>← Dungeons</button>
      <div className="hud-title">{p.dungeonName}</div>
      <div className="dt-spacer" />
      <button className="btn ghost" onClick={p.onCollection}>Coleção</button>
      <button className="btn ghost" onClick={p.onShop}>Loja</button>
      <SoundToggle />
    </header>
  )
}

// ---------------- Mochila ----------------

function Bag(p: Props & { onStart: (t: DragTool) => (e: RPointerEvent) => void; dragging: DragTool | null; stairsUsed: boolean; totalSteps: number }) {
  const { save, plan, floorIdx } = p
  // para cada slot, decide se ele já foi "gasto" neste andar
  const seen: Partial<Record<ToolId, number>> = {}
  const slot = (tool: ToolId | null, key: string) => {
    if (!tool) return <div key={key} className="slot empty" title="Slot vazio — equipe na Loja">vazio</div>
    const a = availability(save, plan, floorIdx, tool)
    const k = (seen[tool] = (seen[tool] ?? 0) + 1)
    const usedHere = k <= a.usedOnFloor
    const disabled = usedHere
    const it = ITEMS[tool as keyof typeof ITEMS]
    return (
      <div
        key={key}
        className={`slot ${disabled ? 'used' : ''} ${p.dragging === tool ? 'lifted' : ''}`}
        onPointerDown={disabled ? undefined : p.onStart(tool)}
        title={`${it.name} — ${usedHere ? 'já usado neste andar (renova no próximo)' : 'arraste para a trilha'}`}
      >
        <img className="item-art" src={it.icon} alt="" draggable={false} />
        <span className={`slot-val ${isPotion(tool) ? 'heal' : 'dmg'}`}>{isPotion(tool) ? `+${it.value}` : `${it.value}`}</span>
        {usedHere && <Cap tone="neutral" className="small slot-flag">usado</Cap>}
      </div>
    )
  }
  const camp = availability(save, plan, floorIdx, 'campfire')
  return (
    <footer className="bag">
      <div className="bag-group">
        <div className="bag-label">Poções</div>
        <div className="slots">{save.loadout.potions.map((t, i) => slot(t, 'p' + i))}</div>
      </div>
      <div className="bag-group">
        <div className="bag-label">Armas</div>
        <div className="slots">{save.loadout.weapons.map((t, i) => slot(t, 'w' + i))}</div>
      </div>
      <div className="bag-group">
        <div className="bag-label">Ações</div>
        <div className="slots">
          <div
            className={`slot ${camp.left <= 0 ? 'used' : ''}`}
            onPointerDown={camp.left > 0 ? p.onStart('campfire') : undefined}
            title="Fogueira: descansa até a vida cheia (2s por ponto curado). 1 por andar."
          >
            <img src={CAMPFIRE_ICON} alt="" draggable={false} />
            <span className="slot-val heal">cheia</span>
            {camp.left <= 0 && <Cap tone="neutral" className="small slot-flag">usada</Cap>}
          </div>
          <div
            className={`slot ${p.stairsUsed ? 'used' : ''}`}
            onPointerDown={p.stairsUsed ? undefined : p.onStart('stairs')}
            title="Escada: arraste para o mapa para subir ao próximo andar (+1 nível nos monstros)."
          >
            <img src={STAIRS_ICON} alt="" draggable={false} />
            <span className="slot-val">subir</span>
            {p.stairsUsed && <Cap tone="neutral" className="small slot-flag">colocada</Cap>}
          </div>
        </div>
      </div>
      <div className="bag-center">
        <div className="bag-help">Trilhas mais longas levam mais tempo e têm mais encaixes · arraste itens para os encaixes</div>
      </div>
      <div className="bag-actions">
        <button className="btn ghost" disabled={!p.canUndo} onClick={p.undo} title="Ctrl/Cmd+Z">↶ Desfazer</button>
        <button
          className="btn ghost"
          disabled={!plan.floors[floorIdx].steps.length && !plan.floors[floorIdx].stairs}
          onClick={() => {
            const floors = plan.floors.slice(0, floorIdx + 1).map((f, i) => (i === floorIdx ? { steps: [], stairs: null } : f))
            p.commit({ ...plan, floors })
          }}
        >
          Limpar andar
        </button>
        <button className="btn primary start-btn" disabled={!p.totalSteps} onClick={p.onFinish}>
          {p.queued ? 'Colocar na fila' : 'Concluir run'}
        </button>
      </div>
    </footer>
  )
}
