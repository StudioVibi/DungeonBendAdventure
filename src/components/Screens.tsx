import {
  ITEMS,
  MONSTERS,
  POTION_IDS,
  WEAPON_IDS,
  isPotion,
  type ItemId,
  type MonsterId,
  type PotionId,
  type WeaponId,
} from '../game/data'
import { formatTime, mergeCards, type Save, type SimResult } from '../game/plan'
import { Gold, HeartIcon } from './ui'

// ---------------- Loja ----------------

export function ShopScreen(p: {
  save: Save
  update: (fn: (s: Save) => Save) => void
  onBack: () => void
  backLabel: string
  onCollection: () => void
}) {
  const { save, update } = p
  const buy = (id: ItemId) =>
    update((s) => {
      if (s.gold < ITEMS[id].price) return s
      const stock = { ...s.stock, [id]: (s.stock[id] ?? 0) + 1 }
      const loadout = { potions: [...s.loadout.potions], weapons: [...s.loadout.weapons] }
      // auto-equipa se houver slot livre
      if (isPotion(id)) {
        const free = loadout.potions.indexOf(null)
        if (free >= 0 && loadout.potions.filter((x) => x === id).length < stock[id]) loadout.potions[free] = id
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
        const equipped = loadout.potions.filter((x) => x === id).length
        if (free < 0 || equipped >= (s.stock[id] ?? 0)) return s
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

  /** item apoiado na estante, com etiqueta de preço pendurada na borda da tábua */
  const shelfItem = (id: ItemId) => {
    const it = ITEMS[id]
    const afford = save.gold >= it.price
    return (
      <button
        key={id}
        data-sfx="buy"
        className={`shelf-item ${afford ? '' : 'poor'}`}
        onClick={() => buy(id)}
        disabled={!afford}
        title={afford ? `Comprar ${it.name}` : `${it.name} — ouro insuficiente`}
      >
        {save.stock[id] > 0 && <span className="si-owned">×{save.stock[id]}</span>}
        <img className="si-art" src={it.icon} alt={it.name} draggable={false} />
        <span className="price-tag">
          <span className="tag-name">{it.name}</span>
          <span className="tag-price">
            <Gold value={it.price} size={16} />
          </span>
          <span className={`tag-effect ${it.kind === 'potion' ? 'heal' : 'dmg'}`}>{it.kind === 'potion' ? `+${it.value} ❤` : `${it.value} damage`}</span>
        </span>
      </button>
    )
  }

  const slot = (id: PotionId | WeaponId | null, kind: 'potions' | 'weapons', i: number) => (
    <button
      key={kind + i}
      data-sfx={id ? 'back' : 'none'}
      className={`tb-slot ${id ? '' : 'empty'}`}
      onClick={() => id && unequip(kind, i)}
      title={id ? `${ITEMS[id].name} — clique para tirar da mochila` : kind === 'potions' ? 'Slot de poção vazio' : 'Slot de arma vazio'}
    >
      {id ? (
        <>
          <img src={ITEMS[id].icon} alt="" draggable={false} />
          <span className={`slot-val ${isPotion(id) ? 'heal' : 'dmg'}`}>{isPotion(id) ? `+${ITEMS[id].value}` : `${ITEMS[id].value}`}</span>
        </>
      ) : (
        <span className="tb-empty">{kind === 'potions' ? 'poção' : 'arma'}</span>
      )}
    </button>
  )

  const owned = [...POTION_IDS, ...WEAPON_IDS].filter((id) => save.stock[id] > 0)

  return (
    <div className="shop">
      <header className="shop-head">
        <button className="btn ghost" data-sfx="back" onClick={p.onBack}>← {p.backLabel}</button>
        <h2>Barraca do mercador</h2>
        <span className="top-gold"><Gold value={save.gold} size={24} /></span>
      </header>

      <main className="shop-room">
        <section className="shelf-unit">
          <div className="shelf-sign">Poções</div>
          <div className="shelf">
            <div className="shelf-items">{POTION_IDS.map(shelfItem)}</div>
            <div className="shelf-board" />
          </div>
        </section>
        <section className="shelf-unit">
          <div className="shelf-sign">Armas</div>
          <div className="shelf">
            <div className="shelf-items">{WEAPON_IDS.slice(0, 2).map(shelfItem)}</div>
            <div className="shelf-board" />
          </div>
          <div className="shelf">
            <div className="shelf-items">{WEAPON_IDS.slice(2).map(shelfItem)}</div>
            <div className="shelf-board" />
          </div>
        </section>
      </main>

      <footer className="shop-toolbar">
        {/* leque de cartas: entra na coleção */}
        <button className="tb-cards" onClick={p.onCollection} title="Ver a coleção de cartas">
          <span className="card-fan">
            {(['bat', 'rat', 'slime_green'] as MonsterId[]).map((m, i) => (
              <span key={m} className={`fan-card c${i}`}>
                <img src={MONSTERS[m].sprite} alt="" draggable={false} />
              </span>
            ))}
          </span>
          <span className="tb-title">Coleção</span>
        </button>

        {/* armazém: itens que o jogador possui (clique leva para a mochila) */}
        <div className="tb-storage">
          <div className="tb-storage-head">
            <img src="/assets/generated/chest.svg" alt="" draggable={false} />
            <span className="tb-title">Armazém</span>
          </div>
          <div className="tb-owned">
            {owned.length === 0 && <span className="muted small">vazio</span>}
            {owned.map((id) => {
              const eq = equippedCount(save, id)
              const full = eq >= save.stock[id]
              return (
                <button key={id} className={`tb-own ${full ? 'full' : ''}`} onClick={() => equip(id)} disabled={full} title={full ? `${ITEMS[id].name}: todos já estão na mochila` : `${ITEMS[id].name}: levar na mochila`}>
                  <img src={ITEMS[id].icon} alt="" draggable={false} />
                  <b>{eq}/{save.stock[id]}</b>
                </button>
              )
            })}
          </div>
        </div>

        <div className="tb-bag">
          <div className="tb-group">
            <div className="bag-label">Poções na mochila</div>
            <div className="slots">{save.loadout.potions.map((id, i) => slot(id, 'potions', i))}</div>
          </div>
          <div className="tb-group">
            <div className="bag-label">Armas na mochila</div>
            <div className="slots">{save.loadout.weapons.map((id, i) => slot(id, 'weapons', i))}</div>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ---------------- Coleção ----------------

export function CollectionScreen(p: { save: Save; onBack: () => void; backLabel: string; onReset: () => void }) {
  const cards = mergeCards(p.save.cards)
  const total = Object.values(p.save.cards).reduce((a, b) => a + b, 0)
  return (
    <div className="screen collection-screen">
      <header className="screen-head">
        <button className="btn ghost" data-sfx="back" onClick={p.onBack}>← {p.backLabel}</button>
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
          const count = cards[id] ?? 0
          return (
            <div key={id} className={`monster-card ${count ? '' : 'locked'}`}>
              <div className="mc-art"><img src={m.sprite} alt="" /></div>
              <div className="mc-name">{count ? m.name : '???'}</div>
              <div className="mc-count">x{count}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------- Relatório ----------------

export function ReportModal(p: {
  mode: 'preview' | 'result'
  sim: SimResult
  dungeonName: string
  /** ms até a run começar (prévia, quando há fila) */
  startsIn: number
  hospitalized: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const { sim } = p
  const preview = p.mode === 'preview'
  const kills = Object.entries(mergeCards(sim.kills)).map(([k, n]) => ({ monster: k as MonsterId, n }))
  const potions = Object.entries(sim.potionsUsed) as [PotionId, number][]
  const title = preview ? (sim.alive ? 'Pronto para a run' : 'Essa trilha mata o Alberto') : sim.alive ? 'Saiu vivo!' : 'Alberto caiu…'
  return (
    <div className="modal-backdrop">
      <div className={`modal report ${sim.alive ? 'win' : 'lose'}`}>
        <div className="report-title">{title}</div>
        <div className="report-sub">
          {p.dungeonName} · {sim.wavesCleared} {sim.wavesCleared === 1 ? 'onda derrotada' : 'ondas derrotadas'}
          {!sim.alive && sim.death && ` · morre no andar ${sim.death.floor + 1}, onda ${sim.death.step + 1}`}
        </div>
        <div className="report-stats">
          <div><span className="muted">{preview ? 'Duração da run' : 'Tempo na dungeon'}</span><b>⏳ {formatTime(sim.runTime)}</b></div>
          <div>
            <span className="muted">Ouro</span>
            <b>{sim.alive ? <Gold value={`+${sim.gold}`} size={22} /> : <span className="muted strike"><Gold value={sim.goldLoot} size={22} /></span>}</b>
          </div>
          <div><span className="muted">Vida final</span><b><HeartIcon dead={sim.hpEnd <= 0} /> {Math.max(0, sim.hpEnd)}</b></div>
        </div>
        {!sim.alive && <p className="muted small center">Morrendo, o ouro é perdido e o Alberto fica 2h hospitalizado — mas os monstros derrotados antes da queda viram cartas.</p>}
        <h4>{preview ? 'Cartas que vai obter' : 'Cartas obtidas'}</h4>
        {kills.length === 0 ? (
          <p className="muted small">Nenhuma.</p>
        ) : (
          <div className="report-cards">
            {kills.map((k) => (
              <div key={k.monster} className="mini-card">
                <img src={MONSTERS[k.monster].sprite} alt="" />
                <span className="mini-name">{MONSTERS[k.monster].name}</span>
                <span className="mini-n">×{k.n}</span>
              </div>
            ))}
          </div>
        )}
        {potions.length > 0 && (
          <>
            <h4>{preview ? 'Itens que serão consumidos' : 'Itens consumidos'}</h4>
            <div className="report-items">
              {potions.map(([id, n]) => (
                <span key={id} className="ri"><img className="item-art" src={ITEMS[id].icon} alt="" /> {ITEMS[id].name} ×{n}</span>
              ))}
            </div>
          </>
        )}
        {preview && (
          <p className="muted small center">
            {p.startsIn > 0
              ? p.hospitalized
                ? `O Alberto está hospitalizado: esta run entra na fila e começa em ${formatTime(p.startsIn / 1000)}.`
                : `Outra run (ou hospitalização) vem antes: esta entra na fila e começa em ${formatTime(p.startsIn / 1000)}.`
              : 'A run começa agora. A dungeon fica trancada até ela terminar.'}
          </p>
        )}
        <div className="modal-actions">
          <button className="btn ghost" data-sfx="back" onClick={p.onCancel}>{preview ? 'Voltar ao mapa' : 'Fechar'}</button>
          <button className="btn primary" onClick={p.onConfirm}>
            {preview ? (p.startsIn > 0 ? 'Colocar na fila' : 'Iniciar run') : 'Coletar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function equippedCount(save: Save, id: ItemId) {
  return [...save.loadout.potions, ...save.loadout.weapons].filter((x) => x === id).length
}
