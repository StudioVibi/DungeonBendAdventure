import { useCallback, useEffect, useState } from 'react'
import { ITEMS, POTION_SLOTS, STARTING_GOLD, WEAPON_SLOTS, type ItemId } from './data'
import type { Plan, Save } from './plan'

const KEY = 'dungeonbend-adventure:save:v1'

export function defaultSave(): Save {
  const stock = Object.fromEntries(Object.keys(ITEMS).map((k) => [k, 0])) as Record<ItemId, number>
  stock.potion_s = 2
  stock.potion_m = 1
  stock.cleaver = 1
  return {
    gold: STARTING_GOLD,
    stock,
    loadout: { potions: ['potion_s', 'potion_s', 'potion_m'], weapons: ['cleaver', null] },
    cards: {},
    plans: {},
    runs: [],
  }
}

/** Desequipa slots que excedem o estoque (ex.: poções consumidas na última run). */
export function normalizeLoadout(s: Save): Save {
  const fit = <T extends ItemId>(slots: (T | null)[]) => {
    const seen: Partial<Record<ItemId, number>> = {}
    return slots.map((id) => {
      if (!id) return null
      seen[id] = (seen[id] ?? 0) + 1
      return seen[id]! <= (s.stock[id] ?? 0) ? id : null
    })
  }
  return { ...s, loadout: { potions: fit(s.loadout.potions), weapons: fit(s.loadout.weapons) } }
}

function load(): Save {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultSave()
    const s = JSON.parse(raw) as Save & { plan?: Plan | null }
    const d = defaultSave()
    // migração: save antigo tinha um único `plan`
    if (s.plan) s.plans = { ...(s.plans ?? {}), [s.plan.dungeon]: s.plan }
    delete s.plan
    s.plans ??= {}
    s.runs ??= []
    return normalizeLoadout({
      ...d,
      ...s,
      stock: { ...d.stock, ...s.stock },
      loadout: {
        potions: Array.from({ length: POTION_SLOTS }, (_, i) => s.loadout?.potions?.[i] ?? null),
        weapons: Array.from({ length: WEAPON_SLOTS }, (_, i) => s.loadout?.weapons?.[i] ?? null),
      },
    })
  } catch {
    return defaultSave()
  }
}

export function useSave() {
  const [save, setSave] = useState<Save>(load)
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(save))
  }, [save])
  const update = useCallback((fn: (s: Save) => Save) => setSave(fn), [])
  const reset = useCallback(() => setSave(defaultSave()), [])
  return { save, update, reset }
}
