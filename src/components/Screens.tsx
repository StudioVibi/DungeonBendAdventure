import {
  DUNGEONS,
  HERO,
  ITEMS,
  MONSTERS,
  POTION_IDS,
  WEAPON_IDS,
  isPotion,
  type DungeonId,
  type ItemId,
  type MonsterId,
  type PotionId,
  type WeaponId,
} from '../game/data'
import { formatTime, parseCardKey, type Save, type SimResult } from '../game/plan'
import { Gold, HeartIcon, HeroImg, MonsterHeadBadge } from './ui'

// ---------------- Seleção de dungeon ----------------

export function SelectScreen(p: { save: Save; onPick: (d: DungeonId) => void; onShop: () => void; onCollection: () => void }) {
  const active = p.save.plan?.dungeon
  return (
    <div className="screen select-screen">
      <header className="screen-head">
        <h1 className="logo">DungeonBend <span>Adventure</span></h1>
        <div className="head-actions">
          <Gold value={p.save.gold} size={22} />
          <button className="btn" onClick={p.onCollection}>Coleção</button>
          <button className="btn" onClick={p.onShop}>Loja</button>
        </div>
      </header>
      <div className="select-body">
        <div className="hero-card">
          <HeroImg size={170} />
          <div className="hero-name">{HERO.name}</div>
          <div className="hero-hp"><HeartIcon /> {HERO.maxHp} de vida</div>
        </div>
        <div className="dungeon-cards">
          {DUNGEONS.map((d) => (
            <button
              key={d.id}
              className="dungeon-card"
              style={{ backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.15), rgba(0,0,0,.8)), url(${d.bg})`, borderColor: d.accent }}
              onClick={() => p.onPick(d.id)}
            >
              {active === d.id && <span className="ribbon">Trilha em andamento</span>}
              <div className="dc-name" style={{ color: d.accent }}>{d.name}</div>
              <div className="dc-heads">
                {d.pool.map((m) => <MonsterHeadBadge key={m} monster={m} size={52} />)}
              </div>
              <div className="dc-blurb">{d.blurb}</div>
              <div className="dc-cta">{active === d.id ? 'Continuar' : 'Entrar'}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------- Loja ----------------

export function ShopScreen(p: { save: Save; update: (fn: (s: Save) => Save) => void; onBack: () => void; backLabel: string }) {
  const { save, update } = p
  const buy = (id: ItemId) =>
    update((s) => {
      if (s.gold < ITEMS[id].price) return s
      const stock = { ...s.stock, [id]: (s.stock[id] ?? 0) + 1 }
      const loadout = { potions: [...s.loadout.potions], weapons: [...s.loadout.weapons] }
      // auto-equipa se houver slot livre
      if (isPotion(id)) {
        if (!loadout.potions.includes(id)) {
          const free = loadout.potions.indexOf(null)
          if (free >= 0) loadout.potions[free] = id
        }
      } else {
        const free = loadout.weapons.indexOf(null)
        if (free >= 0) loadout.weapons[free] = id as WeaponId
      }
      return { ...s, gold: s.gold - ITEMS[id].price, stock, loadout }
    })

  const equip = (id: ItemId) =>
    update((s) => {
      const loadout = { potions: [...s.loadout.potions], weapons: [...s.loadout.weapons] }
      if (isPotion(id)) {
        const free = loadout.potions.indexOf(null)
        if (free < 0 || (s.stock[id] ?? 0) < 1) return s
        loadout.potions[free] = id
      } else {
        const free = loadout.weapons.indexOf(null)
        const equipped = loadout.weapons.filter((w) => w === id).length
        if (free < 0 || equipped >= (s.stock[id] ?? 0)) return s
        loadout.weapons[free] = id as WeaponId
      }
      return { ...s, loadout }
    })

  const unequip = (kind: 'potions' | 'weapons', i: number) =>
    update((s) => {
      const loadout = { potions: [...s.loadout.potions], weapons: [...s.loadout.weapons] }
      loadout[kind][i] = null
      return { ...s, loadout }
    })

  const card = (id: ItemId) => {
    const it = ITEMS[id]
    const afford = save.gold >= it.price
    return (
      <button key={id} className={`shop-card ${afford ? '' : 'poor'}`} onClick={() => buy(id)} disabled={!afford}>
        <span className={`sc-val ${it.kind === 'potion' ? 'heal' : 'dmg'}`}>{it.kind === 'potion' ? `+${it.value}` : it.value}</span>
        <img src={it.icon} alt="" />
        <span className="sc-name">{it.name}</span>
        <span className="sc-price"><Gold value={`${it.price}g`} size={18} /></span>
        {save.stock[id] > 0 && <span className="sc-owned">tem {save.stock[id]}</span>}
      </button>
    )
  }

  const slot = (id: PotionId | WeaponId | null, kind: 'potions' | 'weapons', i: number) => (
    <button key={kind + i} className={`loadout-slot ${id ? '' : 'empty'}`} onClick={() => id && unequip(kind, i)} title={id ? 'Clique para desequipar' : 'Vazio'}>
      {id ? <img src={ITEMS[id].icon} alt="" /> : '+'}
      {id && <span className="ls-name">{ITEMS[id].name}</span>}
    </button>
  )

  const owned = [...POTION_IDS, ...WEAPON_IDS].filter((id) => save.stock[id] > 0)

  return (
    <div className="screen shop-screen">
      <header className="screen-head">
        <button className="btn ghost" onClick={p.onBack}>← {p.backLabel}</button>
        <h2>Loja</h2>
        <Gold value={save.gold} size={24} />
      </header>
      <div className="shop-body">
        <section className="shop-grid">
          <div className="shop-col">
            <h3>Poções <small>cura</small></h3>
            {POTION_IDS.map(card)}
          </div>
          <div className="shop-col">
            <h3>Armas <small>dano flat na próxima onda</small></h3>
            {WEAPON_IDS.map(card)}
          </div>
        </section>
        <aside className="loadout">
          <h3>Mochila</h3>
          <p className="muted small">Leve até 3 poções e 2 armas. Cada slot pode ser usado 1x por andar. Poções usadas são consumidas do estoque; armas não.</p>
          <div className="loadout-row">{save.loadout.potions.map((id, i) => slot(id, 'potions', i))}</div>
          <div className="loadout-row">{save.loadout.weapons.map((id, i) => slot(id, 'weapons', i))}</div>
          <h4>Seus itens</h4>
          {owned.length === 0 && <p className="muted small">Nada ainda.</p>}
          <div className="owned-list">
            {owned.map((id) => (
              <button key={id} className="owned" onClick={() => equip(id)} title="Clique para equipar">
                <img src={ITEMS[id].icon} alt="" />
                <span>{ITEMS[id].name}</span>
                <b>x{save.stock[id]}</b>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}

// ---------------- Coleção ----------------

export function CollectionScreen(p: { save: Save; onBack: () => void; backLabel: string; onReset: () => void }) {
  const byMonster: Partial<Record<MonsterId, { level: number; n: number }[]>> = {}
  for (const [k, n] of Object.entries(p.save.cards)) {
    const { monster, level } = parseCardKey(k)
    ;(byMonster[monster] ??= []).push({ level, n })
  }
  const total = Object.values(p.save.cards).reduce((a, b) => a + b, 0)
  return (
    <div className="screen collection-screen">
      <header className="screen-head">
        <button className="btn ghost" onClick={p.onBack}>← {p.backLabel}</button>
        <h2>Coleção de cartas <small className="muted">({total})</small></h2>
        <button
          className="btn ghost danger"
          onClick={() => confirm('Apagar todo o progresso (ouro, itens, cartas e trilha)?') && p.onReset()}
        >
          Resetar progresso
        </button>
      </header>
      <p className="muted center">Monstros derrotados viram cartas colecionáveis.</p>
      <div className="cards-grid">
        {(Object.keys(MONSTERS) as MonsterId[]).map((id) => {
          const m = MONSTERS[id]
          const levels = (byMonster[id] ?? []).sort((a, b) => a.level - b.level)
          const count = levels.reduce((a, b) => a + b.n, 0)
          return (
            <div key={id} className={`monster-card ${count ? '' : 'locked'}`}>
              <div className="mc-art"><img src={m.sprite} alt="" /></div>
              <div className="mc-name">{count ? m.name : '???'}</div>
              <div className="mc-count">x{count}</div>
              <div className="mc-levels">
                {levels.map((l) => (
                  <span key={l.level} className="lvl">Nv{l.level} ×{l.n}</span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------- Relatório ----------------

export function ReportModal(p: { sim: SimResult; dungeonName: string; onCollect: () => void; onCancel: () => void }) {
  const { sim } = p
  const kills = Object.entries(sim.kills).map(([k, n]) => ({ ...parseCardKey(k), n }))
  const potions = Object.entries(sim.potionsUsed) as [PotionId, number][]
  return (
    <div className="modal-backdrop">
      <div className={`modal report ${sim.alive ? 'win' : 'lose'}`}>
        <div className="report-title">{sim.alive ? 'Saiu vivo!' : 'Alberto caiu…'}</div>
        <div className="report-sub">
          {p.dungeonName} · {sim.wavesCleared} {sim.wavesCleared === 1 ? 'onda derrotada' : 'ondas derrotadas'}
          {!sim.alive && sim.death && ` · morreu no andar ${sim.death.floor + 1}`}
        </div>
        <div className="report-stats">
          <div><span className="muted">Tempo na dungeon</span><b>⏳ {formatTime(sim.runTime)}</b></div>
          <div>
            <span className="muted">Ouro</span>
            <b>{sim.alive ? <Gold value={`+${sim.gold}`} size={22} /> : <span className="muted strike"><Gold value={sim.goldLoot} size={22} /></span>}</b>
          </div>
          <div><span className="muted">Vida final</span><b><HeartIcon dead={sim.hpEnd <= 0} /> {Math.max(0, sim.hpEnd)}</b></div>
        </div>
        {!sim.alive && <p className="muted small center">Morrendo, o ouro é perdido — mas os monstros derrotados antes da queda viram cartas.</p>}
        <h4>Cartas obtidas</h4>
        {kills.length === 0 ? (
          <p className="muted small">Nenhuma.</p>
        ) : (
          <div className="report-cards">
            {kills.map((k) => (
              <div key={`${k.monster}:${k.level}`} className="mini-card">
                <img src={MONSTERS[k.monster].sprite} alt="" />
                <span className="mini-name">{MONSTERS[k.monster].name}</span>
                <span className="mini-lvl">Nv{k.level}</span>
                <span className="mini-n">×{k.n}</span>
              </div>
            ))}
          </div>
        )}
        {potions.length > 0 && (
          <>
            <h4>Itens consumidos</h4>
            <div className="report-items">
              {potions.map(([id, n]) => (
                <span key={id} className="ri"><img src={ITEMS[id].icon} alt="" /> {ITEMS[id].name} ×{n}</span>
              ))}
            </div>
          </>
        )}
        <div className="modal-actions">
          <button className="btn ghost" onClick={p.onCancel}>Voltar ao mapa</button>
          <button className="btn primary" onClick={p.onCollect}>Confirmar run</button>
        </div>
      </div>
    </div>
  )
}
