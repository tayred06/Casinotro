import type { Economy } from '../game/Economy.ts'
import { souls } from '../utils/format.ts'

const GAME_NAMES = ['Trèfle', 'Carreau', 'Cœur', 'Pique', 'Joker']

interface RunState {
  level: number
  goal: number
  /** Gains encaissés dans le palier — la jauge de quota, distincte du solde. */
  progress?: number
  /** Mode infini : plus de quota, la carte affiche les gains cumulés. */
  endless?: boolean
  /** Gains cumulés du run — score affiché en mode infini. */
  totalEarned?: number
}

/** Les deux axes de chance affichés dans le HUD. */
interface LuckDisplay {
  rarity: number
  cohesion: number
}

export class HUD {
  #economy: Economy
  #onSpin: () => void
  #onBetChange: (amount: number) => void

  #gameName: HTMLElement
  #quotaLabel: HTMLElement | null
  #goalDisplay: HTMLElement
  #luckDisplay: HTMLElement
  #cohesionDisplay: HTMLElement
  #progressFill: HTMLElement
  #progressPct: HTMLElement
  #balanceDisplay: HTMLElement
  #hpFill: HTMLElement | null = null
  #hpBar: HTMLElement | null = null
  #hpMax: HTMLElement | null = null
  #creditDisplay: HTMLElement | null = null
  #lastCredit = 0
  #highscoreDisplay: HTMLElement
  #spinBtn: HTMLButtonElement
  #betChips: Array<{ btn: HTMLButtonElement; amount: number }> = []

  constructor(economy: Economy, onSpin: () => void, onBetChange: (amount: number) => void) {
    this.#economy     = economy
    this.#onSpin      = onSpin
    this.#onBetChange = onBetChange

    this.#gameName       = document.getElementById('game-name')!
    this.#quotaLabel     = document.getElementById('quota-label')
    this.#goalDisplay    = document.getElementById('goal-display')!
    this.#luckDisplay    = document.getElementById('luck-display')!
    this.#cohesionDisplay = document.getElementById('cohesion-display')!
    this.#progressFill   = document.getElementById('progress-fill')!
    this.#progressPct    = document.getElementById('progress-pct')!
    this.#balanceDisplay = document.getElementById('balance-display')!
    this.#hpFill         = document.getElementById('hp-fill')
    this.#hpBar          = this.#hpFill?.parentElement ?? null
    this.#hpMax          = document.getElementById('hp-max')
    this.#creditDisplay  = document.getElementById('credit-display')
    this.#highscoreDisplay = document.getElementById('highscore-display')!
    this.#spinBtn        = document.getElementById('spin-btn') as HTMLButtonElement

    this.#spinBtn.addEventListener('click', () => this.#onSpin())

    this.#buildBetChips()
  }

  /** Reconstruit les jetons — à appeler à chaque changement de paliers de mise. */
  rebuildBetChips() { this.#buildBetChips() }

  #buildBetChips() {
    const container = document.getElementById('bet-chips')!
    container.textContent = ''
    this.#betChips = []

    this.#economy.betOptions.forEach(amount => {
      const btn = document.createElement('button')
      btn.className = 'chip'
      btn.textContent = souls(amount)
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

  #setStat(el: HTMLElement | null, icon: string, value: number): void {
    if (!el) return
    el.textContent = `${icon}${value > 0 ? '+' : ''}${value}`
    el.style.color = value > 0 ? '#b6f36a' : ''
  }

  /**
   * Le solde est une barre de vie : remplissage sur le plafond du palier, couleur qui
   * vire à l'orange puis au rouge quand ça descend.
   */
  #renderVitality() {
    const cap = this.#economy.maxBalance
    if (!this.#hpFill || !isFinite(cap) || cap <= 0) return

    const ratio = Math.max(0, Math.min(1, this.#economy.balance / cap))
    this.#hpFill.style.width = (ratio * 100).toFixed(1) + '%'
    this.#hpBar?.classList.toggle('low', ratio <= 0.5 && ratio > 0.2)
    this.#hpBar?.classList.toggle('crit', ratio <= 0.2)

    if (this.#hpMax) this.#hpMax.textContent = `/ ${souls(cap)}`
    const credit = this.#economy.shopCredit
    if (this.#creditDisplay) {
      this.#creditDisplay.classList.toggle('hidden', credit <= 0)
      this.#creditDisplay.textContent = `+${souls(credit)} crédit`
      if (credit > this.#lastCredit) {
        this.#creditDisplay.classList.remove('bump')
        void this.#creditDisplay.offsetWidth
        this.#creditDisplay.classList.add('bump')
      }
      this.#lastCredit = credit
    }
  }

  update(runState: RunState | null = null, luck: LuckDisplay = { rarity: 0, cohesion: 0 }) {
    this.#balanceDisplay.textContent  = souls(this.#economy.balance)
    this.#renderVitality()
    this.#highscoreDisplay.textContent = souls(this.#economy.highscore)
    this.#setStat(this.#luckDisplay, '★', luck.rarity)
    this.#setStat(this.#cohesionDisplay, '≡', luck.cohesion)
    this.#updateChipState()

    if (runState) {
      const { level, goal, progress, endless, totalEarned } = runState
      this.#gameName.textContent = GAME_NAMES[(level - 1) % GAME_NAMES.length]

      // Mode infini : aucun quota à remplir, la carte devient un compteur de gains.
      if (endless) {
        if (this.#quotaLabel) this.#quotaLabel.textContent = 'Mode infini — gains cumulés'
        this.#goalDisplay.textContent  = souls(totalEarned ?? 0)
        this.#progressPct.textContent  = ''
        this.#progressFill.style.width = '100%'
        return
      }

      if (this.#quotaLabel) {
        this.#quotaLabel.innerHTML = `Manche <span id="level-display">${level}</span> — quota`
      }
      this.#goalDisplay.textContent = souls(goal)

      const earned = progress ?? 0
      const pct    = Math.min(100, Math.round((earned / goal) * 100))
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

    const fmt = (n: number) => souls(n)

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
      next.style.color = '#ff2d55'
      next.style.borderColor = 'rgba(255,45,85,.35)'
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
