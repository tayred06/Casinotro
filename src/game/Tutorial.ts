/**
 * Séquencement du tutoriel de première run. Logique pure : aucun DOM.
 * Chaque étape part une seule fois, sur son événement réel. L'affichage
 * (src/ui/TutorialUI.ts) signale les étapes montrées via markSeen().
 */
export const TUTORIAL_STEPS = ['mise', 'quota', 'vitalite', 'boutique', 'fusion', 'palier'] as const
export type TutorialStepId = typeof TUTORIAL_STEPS[number]

export type TutorialEvent =
  | { type: 'run_start' }
  | { type: 'spin_resolved'; won: boolean; canAffordOffer: boolean; fusionAvailable: boolean }
  | { type: 'shop_changed'; canAffordOffer: boolean; fusionAvailable: boolean }
  | { type: 'stage_reached'; stage: number }

/** Persistance du tuto. Progression l'implémente sur casinotro_meta_v2. */
export interface TutorialStore {
  readonly tutorialDone: boolean
  readonly tutorialSeen: ReadonlySet<string>
  saveTutorial(done: boolean, seen: readonly string[]): void
}

/** Repli en mémoire quand aucun store n'est fourni (tests). */
class MemoryTutorialStore implements TutorialStore {
  tutorialDone = false
  tutorialSeen: ReadonlySet<string> = new Set<string>()
  saveTutorial(done: boolean, seen: readonly string[]): void {
    this.tutorialDone = done
    this.tutorialSeen = new Set(seen)
  }
}

export class Tutorial {
  #store: TutorialStore
  #seen: Set<TutorialStepId>
  #done: boolean

  constructor(store: TutorialStore = new MemoryTutorialStore()) {
    this.#store = store
    this.#done = store.tutorialDone
    // Un id inconnu (étape renommée) est ignoré plutôt que de bloquer la fin du tuto.
    this.#seen = new Set(TUTORIAL_STEPS.filter(id => store.tutorialSeen.has(id)))
  }

  get done(): boolean { return this.#done }

  hasSeen(id: TutorialStepId): boolean { return this.#seen.has(id) }

  /** Étapes à montrer pour cet événement, dans l'ordre du tuto, déjà vues exclues. */
  notify(event: TutorialEvent): TutorialStepId[] {
    if (this.#done) return []
    const due = new Set<TutorialStepId>()
    switch (event.type) {
      case 'run_start':
        due.add('mise')
        break
      case 'spin_resolved':
        due.add('quota')
        if (!event.won) due.add('vitalite')
        if (event.canAffordOffer) due.add('boutique')
        if (event.fusionAvailable) due.add('fusion')
        break
      case 'shop_changed':
        if (event.canAffordOffer) due.add('boutique')
        if (event.fusionAvailable) due.add('fusion')
        break
      case 'stage_reached':
        if (event.stage >= 2) due.add('palier')
        break
    }
    return TUTORIAL_STEPS.filter(id => due.has(id) && !this.#seen.has(id))
  }

  /** L'étape a été affichée. Les six vues terminent le tuto. */
  markSeen(id: TutorialStepId): void {
    if (this.#done || this.#seen.has(id)) return
    this.#seen.add(id)
    if (TUTORIAL_STEPS.every(s => this.#seen.has(s))) this.#done = true
    this.#persist()
  }

  /** Bouton « Passer » : termine le tuto immédiatement. */
  skip(): void {
    if (this.#done) return
    this.#done = true
    this.#persist()
  }

  /** Relance depuis l'UI : tout redevient à voir. */
  reset(): void {
    this.#done = false
    this.#seen.clear()
    this.#persist()
  }

  #persist(): void {
    this.#store.saveTutorial(this.#done, [...this.#seen])
  }
}
