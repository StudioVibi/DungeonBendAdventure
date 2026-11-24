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
import { formatTime, mergeCards, runStatus, type Run, type Save, type SimResult } from '../game/plan'
import { Gold, HeartIcon, HeroImg, MonsterHeadBadge } from './ui'

// ---------------- Seleção de dungeon ----------------

function clock(ms: number) {
  const t = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const sec = String(t % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

export function SelectScreen(p: {
  save: Save
  now: number
  onPick: (d: DungeonId) => void
  onShop: () => void
  onCollection: () => void
  onOpenReport: (runId: string) => void
  onCancelQueued: (runId: string) => void
  onSkip: () => void
}) {
  const { save, now } = p
  const runs = save.runs
  const queuePos = (r: Run) => runs.filter((x) => runStatus(x, now) !== 'done').indexOf(r)
  return (
    <div className="screen select-screen">
      <header className="screen-head">
        <h1 className="logo">DungeonBend <span>Adventure</span></h1>
        <div className="head-actions">
          <Gold value={save.gold} size={22} />
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
          {DUNGEONS.map((d) => {
            const run = runs.find((r) => r.dungeon === d.id)
            const st = run ? runStatus(run, now) : null
            const draft = !run && save.plans[d.id]?.floors.some((f) => f.steps.length)
            return (
              <button
                key={d.id}
                className={`dungeon-card ${st ? 'st-' + st : ''}`}
                style={{ backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.15), rgba(0,0,0,.8)), url(${d.bg})`, borderColor: d.accent }}
                onClick={() => p.onPick(d.id)}
                disabled={st === 'running' || st === 'queued'}
              >
                {draft && <span className="ribbon">Trilha salva</span>}
                <div className="dc-name" style={{ color: d.accent }}>{d.name}</div>
                <div className="dc-heads">
                  {d.pool.map((m) => <MonsterHeadBadge key={m} monster={m} size={52} />)}
                </div>
                <div className="dc-blurb">{d.blurb}</div>
                {!run && <div className="dc-cta">{draft ? 'Continuar trilha' : 'Entrar'}</div>}
                {run && st === 'running' && (
                  <div className="dc-timer">
                    <div className="dc-timer-label">⚔ Trilha em andamento</div>
                    <div className="dc-timer-clock">⏳ {clock(run.endAt - now)}</div>
                    <div className="dc-progress"><div style={{ width: `${((now - run.startAt) / (run.endAt - run.startAt)) * 100}%` }} /></div>
                  </div>
                )}
                {run && st === 'queued' && (
                  <div className="dc-timer queued">
                    <div className="dc-timer-label">Na fila #{queuePos(run) + 1}</div>
                    <div className="dc-timer-clock">começa em {clock(run.startAt - now)}</div>
                    <div className="dc-timer-sub">duração {clock(run.endAt - run.startAt)}</div>
                  </div>
                )}
                {run && st === 'done' && (
                  <div className={`dc-timer done ${run.result.alive ? '' : 'lost'}`}>
                    <div className="dc-timer-label">{run.result.alive ? '✓ Run concluída' : '☠ Alberto caiu'}</div>
                    <div className="dc-cta">Ver relatório</div>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {runs.length > 0 && (
        <section className="queue">
          <h3>Fila de runs</h3>
          <p className="muted small">As runs acontecem uma de cada vez; a próxima começa quando a anterior termina. A dungeon fica trancada até a run dela acabar.</p>
          <ol className="queue-list">
            {runs.map((r) => {
              const st = runStatus(r, now)
              const d = DUNGEONS.find((x) => x.id === r.dungeon)!
              return (
                <li key={r.id} className={`queue-item st-${st}`}>
                  <span className="qi-name" style={{ color: d.accent }}>{d.name}</span>
                  <span className="qi-info">
                    {r.result.wavesCleared} ondas · {r.result.alive ? <Gold value={r.result.gold} size={16} /> : <span className="bad">☠ morre</span>}
                  </span>
                  {st === 'running' && (
                    <>
                      <span className="qi-state">⏳ {clock(r.endAt - now)}</span>
                      <button className="btn ghost small-btn" onClick={p.onSkip} title="Atalho de playtest">⏩ terminar agora</button>
                    </>
                  )}
                  {st === 'queued' && (
                    <>
                      <span className="qi-state muted">começa em {clock(r.startAt - now)}</span>
                      <button className="btn ghost small-btn" onClick={() => p.onCancelQueued(r.id)}>Tirar da fila</button>
                    </>
                  )}
                  {st === 'done' && (
                    <button className="btn primary small-btn" onClick={() => p.onOpenReport(r.id)}>Coletar</button>
                  )}
                </li>
              )
            })}
          </ol>
        </section>
      )}
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
          <p className="muted small">Leve até 3 poções e 2 armas. A mochila renova a cada andar: cada slot pode ser usado 1x por andar. Ao fim da run, as poções dos slots usados são consumidas; armas não.</p>
          <div className="loadout-row">{save.loadout.potions.map((id, i) => slot(id, 'potions', i))}</div>
          <div className="loadout-row">{save.loadout.weapons.map((id, i) => slot(id, 'weapons', i))}</div>
          <h4>Seus itens</h4>
          {owned.length === 0 && <p className="muted small">Nada ainda.</p>}
          <div className="owned-list">
            {owned.map((id) => (
              <button key={id} className="owned" onClick={() => equip(id)} title="Clique para equipar">
                <img src={ITEMS[id].icon} alt="" />
                <span>{ITEMS[id].name}</span>
                <b>{equippedCount(save, id)}/{save.stock[id]}</b>
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
  const cards = mergeCards(p.save.cards)
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
        {!sim.alive && <p className="muted small center">Morrendo, o ouro é perdido — mas os monstros derrotados antes da queda viram cartas.</p>}
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
                <span key={id} className="ri"><img src={ITEMS[id].icon} alt="" /> {ITEMS[id].name} ×{n}</span>
              ))}
            </div>
          </>
        )}
        {preview && (
          <p className="muted small center">
            {p.startsIn > 0
              ? `Outra run está em andamento: esta entra na fila e começa em ${formatTime(p.startsIn / 1000)}.`
              : 'A run começa agora. A dungeon fica trancada até ela terminar.'}
          </p>
        )}
        <div className="modal-actions">
          <button className="btn ghost" onClick={p.onCancel}>{preview ? 'Voltar ao mapa' : 'Fechar'}</button>
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
