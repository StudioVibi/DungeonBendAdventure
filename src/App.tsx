import { useCallback, useEffect, useRef, useState } from 'react'
import { DungeonScreen } from './components/DungeonScreen'
import { CollectionScreen, ReportModal, SelectScreen, ShopScreen } from './components/Screens'
import { dungeonById, type DungeonId } from './game/data'
import { newPlan, sanitizePlan, simulate, type Plan, type SimResult } from './game/plan'
import { useSave } from './game/store'

type Screen = 'select' | 'dungeon' | 'shop' | 'collection'

export default function App() {
  const { save, update, reset } = useSave()
  const [screen, setScreen] = useState<Screen>(save.plan ? 'dungeon' : 'select')
  const [prevScreen, setPrevScreen] = useState<Screen>('select')
  const [floorIdx, setFloorIdxRaw] = useState(0)
  const [report, setReport] = useState<SimResult | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const history = useRef<Plan[]>([])
  const [, force] = useState(0)

  const plan = save.plan
  const planRef = useRef(plan)
  planRef.current = plan
  const maxFloor = plan ? plan.floors.length - 1 : 0
  const setFloorIdx = useCallback((i: number) => setFloorIdxRaw(i), [])
  const shownFloor = Math.min(floorIdx, maxFloor)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3200)
  }

  const commit = useCallback(
    (next: Plan) => {
      if (planRef.current) {
        history.current.push(planRef.current)
        if (history.current.length > 200) history.current.shift()
      }
      planRef.current = next
      update((s) => ({ ...s, plan: next }))
      force((n) => n + 1)
    },
    [update],
  )

  const undo = useCallback(() => {
    const prev = history.current.pop()
    if (!prev) return
    planRef.current = prev
    update((s) => ({ ...s, plan: prev }))
    force((n) => n + 1)
  }, [update])

  const go = (to: Screen) => {
    setPrevScreen(screen)
    setScreen(to)
  }

  // ao voltar da loja, remove do plano itens que a mochila não comporta mais
  const backToDungeon = () => {
    if (save.plan) {
      const { plan: clean, removed } = sanitizePlan(save.plan, save)
      if (removed) {
        update((s) => ({ ...s, plan: clean }))
        showToast(`${removed} ${removed === 1 ? 'item foi removido' : 'itens foram removidos'} da trilha (mochila/estoque mudou).`)
      }
    }
    setScreen('dungeon')
  }

  const pickDungeon = (d: DungeonId) => {
    if (save.plan && save.plan.dungeon !== d) {
      if (!confirm(`Você tem uma trilha em andamento em ${dungeonById(save.plan.dungeon).name}. Descartar e entrar em ${dungeonById(d).name}?`)) return
    }
    if (!save.plan || save.plan.dungeon !== d) {
      history.current = []
      update((s) => ({ ...s, plan: newPlan(d) }))
      setFloorIdxRaw(0)
    }
    setScreen('dungeon')
  }

  const collect = () => {
    if (!report) return
    const r = report
    update((s) => {
      const cards = { ...s.cards }
      for (const [k, n] of Object.entries(r.kills)) cards[k] = (cards[k] ?? 0) + n
      const stock = { ...s.stock }
      for (const [id, n] of Object.entries(r.potionsUsed)) stock[id as keyof typeof stock] = Math.max(0, stock[id as keyof typeof stock] - (n ?? 0))
      return { ...s, gold: s.gold + r.gold, cards, stock, plan: null }
    })
    history.current = []
    setReport(null)
    setFloorIdxRaw(0)
    setScreen('select')
  }

  useEffect(() => {
    if (screen === 'dungeon' && !plan) setScreen('select')
  }, [screen, plan])

  const backLabel = prevScreen === 'dungeon' && plan ? 'Voltar à dungeon' : 'Voltar'
  const back = () => (prevScreen === 'dungeon' && plan ? backToDungeon() : setScreen('select'))

  return (
    <>
      {screen === 'select' && <SelectScreen save={save} onPick={pickDungeon} onShop={() => go('shop')} onCollection={() => go('collection')} />}
      {screen === 'dungeon' && plan && (
        <DungeonScreen
          save={save}
          plan={plan}
          floorIdx={shownFloor}
          setFloorIdx={setFloorIdx}
          commit={commit}
          undo={undo}
          canUndo={history.current.length > 0}
          onShop={() => go('shop')}
          onCollection={() => go('collection')}
          onLeave={() => go('select')}
          onFinish={() => setReport(simulate(plan))}
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
            setScreen('select')
          }}
        />
      )}
      {report && plan && (
        <ReportModal sim={report} dungeonName={dungeonById(plan.dungeon).name} onCollect={collect} onCancel={() => setReport(null)} />
      )}
      {toast && <div className="toast">{toast}</div>}
    </>
  )
}
