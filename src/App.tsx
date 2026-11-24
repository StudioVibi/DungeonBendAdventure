import { useCallback, useEffect, useRef, useState } from 'react'
import { DungeonScreen } from './components/DungeonScreen'
import { CollectionScreen, ReportModal, SelectScreen, ShopScreen } from './components/Screens'
import { dungeonById, type DungeonId, type PotionId } from './game/data'
import {
  nextStartAt,
  newPlan,
  retime,
  runDurationMs,
  runStatus,
  sanitizePlan,
  simulate,
  type Plan,
  type Run,
  type SimResult,
} from './game/plan'
import { normalizeLoadout, useSave } from './game/store'

type Screen = 'select' | 'dungeon' | 'shop' | 'collection'
type ReportState = { mode: 'preview'; sim: SimResult } | { mode: 'result'; runId: string }

/** Relógio que atualiza 1x por segundo (para os timers). */
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

export default function App() {
  const { save, update, reset } = useSave()
  const now = useNow()
  const [screen, setScreen] = useState<Screen>('select')
  const [prevScreen, setPrevScreen] = useState<Screen>('select')
  const [active, setActive] = useState<DungeonId | null>(null)
  const [floorIdx, setFloorIdxRaw] = useState(0)
  const [report, setReport] = useState<ReportState | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const history = useRef<Plan[]>([])
  const [, force] = useState(0)

  const plan = active ? save.plans[active] ?? null : null
  const planRef = useRef(plan)
  planRef.current = plan
  const maxFloor = plan ? plan.floors.length - 1 : 0
  const setFloorIdx = useCallback((i: number) => setFloorIdxRaw(i), [])
  const shownFloor = Math.min(floorIdx, maxFloor)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3200)
  }

  const setPlan = useCallback(
    (d: DungeonId, p: Plan) => update((s) => ({ ...s, plans: { ...s.plans, [d]: p } })),
    [update],
  )

  const commit = useCallback(
    (next: Plan) => {
      if (planRef.current) {
        history.current.push(planRef.current)
        if (history.current.length > 200) history.current.shift()
      }
      planRef.current = next
      setPlan(next.dungeon, next)
      force((n) => n + 1)
    },
    [setPlan],
  )

  const undo = useCallback(() => {
    const prev = history.current.pop()
    if (!prev) return
    planRef.current = prev
    setPlan(prev.dungeon, prev)
    force((n) => n + 1)
  }, [setPlan])

  const go = (to: Screen) => {
    setPrevScreen(screen)
    setScreen(to)
  }

  /** Abre a dungeon limpando do rascunho itens que a mochila/estoque não comporta mais. */
  const openDungeon = (d: DungeonId) => {
    const draft = save.plans[d]
    if (draft) {
      const { plan: clean, removed } = sanitizePlan(draft, save)
      if (removed) {
        setPlan(d, clean)
        showToast(`${removed} ${removed === 1 ? 'item foi removido' : 'itens foram removidos'} da trilha (mochila/estoque mudou).`)
      }
    } else {
      setPlan(d, newPlan(d))
    }
    if (active !== d) {
      history.current = []
      setFloorIdxRaw(0)
    }
    setActive(d)
    setScreen('dungeon')
  }

  const pickDungeon = (d: DungeonId) => {
    const run = save.runs.find((r) => r.dungeon === d)
    if (run) {
      if (runStatus(run, now) === 'done') setReport({ mode: 'result', runId: run.id })
      return // dungeon trancada até a run acabar
    }
    openDungeon(d)
  }

  /** Inicia a run (ou coloca na fila). As poções da trilha saem do estoque agora. */
  const startRun = () => {
    if (!plan || !active) return
    const result = simulate(plan)
    const d = active
    update((s) => {
      const startAt = nextStartAt(s.runs, Date.now())
      const run: Run = { id: `${d}-${Date.now()}`, dungeon: d, plan, result, startAt, endAt: startAt + runDurationMs({ result }) }
      const stock = { ...s.stock }
      for (const [id, n] of Object.entries(result.potionsUsed) as [PotionId, number][]) stock[id] = Math.max(0, stock[id] - n)
      const plans = { ...s.plans }
      delete plans[d]
      return normalizeLoadout({ ...s, stock, plans, runs: [...s.runs, run] })
    })
    history.current = []
    setReport(null)
    setActive(null)
    setFloorIdxRaw(0)
    setScreen('select')
  }

  /** Coleta o resultado de uma run terminada. */
  const collect = (runId: string) => {
    const run = save.runs.find((r) => r.id === runId)
    if (!run) return
    const r = run.result
    update((s) => {
      const cards = { ...s.cards }
      for (const [k, n] of Object.entries(r.kills)) cards[k] = (cards[k] ?? 0) + n
      return { ...s, gold: s.gold + r.gold, cards, runs: s.runs.filter((x) => x.id !== runId) }
    })
    setReport(null)
  }

  /** Tira da fila uma run que ainda não começou: devolve poções e a trilha volta a ser rascunho. */
  const cancelQueued = (runId: string) => {
    update((s) => {
      const run = s.runs.find((r) => r.id === runId)
      if (!run || runStatus(run, Date.now()) !== 'queued') return s
      const stock = { ...s.stock }
      for (const [id, n] of Object.entries(run.result.potionsUsed) as [PotionId, number][]) stock[id] += n
      return {
        ...s,
        stock,
        plans: { ...s.plans, [run.dungeon]: run.plan },
        runs: retime(s.runs.filter((r) => r.id !== runId), Date.now()),
      }
    })
  }

  /** Playtest: termina a run em andamento agora e adianta a fila. */
  const skipRunning = () => {
    update((s) => {
      const t = Date.now()
      const runs = s.runs.map((r) => (runStatus(r, t) === 'running' ? { ...r, startAt: t - runDurationMs(r), endAt: t } : r))
      return { ...s, runs: retime(runs, t) }
    })
  }

  useEffect(() => {
    if (screen === 'dungeon' && !plan) setScreen('select')
  }, [screen, plan])

  const backLabel = prevScreen === 'dungeon' && plan ? 'Voltar à dungeon' : 'Voltar'
  const back = () => (prevScreen === 'dungeon' && active && plan ? openDungeon(active) : setScreen('select'))

  const resultRun = report?.mode === 'result' ? save.runs.find((r) => r.id === report.runId) : undefined
  const queueStart = nextStartAt(save.runs, now)

  return (
    <>
      {screen === 'select' && (
        <SelectScreen
          save={save}
          now={now}
          onPick={pickDungeon}
          onShop={() => go('shop')}
          onCollection={() => go('collection')}
          onOpenReport={(runId) => setReport({ mode: 'result', runId })}
          onCancelQueued={cancelQueued}
          onSkip={skipRunning}
        />
      )}
      {screen === 'dungeon' && plan && (
        <DungeonScreen
          save={save}
          plan={plan}
          floorIdx={shownFloor}
          setFloorIdx={setFloorIdx}
          commit={commit}
          undo={undo}
          canUndo={history.current.length > 0}
          queued={queueStart > now}
          onShop={() => go('shop')}
          onCollection={() => go('collection')}
          onLeave={() => go('select')}
          onFinish={() => setReport({ mode: 'preview', sim: simulate(plan) })}
        />
      )}
      {screen === 'shop' && <ShopScreen save={save} update={update} onBack={back} backLabel={backLabel} />}
      {screen === 'collection' && (
        <CollectionScreen
          save={save}
          onBack={back}
          backLabel={backLabel}
          onReset={() => {
            reset()
            history.current = []
            setActive(null)
            setScreen('select')
          }}
        />
      )}
      {report?.mode === 'preview' && plan && (
        <ReportModal
          mode="preview"
          sim={report.sim}
          dungeonName={dungeonById(plan.dungeon).name}
          startsIn={queueStart - now}
          onConfirm={startRun}
          onCancel={() => setReport(null)}
        />
      )}
      {resultRun && (
        <ReportModal
          mode="result"
          sim={resultRun.result}
          dungeonName={dungeonById(resultRun.dungeon).name}
          startsIn={0}
          onConfirm={() => collect(resultRun.id)}
          onCancel={() => setReport(null)}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </>
  )
}
