import type { DebugState, ItemDef, Souls } from '../types/index.ts'
import { ITEM_POOL } from '../game/items/index.ts'
import { SYMBOLS } from '../game/Symbols.ts'

/** Tout ce que le panneau a le droit de toucher dans le jeu. */
export interface DebugApi {
  state: DebugState
  getBalance(): Souls
  setBalance(v: Souls): void
  addMoney(v: Souls): void
  setShopCredit(v: Souls): void
  liftBalanceCap(): void
  getBet(): Souls
  setBet(v: Souls): void
  addItem(def: ItemDef, target: number | string | null): void
  addEveryItem(): void
  clearItems(): void
  grantSlots(n: number): void
  slotsInfo(): { used: number; max: number }
  reelCount(): number
  stageInfo(): { stage: number; goal: Souls; earned: Souls }
  completeQuota(): void
  freeSpins(n: number): void
  forceWin(mult: number): void
  triggerVictory(): void
  triggerGameOver(): void
  unlockAllCharacters(): void
  wipeSave(): void
  refresh(): void
}

const CSS = `
#debug-panel{position:fixed;right:12px;bottom:12px;width:310px;max-height:82vh;z-index:9999;
 background:#0d1116f2;border:1px solid #5a6b7a;border-radius:8px;color:#cfd8e0;
 font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;box-shadow:0 8px 28px #000a;
 display:flex;flex-direction:column;overflow:hidden}
#debug-panel.hidden{display:none}
#debug-panel .dbg-head{display:flex;align-items:center;justify-content:space-between;
 padding:6px 9px;background:#182029;border-bottom:1px solid #2c3844;cursor:pointer;user-select:none}
#debug-panel .dbg-head b{color:#8fd6ff;letter-spacing:.08em;font-size:11px}
#debug-panel .dbg-body{overflow:auto;padding:8px 9px 12px}
#debug-panel.collapsed .dbg-body{display:none}
#debug-panel fieldset{border:1px solid #2c3844;border-radius:5px;margin:0 0 8px;padding:6px 7px 8px}
#debug-panel legend{color:#7f9bb0;padding:0 4px;font-size:10px;letter-spacing:.1em;text-transform:uppercase}
#debug-panel .dbg-row{display:flex;gap:4px;align-items:center;margin-top:4px;flex-wrap:wrap}
#debug-panel button{background:#1d2a35;border:1px solid #3d5265;color:#d8e6f0;border-radius:4px;
 padding:3px 7px;cursor:pointer;font:inherit}
#debug-panel button:hover{background:#283a49;border-color:#6f93ae}
#debug-panel button.on{background:#1f5137;border-color:#49b380;color:#c9ffe4}
#debug-panel button.danger{border-color:#7a3d3d;color:#ffb8b8}
#debug-panel input,#debug-panel select{background:#0a0f14;border:1px solid #33434f;color:#d8e6f0;
 border-radius:4px;padding:2px 5px;font:inherit;min-width:0}
#debug-panel input[type=number]{width:88px}
#debug-panel input[type=range]{width:118px;padding:0}
#debug-panel select{max-width:100%;flex:1}
#debug-panel .dbg-info{color:#7f9bb0;margin-top:4px}
#debug-panel .dbg-tag{color:#8fd6ff}
`

export class DebugPanel {
  #api: DebugApi
  #root: HTMLElement
  #info!: HTMLElement
  #godBtn!: HTMLButtonElement
  #capBtn!: HTMLButtonElement
  #itemSelect!: HTMLSelectElement
  #targetWrap!: HTMLElement
  #balanceInput!: HTMLInputElement
  #betInput!: HTMLInputElement
  #winMultInput!: HTMLInputElement

