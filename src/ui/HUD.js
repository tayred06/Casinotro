import { BET_OPTIONS } from '../game/Economy.js'

const GAME_NAMES = ['Trèfle', 'Carreau', 'Cœur', 'Pique', 'Joker']

export class HUD {
  #economy
  #onSpin
  #onBetChange

  #gameName
  #levelDisplay
  #goalDisplay
  #luckDisplay
  #progressFill
  #progressPct
  #balanceDisplay
  #highscoreDisplay
  #spinBtn
  #betChips = []

  constructor(economy, onSpin, onBetChange) {
    this.#economy     = economy
    this.#onSpin      = onSpin
    this.#onBetChange = onBetChange

    this.#gameName       = document.getElementById('game-name')
    this.#levelDisplay   = document.getElementById('level-display')
    this.#goalDisplay    = document.getElementById('goal-display')
    this.#luckDisplay    = document.getElementById('luck-display')
    this.#progressFill   = document.getElementById('progress-fill')
    this.#progressPct    = document.getElementById('progress-pct')
    this.#balanceDisplay = document.getElementById('balance-display')
    this.#highscoreDisplay = document.getElementById('highscore-display')
    this.#spinBtn        = document.getElementById('spin-btn')

    this.#spinBtn.addEventListener('click', () => this.#onSpin())

    this.#buildBetChips()
  }

  #buildBetChips() {
    const container = document.getElementById('bet-chips')
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

  update(runState = null, luck = 0) {
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

  setSpinEnabled(enabled) {
    this.#spinBtn.disabled = !enabled
  }

  setSpinLabel(label) {
    this.#spinBtn.textContent = label
  }
}
