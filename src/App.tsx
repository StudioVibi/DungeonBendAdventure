import { useCallback, useEffect, useRef, useState } from 'react'
import { DungeonScreen } from './components/DungeonScreen'
import { CollectionScreen, ReportModal, ShopScreen } from './components/Screens'
import { MainMenu } from './components/MainMenu'
import { Loading } from './components/Loading'
import { dungeonById, type DungeonId, type PotionId } from './game/data'
import {
  mergeCards,
  fitEdges,
  hospitalFor,
  hospitalizedUntil,
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
import { play, setMusic, type SoundName } from './game/audio'

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
  /** pilha de navegação (ex.: dungeon → loja → coleção, e volta na ordem) */
  const [stack, setStack] = useState<Screen[]>([])
  const prevScreen = stack[stack.length - 1] ?? 'select'
  const [active, setActive] = useState<DungeonId | null>(null)
  const [floorIdx, setFloorIdxRaw] = useState(0)
  const [report, setReport] = useState<ReportState | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [booted, setBooted] = useState(false)
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
      // toda edição respeita os encaixes por distância (ex.: escada movida, trilha cortada)
      next = fitEdges(next).plan
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
    setStack((st) => (to === 'select' ? [] : [...st, screen].slice(-10)))
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
      const startAt = nextStartAt(s.runs, Date.now(), s.hospitalUntil)
      const endAt = startAt + runDurationMs({ result })
      const run: Run = { id: `${d}-${Date.now()}`, dungeon: d, plan, result, startAt, endAt, hospitalUntil: hospitalFor(result, endAt) }
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
      const cards = mergeCards(s.cards, r.kills)
      return {
        ...s,
        gold: s.gold + r.gold,
        cards,
        hospitalUntil: Math.max(s.hospitalUntil, run.hospitalUntil ?? 0),
        runs: s.runs.filter((x) => x.id !== runId),
      }
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
        runs: retime(s.runs.filter((r) => r.id !== runId), Date.now(), s.hospitalUntil),
      }
    })
  }

  /** Playtest: termina a run em andamento agora e adianta a fila. */
  const skipRunning = () => {
    update((s) => {
      const t = Date.now()
      const runs = s.runs.map((r) =>
        runStatus(r, t) === 'running' ? { ...r, startAt: t - runDurationMs(r), endAt: t, hospitalUntil: hospitalFor(r.result, t) } : r,
      )
      return { ...s, runs: retime(runs, t, s.hospitalUntil) }
    })
  }

  /** Playtest: dá alta ao Alberto agora e adianta a fila. */
  const skipHospital = () => {
    update((s) => {
      const t = Date.now()
      const cap = (h?: number) => (h !== undefined && h > t ? t : h)
      const runs = s.runs.map((r) => (r.endAt <= t ? { ...r, hospitalUntil: cap(r.hospitalUntil) } : r))
      const hospitalUntil = Math.min(s.hospitalUntil, t)
      return { ...s, hospitalUntil, runs: retime(runs, t, hospitalUntil) }
    })
  }

  useEffect(() => {
    if (screen === 'dungeon' && !plan) setScreen('select')
  }, [screen, plan])

  // música: menu (trilha) fora da dungeon, trilha2 dentro
  useEffect(() => setMusic(screen === 'dungeon' ? 'trilha2' : 'trilha'), [screen])

  // sons de botão: data-sfx="confirm|back|buy|none"; botões sem marcação tocam confirm
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element).closest<HTMLElement>('button, [data-sfx]')
      if (!el || (el as HTMLButtonElement).disabled) return
      const sfx = el.dataset.sfx ?? 'confirm'
      if (sfx !== 'none') play(sfx as SoundName)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  const backLabel = prevScreen === 'dungeon' && plan ? 'Voltar à dungeon' : prevScreen === 'shop' ? 'Voltar à loja' : 'Voltar'
  const back = () => {
    const prev = prevScreen
    setStack((st) => st.slice(0, -1))
    if (prev === 'dungeon' && active && plan) openDungeon(active)
    else setScreen(prev === 'dungeon' ? 'select' : prev)
  }

  const resultRun = report?.mode === 'result' ? save.runs.find((r) => r.id === report.runId) : undefined
  const queueStart = nextStartAt(save.runs, now, save.hospitalUntil)
  const hospital = hospitalizedUntil(save, now)

  if (!booted) return <Loading onDone={() => setBooted(true)} />

  return (
    <>
      {screen === 'select' && (
        <MainMenu
          save={save}
          now={now}
          onPick={pickDungeon}
          onShop={() => go('shop')}
          onCollection={() => go('collection')}
          onOpenReport={(runId) => setReport({ mode: 'result', runId })}
          onCancelQueued={cancelQueued}
          onSkip={skipRunning}
          onDiscard={(d) => {
            update((s) => {
              const plans = { ...s.plans }
              delete plans[d]
              return { ...s, plans }
            })
            if (active === d) {
              history.current = []
              setActive(null)
            }
          }}
          hospitalUntil={hospital}
          onSkipHospital={skipHospital}
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
      {screen === 'shop' && <ShopScreen save={save} update={update} onBack={back} backLabel={backLabel} onCollection={() => go('collection')} />}
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
          hospitalized={hospital > 0}
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
          hospitalized={false}
          onConfirm={() => collect(resultRun.id)}
          onCancel={() => setReport(null)}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </>
  )
}