  constructor(api: DebugApi) {
    this.#api = api
    if (!document.getElementById('debug-panel-css')) {
      const style = document.createElement('style')
      style.id = 'debug-panel-css'
      style.textContent = CSS
      document.head.appendChild(style)
    }
    this.#root = document.createElement('div')
    this.#root.id = 'debug-panel'
    this.#root.className = 'hidden'
    document.body.appendChild(this.#root)
    this.#build()

    window.addEventListener('keydown', (e) => {
      if (e.key === 'F9') { e.preventDefault(); this.toggle() }
    })
  }

  show(): void { this.#root.classList.remove('hidden'); this.refresh() }
  hide(): void { this.#root.classList.add('hidden') }
  toggle(): void { this.#root.classList.toggle('hidden'); if (!this.#root.classList.contains('hidden')) this.refresh() }

  refresh(): void {
    const { used, max } = this.#api.slotsInfo()
    const { stage, goal, earned } = this.#api.stageInfo()
    this.#info.innerHTML =
      `solde <span class="dbg-tag">⛧${Math.round(this.#api.getBalance())}</span> · ` +
      `mise <span class="dbg-tag">⛧${this.#api.getBet()}</span><br>` +
      `bonus <span class="dbg-tag">${used}/${max}</span> · ` +
      `palier <span class="dbg-tag">${stage}</span> ` +
      `quota <span class="dbg-tag">${Math.round(earned)}/${goal}</span>`
    this.#godBtn.classList.toggle('on', this.#api.state.godMode)
    this.#godBtn.textContent = this.#api.state.godMode ? 'Immortel : ON' : 'Immortel : OFF'
    this.#balanceInput.value = String(Math.round(this.#api.getBalance()))
    this.#betInput.value = String(this.#api.getBet())
  }

  // ── Construction ────────────────────────────────────────
  #build(): void {
    const head = this.#el('div', 'dbg-head')
    head.innerHTML = '<b>🛠 DEBUG — F9</b><span>▾</span>'
    head.addEventListener('click', () => this.#root.classList.toggle('collapsed'))
    this.#root.appendChild(head)

    const body = this.#el('div', 'dbg-body')
    this.#root.appendChild(body)

    this.#info = this.#el('div', 'dbg-info')

    body.appendChild(this.#buildStateSection())
    body.appendChild(this.#buildMoneySection())
    body.appendChild(this.#buildItemsSection())
    body.appendChild(this.#buildLuckSection())
    body.appendChild(this.#buildRunSection())
    body.appendChild(this.#buildSystemSection())
  }

  #buildStateSection(): HTMLElement {
    const fs = this.#fieldset('État')
    fs.appendChild(this.#info)
    const row = this.#el('div', 'dbg-row')
    this.#godBtn = this.#btn('Immortel : ON', () => {
      this.#api.state.godMode = !this.#api.state.godMode
      this.refresh()
    })
    row.appendChild(this.#godBtn)
    row.appendChild(this.#btn('Rafraîchir', () => { this.#api.refresh(); this.refresh() }))
    fs.appendChild(row)
    return fs
  }

  #buildMoneySection(): HTMLElement {
    const fs = this.#fieldset('Vie / Solde')

    const row1 = this.#el('div', 'dbg-row')
    this.#balanceInput = this.#num(1000)
    row1.appendChild(this.#balanceInput)
    row1.appendChild(this.#btn('Fixer solde', () => {
      this.#api.setBalance(Number(this.#balanceInput.value) || 0)
      this.#after()
    }))
    fs.appendChild(row1)

    const row2 = this.#el('div', 'dbg-row')
    for (const amount of [100, 1000, 10000, 1000000]) {
      row2.appendChild(this.#btn(`+${amount >= 1000000 ? '1M' : amount >= 1000 ? amount / 1000 + 'k' : amount}`, () => {
        this.#api.addMoney(amount)
        this.#after()
      }))
    }
    fs.appendChild(row2)

    const row3 = this.#el('div', 'dbg-row')
    this.#capBtn = this.#btn('Plafond ∞', () => { this.#api.liftBalanceCap(); this.#after() })
    row3.appendChild(this.#capBtn)
    row3.appendChild(this.#btn('Crédit +1k', () => { this.#api.setShopCredit(1000); this.#after() }))
    row3.appendChild(this.#btn('Solde = 0', () => { this.#api.setBalance(0); this.#after() }, 'danger'))
    fs.appendChild(row3)

    const row4 = this.#el('div', 'dbg-row')
    this.#betInput = this.#num(10)
    row4.appendChild(this.#betInput)
    row4.appendChild(this.#btn('Fixer mise', () => {
      this.#api.setBet(Number(this.#betInput.value) || 1)
      this.#after()
    }))
    fs.appendChild(row4)
    return fs
  }

  #buildItemsSection(): HTMLElement {
    const fs = this.#fieldset('Bonus / Items')

    const row1 = this.#el('div', 'dbg-row')
    this.#itemSelect = document.createElement('select')
    for (const level of [1, 2, 3] as const) {
      const group = document.createElement('optgroup')
      group.label = `Niveau ${level}`
      for (const item of ITEM_POOL.filter(i => i.level === level)) {
        const opt = document.createElement('option')
        opt.value = item.id
        opt.textContent = `${item.kind === 'consumable' ? '◦' : '●'} ${item.name}`
        group.appendChild(opt)
      }
      this.#itemSelect.appendChild(group)
    }
    this.#itemSelect.addEventListener('change', () => this.#renderTarget())
    row1.appendChild(this.#itemSelect)
    fs.appendChild(row1)

    this.#targetWrap = this.#el('div', 'dbg-row')
    fs.appendChild(this.#targetWrap)

    const row2 = this.#el('div', 'dbg-row')
    row2.appendChild(this.#btn('Ajouter', () => {
      const def = ITEM_POOL.find(i => i.id === this.#itemSelect.value)
      if (def) this.#api.addItem(def, this.#currentTarget())
      this.#after()
    }))
    row2.appendChild(this.#btn('×5', () => {
      const def = ITEM_POOL.find(i => i.id === this.#itemSelect.value)
      if (def) for (let i = 0; i < 5; i++) this.#api.addItem(def, this.#currentTarget())
      this.#after()
    }))
    row2.appendChild(this.#btn('Tout ajouter', () => { this.#api.addEveryItem(); this.#after() }))
    fs.appendChild(row2)

    const row3 = this.#el('div', 'dbg-row')
    row3.appendChild(this.#btn('+5 slots', () => { this.#api.grantSlots(5); this.#after() }))
    row3.appendChild(this.#btn('+99 slots', () => { this.#api.grantSlots(99); this.#after() }))
    row3.appendChild(this.#btn('Vider', () => { this.#api.clearItems(); this.#after() }, 'danger'))
    fs.appendChild(row3)

    this.#renderTarget()
    return fs
  }

  #renderTarget(): void {
    this.#targetWrap.innerHTML = ''
    const def = ITEM_POOL.find(i => i.id === this.#itemSelect.value)
    if (!def?.needsTarget) return

    const label = this.#el('span')
    label.textContent = def.needsTarget === 'column' ? 'Rouleau' : 'Symbole'
    this.#targetWrap.appendChild(label)

    const select = document.createElement('select')
    select.id = 'dbg-target'
    if (def.needsTarget === 'column') {
      for (let c = 0; c < this.#api.reelCount(); c++) {
        const opt = document.createElement('option')
        opt.value = String(c)
        opt.textContent = `R${c + 1}`
        select.appendChild(opt)
      }
    } else {
      for (const sym of SYMBOLS) {
        const opt = document.createElement('option')
        opt.value = sym.id
        opt.textContent = `${sym.emoji ?? ''} ${sym.id}`
        select.appendChild(opt)
      }
    }
    this.#targetWrap.appendChild(select)
  }

  #currentTarget(): number | string | null {
    const def = ITEM_POOL.find(i => i.id === this.#itemSelect.value)
    if (!def?.needsTarget) return null
    const select = this.#targetWrap.querySelector('select') as HTMLSelectElement | null
    if (!select) return null
    return def.needsTarget === 'column' ? Number(select.value) : select.value
  }

  #buildLuckSection(): HTMLElement {
    const fs = this.#fieldset('Chance')

    const mk = (label: string, key: 'rarityOverride' | 'cohesionOverride') => {
      const row = this.#el('div', 'dbg-row')
      const toggle = this.#btn(label, () => {
        const on = this.#api.state[key] !== null
        this.#api.state[key] = on ? null : Number(range.value)
        toggle.classList.toggle('on', !on)
        this.#after()
      })
      const range = document.createElement('input')
      range.type = 'range'; range.min = '0'; range.max = '100'; range.value = '0'
      const out = this.#el('span')
      out.textContent = '0'
      range.addEventListener('input', () => {
        out.textContent = range.value
        if (this.#api.state[key] !== null) this.#api.state[key] = Number(range.value)
        this.#after()
      })
      row.append(toggle, range, out)
      fs.appendChild(row)
    }
    mk('Convoitise', 'rarityOverride')
    mk('Régularité', 'cohesionOverride')

    const row = this.#el('div', 'dbg-row')
    const label = this.#el('span'); label.textContent = 'Gain ×'
    this.#winMultInput = this.#num(1)
    this.#winMultInput.addEventListener('change', () => {
      this.#api.state.winMultiplier = Number(this.#winMultInput.value) || 1
    })
    row.append(label, this.#winMultInput)
    row.appendChild(this.#btn('Gain forcé', () => {
      this.#api.forceWin(Number(this.#winMultInput.value) || 1)
      this.#after()
    }))
    fs.appendChild(row)
    return fs
  }

  #buildRunSection(): HTMLElement {
    const fs = this.#fieldset('Run')
    const row1 = this.#el('div', 'dbg-row')
    row1.appendChild(this.#btn('Compléter quota', () => { this.#api.completeQuota(); this.#after() }))
    row1.appendChild(this.#btn('Free spins ×5', () => this.#api.freeSpins(5)))
    fs.appendChild(row1)

    const row2 = this.#el('div', 'dbg-row')
    row2.appendChild(this.#btn('Victoire', () => this.#api.triggerVictory()))
    row2.appendChild(this.#btn('Défaite', () => this.#api.triggerGameOver(), 'danger'))
    fs.appendChild(row2)
    return fs
  }

  #buildSystemSection(): HTMLElement {
    const fs = this.#fieldset('Système')
    const row = this.#el('div', 'dbg-row')
    row.appendChild(this.#btn('Débloquer persos', () => { this.#api.unlockAllCharacters(); this.#after() }))
    row.appendChild(this.#btn('Effacer save', () => { this.#api.wipeSave() }, 'danger'))
    row.appendChild(this.#btn('Recharger', () => location.reload()))
    fs.appendChild(row)
    return fs
  }

  // ── Helpers ─────────────────────────────────────────────
  #after(): void { this.#api.refresh(); this.refresh() }

  #el(tag: string, cls = ''): HTMLElement {
    const el = document.createElement(tag)
    if (cls) el.className = cls
    return el
  }

  #fieldset(title: string): HTMLElement {
    const fs = document.createElement('fieldset')
    const legend = document.createElement('legend')
    legend.textContent = title
    fs.appendChild(legend)
    return fs
  }

  #btn(label: string, onClick: () => void, cls = ''): HTMLButtonElement {
    const b = document.createElement('button')
    b.textContent = label
    if (cls) b.className = cls
    b.addEventListener('click', onClick)
    return b
  }

  #num(value: number): HTMLInputElement {
    const input = document.createElement('input')
    input.type = 'number'
    input.value = String(value)
    return input
  }
}
