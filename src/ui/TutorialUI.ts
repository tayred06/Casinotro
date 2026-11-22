import type { TutorialStepId } from '../game/Tutorial.ts'

export interface TutorialViewContext {
  /** Mise imposée par le personnage (Gula) : la bulle « mise » change de texte. */
  forcedBet: boolean
}

interface StepView {
  anchor: string
  title: string
  text: (ctx: TutorialViewContext) => string
}

const STEPS: Record<TutorialStepId, StepView> = {
  mise: {
    anchor: '#bet-chips',
    title: 'La mise',
    text: c => c.forcedBet
      ? 'Ta mise t\'est imposée et grimpe à chaque spin. Elle est retirée de ton solde avant que les rouleaux tournent.'
      : 'Choisis ta mise ici. Elle est retirée de ton solde à chaque spin ; plus elle est haute, plus les gains le sont.',
  },
  quota: {
    anchor: '#quota-label',
    title: 'Le quota',
    text: () => 'Le quota du palier se remplit avec tes gains, pas avec ton solde. Remplis-le pour passer au palier suivant.',
  },
  vitalite: {
    anchor: '#hp-fill',
    title: 'Ta vitalité',
    text: () => 'Ton solde est ta barre de vie. Chaque mise perdue l\'entame ; à zéro, la run est finie.',
  },
  boutique: {
    anchor: '#shop-items',
    title: 'La boutique',
    text: () => 'Tu peux t\'offrir un bonus. Il agit sur tous les spins suivants, dans la limite de tes emplacements.',
  },
  fusion: {
    anchor: '#shop-items',
    title: 'La fusion',
    text: () => 'Cette offre est le jumeau d\'un bonus que tu possèdes : l\'acheter le fait monter d\'une rareté et libère un emplacement.',
  },
  palier: {
    anchor: '#bet-chips',
    title: 'Palier franchi',
    text: () => 'Nouveau palier : mises plus hautes, quota plus gros, un emplacement de bonus en plus et une boutique renouvelée.',
  },
}

const GAP = 10

/**
 * Bulle non modale ancrée sur l'élément expliqué. File d'étapes : « Compris »
 * passe à la suivante. onShown signale chaque étape affichée (elle compte comme vue).
 */
export class TutorialUI {
  #bubble = document.getElementById('tutorial-bubble') as HTMLDivElement
  #title  = document.getElementById('tut-title') as HTMLSpanElement
  #text   = document.getElementById('tut-text') as HTMLParagraphElement
  #queue: TutorialStepId[] = []
  #current: TutorialStepId | null = null
  #suspended = false
  #ctx: TutorialViewContext = { forcedBet: false }
  #anchorEl: Element | null = null

  constructor(
    private onShown: (id: TutorialStepId) => void,
    private onSkip: () => void,
  ) {
    document.getElementById('tut-ok')?.addEventListener('click', () => this.#next())
    document.getElementById('tut-skip')?.addEventListener('click', () => {
      this.clear()
      this.onSkip()
    })
    window.addEventListener('resize', () => { if (this.#current) this.#position() })
  }

  /** Étape affichée en ce moment, null si aucune (utile aux tests). */
  get current(): TutorialStepId | null { return this.#current }

  enqueue(steps: TutorialStepId[], ctx: TutorialViewContext): void {
    this.#ctx = ctx
    for (const id of steps) {
      if (id !== this.#current && !this.#queue.includes(id)) this.#queue.push(id)
    }
    if (!this.#current) this.#next()
  }

  /** Vide la file et cache la bulle. */
  clear(): void {
    this.#queue = []
    this.#current = null
    this.#hide()
  }

  /** Masque la bulle sans perdre l'étape (ex. pendant le dialogue du croupier). */
  setSuspended(on: boolean): void {
    this.#suspended = on
    if (on) { this.#hide(); return }
    if (this.#current) this.#show()
    else this.#next()
  }

  #next(): void {
    this.#current = null
    if (this.#suspended) { this.#hide(); return }
    const id = this.#queue.shift()
    if (!id) { this.#hide(); return }
    this.#current = id
    this.#show()
    this.onShown(id)
  }

  #show(): void {
    if (!this.#current || this.#suspended) return
    const view = STEPS[this.#current]
    this.#title.textContent = view.title
    this.#text.textContent = view.text(this.#ctx)
    this.#anchorEl?.classList.remove('tut-anchor')
    this.#anchorEl = document.querySelector(view.anchor)
    this.#anchorEl?.classList.add('tut-anchor')
    this.#bubble.classList.remove('hidden')
    this.#position()
  }

  #hide(): void {
    this.#bubble.classList.add('hidden')
    this.#anchorEl?.classList.remove('tut-anchor')
    this.#anchorEl = null
  }

  /** Sous l'ancre si la place le permet, sinon au-dessus ; toujours dans la fenêtre. */
  #position(): void {
    const b = this.#bubble.getBoundingClientRect()
    const r = this.#anchorEl?.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    let top: number
    let left: number
    if (!r) {
      top = (vh - b.height) / 2
      left = (vw - b.width) / 2
    } else {
      top = r.bottom + GAP + b.height <= vh ? r.bottom + GAP : r.top - GAP - b.height
      left = r.left + r.width / 2 - b.width / 2
    }
    this.#bubble.style.top = `${Math.max(GAP, Math.min(top, vh - b.height - GAP))}px`
    this.#bubble.style.left = `${Math.max(GAP, Math.min(left, vw - b.width - GAP))}px`
  }
}
