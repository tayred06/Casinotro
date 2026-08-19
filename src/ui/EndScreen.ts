export type EndOutcome = 'win' | 'lose'

export interface EndStat {
  k: string
  v: string
}

export interface EndScreenData {
  outcome: EndOutcome
  kicker: string
  title: string
  body: string
  stats: EndStat[]
  /** Victoire seulement : propose de poursuivre le run en mode infini. */
  canContinue?: boolean
}

/**
 * Écran de fin plein écran (victoire / défaite). Purement présentational :
 * GameLoop décide quand l'afficher et avec quelles stats.
 */
export class EndScreen {
  #overlay: HTMLElement
  #kicker: HTMLElement
  #title: HTMLElement
  #body: HTMLElement
  #stats: HTMLElement
  #replayBtn: HTMLButtonElement
  #continueBtn: HTMLButtonElement
  #open = false

  constructor(onReplay: () => void, onContinue: () => void = () => {}) {
    this.#overlay   = document.getElementById('end-screen-overlay')!
    this.#kicker    = document.getElementById('es-kicker')!
    this.#title     = document.getElementById('es-title')!
    this.#body      = document.getElementById('es-body')!
    this.#stats     = document.getElementById('es-stats')!
    this.#replayBtn = document.getElementById('es-replay-btn') as HTMLButtonElement

    this.#continueBtn = document.getElementById('es-continue-btn') as HTMLButtonElement

    this.#replayBtn.addEventListener('click', () => {
      this.hide()
      onReplay()
    })

    this.#continueBtn?.addEventListener('click', () => {
      this.hide()
      onContinue()
    })
  }

  get isOpen(): boolean { return this.#open }

  show(data: EndScreenData): void {
    this.#overlay.dataset.outcome = data.outcome
    this.#kicker.textContent = data.kicker
    this.#title.textContent  = data.title
    this.#body.textContent   = data.body
    this.#continueBtn?.classList.toggle('hidden', !data.canContinue)

    this.#stats.innerHTML = ''
    for (const stat of data.stats) {
      const cell = document.createElement('div')
      cell.className = 'es-stat'
      const k = document.createElement('div')
      k.className = 'es-stat-k'
      k.textContent = stat.k
      const v = document.createElement('div')
      v.className = 'es-stat-v'
      v.textContent = stat.v
      cell.append(k, v)
      this.#stats.appendChild(cell)
    }

    this.#overlay.classList.remove('hidden')
    this.#open = true
  }

  hide(): void {
    this.#overlay.classList.add('hidden')
    this.#open = false
  }
}
