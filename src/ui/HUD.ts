import { BET_OPTIONS } from '../game/Economy.ts'
import type { Economy } from '../game/Economy.ts'

const GAME_NAMES = ['Trèfle', 'Carreau', 'Cœur', 'Pique', 'Joker']

interface RunState {
  level: number
  goal: number
}

export class HUD {
  #economy: Economy
  #onSpin: () => void
  #onBetChange: (amount: number) => void

  #gameName: HTMLElement
  #levelDisplay: HTMLElement
  #goalDisplay: HTMLElement
  #luckDisplay: HTMLElement
  #progressFill: HTMLElement
  #progressPct: HTMLElement
  #balanceDisplay: HTMLElement
  #highscoreDisplay: HTMLElement
  #spinBtn: HTMLButtonElement
  #betChips: Array<{ btn: HTMLButtonElement; amount: number }> = []

  constructor(economy: Economy, onSpin: () => void, onBetChange: (amount: number) => void) {
    this.#economy     = economy
    this.#onSpin      = onSpin
    this.#onBetChange = onBetChange

    this.#gameName       = document.getElementById('game-name')!
    this.#levelDisplay   = document.getElementById('level-display')!
    this.#goalDisplay    = document.getElementById('goal-display')!
    this.#luckDisplay    = document.getElementById('luck-display')!
    this.#progressFill   = document.getElementById('progress-fill')!
    this.#progressPct    = document.getElementById('progress-pct')!
    this.#balanceDisplay = document.getElementById('balance-display')!
    this.#highscoreDisplay = document.getElementById('highscore-display')!
    this.#spinBtn        = document.getElementById('spin-btn') as HTMLButtonElement

    this.#spinBtn.addEventListener('click', () => this.#onSpin())

    this.#buildBetChips()
  }

  #buildBetChips() {
    const container = document.getElementById('bet-chips')!
    container.textContent = ''
    this.#betChips = []

    BET_OPTIONS.forEach(amount => {
      const btn = document.createElement('button')
      btn.className = 'chip'
      btn.textContent = `$${amount}`
      btn.addEventListener('click', () => {
        this.#onBetChange(amount)
        this.#updateChipState()
      })
      container.appendChild(btn)
      this.#betChips.push({ btn, amount })
    })
  }

  #updateChipState() {
    const current = this.#economy.currentBet
    this.#betChips.forEach(({ btn, amount }) => {
      btn.classList.toggle('active', amount === current)
    })
  }

  update(runState: RunState | null = null, luck: number = 0) {
    this.#balanceDisplay.textContent  = `$${this.#economy.balance.toFixed(2)}`
    this.#highscoreDisplay.textContent = `$${this.#economy.highscore.toFixed(2)}`
    this.#luckDisplay.textContent = luck > 0 ? `+${luck}` : String(luck)
    this.#luckDisplay.style.color = luck > 0 ? '#c9a24a' : ''
    this.#updateChipState()

    if (runState) {
      const { level, goal } = runState
      this.#gameName.textContent     = GAME_NAMES[(level - 1) % GAME_NAMES.length]
      this.#levelDisplay.textContent = String(level)
      this.#goalDisplay.textContent  = `$${goal}`

      const balance = this.#economy.balance
      const pct     = Math.min(100, Math.round((balance / goal) * 100))
      this.#progressFill.style.width      = pct + '%'
      this.#progressPct.textContent       = pct + '%'
    }
  }

  setSpinEnabled(enabled: boolean) {
    this.#spinBtn.disabled = !enabled
  }

  setSpinLabel(label: string) {
    this.#spinBtn.textContent = label
  }

  showEscalatingBet(amount: number, nextIncrement: number | null = null) {
    const container = document.getElementById('bet-chips')!
    container.textContent = ''

    const fmt = (n: number) => `$${n % 1 === 0 ? n : n.toFixed(2)}`

    const display = document.createElement('span')
    display.id = 'gula-bet-display'
    display.className = 'chip active'
    display.style.pointerEvents = 'none'
    display.style.minWidth = '72px'
    display.textContent = fmt(amount)
    container.appendChild(display)

    if (nextIncrement !== null) {
      const next = document.createElement('span')
      next.className = 'chip'
      next.style.pointerEvents = 'none'
      next.style.color = '#b7534f'
      next.style.borderColor = 'rgba(183,83,79,.35)'
      next.style.fontSize = '11px'
      next.textContent = `+${fmt(nextIncrement)}`
      container.appendChild(next)
    }
  }

  restoreBetChips() {
    this.#buildBetChips()
    this.#updateChipState()
  }
}
