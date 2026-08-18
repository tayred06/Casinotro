import { ITEM_POOL as BONUS_POOL } from '../game/items/index.ts'
import { SYMBOLS } from '../game/Symbols.js'

const SYMBOL_IDS = SYMBOLS.filter(s => s.id !== 'wild' && s.id !== 'scatter').map(s => s.id)

const CSS = `
  #debug-panel {
    position: fixed;
    top: 0; left: 0;
    width: 280px;
    height: 100vh;
    background: rgba(20, 0, 0, 0.93);
    border-right: 2px solid #ff4400;
    color: #ffaa88;
    font-family: monospace;
    font-size: 13px;
    overflow-y: auto;
    z-index: 9999;
    padding: 12px;
    box-sizing: border-box;
    display: none;
  }
  #debug-panel.open { display: block; }
  #debug-panel h2 {
    color: #ff4400;
    margin: 0 0 12px;
    font-size: 15px;
    letter-spacing: 2px;
    border-bottom: 1px solid #ff4400;
    padding-bottom: 6px;
  }
  #debug-panel h3 {
    color: #ff8866;
    font-size: 12px;
    margin: 14px 0 6px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  #debug-panel .row {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-bottom: 6px;
  }
  #debug-panel input[type=number], #debug-panel select {
    background: #1a0000;
    border: 1px solid #ff4400;
    color: #ffaa88;
    font-family: monospace;
    font-size: 12px;
    padding: 3px 5px;
    flex: 1;
    min-width: 0;
  }
  #debug-panel button {
    background: #5a0000;
    border: 1px solid #ff4400;
    color: #ffaa88;
    font-family: monospace;
    font-size: 12px;
    padding: 4px 8px;
    cursor: pointer;
    white-space: nowrap;
  }
  #debug-panel button:hover { background: #8a0000; }
  #debug-panel button.wide { width: 100%; margin-bottom: 4px; }
  #debug-panel .hint {
    color: #885544;
    font-size: 11px;
    margin-top: 16px;
    border-top: 1px solid #330000;
    padding-top: 8px;
  }
  #debug-toggle {
    position: fixed;
    top: 6px; left: 6px;
    background: #5a0000;
    border: 1px solid #ff4400;
    color: #ff4400;
    font-family: monospace;
    font-size: 11px;
    padding: 2px 6px;
    cursor: pointer;
    z-index: 10000;
  }
`

export class DebugPanel {
  #economy
  #bonusSystem
  #hud
  #shop
  #onFreeSpins
  #panel
  #open = false

  constructor({ economy, bonusSystem, hud, shop, onFreeSpins }) {
    this.#economy = economy
    this.#bonusSystem = bonusSystem
    this.#hud = hud
    this.#shop = shop
    this.#onFreeSpins = onFreeSpins

    this.#inject()
  }

  #inject() {
    const style = document.createElement('style')
    style.textContent = CSS
    document.head.appendChild(style)

    const toggle = document.createElement('button')
    toggle.id = 'debug-toggle'
    toggle.textContent = '🐛 DEBUG'
    toggle.addEventListener('click', () => this.#togglePanel())
    document.body.appendChild(toggle)

    this.#panel = document.createElement('div')
    this.#panel.id = 'debug-panel'
    this.#panel.innerHTML = this.#buildHTML()
    document.body.appendChild(this.#panel)

    this.#bindEvents()

    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault()
        this.#togglePanel()
      }
    })
  }

  #togglePanel() {
    this.#open = !this.#open
    this.#panel.classList.toggle('open', this.#open)
  }

  #buildHTML() {
    // Static template only — bonus <select> options are populated via DOM in #bindEvents
    return `
      <h2>⚠ DEBUG MODE</h2>

      <h3>💰 Argent</h3>
      <div class="row">
        <input type="number" id="dbg-money-amount" value="500" min="1" step="50">
        <button id="dbg-add-money">+ Ajouter</button>
      </div>
      <div class="row">
        <button class="wide" id="dbg-set-1000">Mettre $1 000</button>
      </div>
      <div class="row">
        <button class="wide" id="dbg-set-10000">Mettre $10 000</button>
      </div>

      <h3>🏪 Niveau boutique</h3>
      <div class="row">
        <button id="dbg-lvl1">Niv 1</button>
        <button id="dbg-lvl2">Niv 2</button>
        <button id="dbg-lvl3">Niv 3</button>
      </div>

      <h3>🎁 Ajouter un bonus</h3>
      <div class="row">
        <select id="dbg-bonus-select"></select>
      </div>
      <div class="row">
        <button class="wide" id="dbg-add-bonus">Injecter le bonus</button>
      </div>
      <button class="wide" id="dbg-clear-bonuses">🗑 Vider tous les bonus</button>

      <h3>🎰 Free Spins</h3>
      <div class="row">
        <input type="number" id="dbg-freespins-count" value="5" min="1" max="50">
        <button id="dbg-trigger-freespins">Lancer</button>
      </div>

      <div class="hint">Ctrl+D pour toggle • Dev only</div>
    `
  }

  #populateBonusSelect(select) {
    for (const b of BONUS_POOL) {
      const opt = document.createElement('option')
      opt.value = b.id
      opt.textContent = `[Niv${b.level}] ${b.name}`
      select.appendChild(opt)
    }
  }

  #bindEvents() {
    const p = this.#panel
    this.#populateBonusSelect(p.querySelector('#dbg-bonus-select'))

    p.querySelector('#dbg-add-money').addEventListener('click', () => {
      const amount = Number(p.querySelector('#dbg-money-amount').value)
      if (amount > 0) {
        this.#economy.addMoney(amount)
        this.#refresh()
      }
    })

    p.querySelector('#dbg-set-1000').addEventListener('click', () => {
      this.#economy.addMoney(1000 - this.#economy.balance)
      this.#refresh()
    })

    p.querySelector('#dbg-set-10000').addEventListener('click', () => {
      this.#economy.addMoney(10000 - this.#economy.balance)
      this.#refresh()
    })

    const levelEarned = { 1: 0, 2: 500, 3: 2000 }
    for (const lvl of [1, 2, 3]) {
      p.querySelector(`#dbg-lvl${lvl}`).addEventListener('click', () => {
        this.#economy.debugSetEarned(levelEarned[lvl])
        this.#shop.refresh()
      })
    }

    p.querySelector('#dbg-add-bonus').addEventListener('click', () => {
      if (this.#bonusSystem.isFull) { alert('Bonus slots full (max 5)'); return }
      const id = p.querySelector('#dbg-bonus-select').value
      const def = BONUS_POOL.find(b => b.id === id)
      if (!def) return
      let target = null
      if (def.needsTarget === 'column') target = Math.floor(Math.random() * 6)
      else if (def.needsTarget === 'symbol') target = SYMBOL_IDS[Math.floor(Math.random() * SYMBOL_IDS.length)]
      this.#bonusSystem.addBonus(def, target)
      this.#refresh()
    })

    p.querySelector('#dbg-clear-bonuses').addEventListener('click', () => {
      for (const b of [...this.#bonusSystem.activeBonus]) {
        this.#bonusSystem.removeBonus(b.instanceId)
      }
      this.#refresh()
    })

    p.querySelector('#dbg-trigger-freespins').addEventListener('click', () => {
      const count = Math.max(1, Number(p.querySelector('#dbg-freespins-count').value))
      this.#onFreeSpins(count)
    })
  }

  #refresh() {
    this.#hud.update()
    this.#shop.refresh()
  }
}
