import type { Souls } from '../types/index.ts'

/** Paliers de mise par défaut. Figé : la table courante vit dans l'instance. */
export const DEFAULT_BET_OPTIONS: readonly Souls[] = Object.freeze([1, 2, 5, 10, 25])

const TARGET_RTP = 0.92

/** Source unique du meilleur score. `Progression` l'implémente et le persiste. */
export interface HighscoreStore {
  readonly highscore: Souls
  updateHighscore(value: Souls): void
}

/** Repli en mémoire quand aucun store n'est fourni (tests, simulations). */
class MemoryHighscore implements HighscoreStore {
  highscore: Souls = 0
  updateHighscore(value: Souls): void {
    if (value > this.highscore) this.highscore = value
  }
}

export class Economy {
  #balance: Souls
  #currentBet: Souls
  #totalEarned: Souls
  #stageEarned: Souls = 0
  #totalWagered: Souls = 0
  #totalReturned: Souls = 0
  #betOptions: Souls[]
  #highscoreStore: HighscoreStore

  constructor(startBalance: Souls = 100, highscoreStore: HighscoreStore = new MemoryHighscore()) {
    this.#betOptions = [...DEFAULT_BET_OPTIONS]
    this.#balance = startBalance
    this.#currentBet = this.#betOptions[0]
    this.#totalEarned = 0
    this.#highscoreStore = highscoreStore
  }

  get balance(): Souls { return this.#balance }
  get currentBet(): Souls { return this.#currentBet }
  get totalEarned(): Souls { return this.#totalEarned }
  /** Gains encaissés depuis l'entrée dans le palier courant — jauge de progression du quota. */
  get stageEarned(): Souls { return this.#stageEarned }
  get totalWagered(): Souls { return this.#totalWagered }
  get betOptions(): Souls[] { return [...this.#betOptions] }
  get minBet(): Souls { return Math.min(...this.#betOptions) }
  get highscore(): Souls { return this.#highscoreStore.highscore }

  get currentRTP(): number {
    return this.#totalWagered > 0 ? this.#totalReturned / this.#totalWagered : TARGET_RTP
  }

  /**
   * Correction douce vers le RTP cible, injectée comme biais de poids dans le tirage
   * des symboles. Invisible pour le joueur, et sans effet avant 50⛧ misés.
   */
  get rtpNudge(): number {
    if (this.#totalWagered < 50) return 0
    const nudge = (TARGET_RTP - this.currentRTP) * 2
    return Math.max(-0.3, Math.min(0.5, nudge))
  }

  setBet(amount: Souls): void {
    if (this.#betOptions.includes(amount)) this.#currentBet = amount
  }

  setBetOptions(options: Souls[]): void {
    this.#betOptions = [...options]
    if (!this.#betOptions.includes(this.#currentBet)) this.#currentBet = this.#betOptions[0]
  }

  /** Mise imposée hors paliers (escalade de Gula). */
  forceSetBet(amount: Souls): void {
    if (amount > 0) this.#currentBet = amount
  }

  placeBet(): boolean {
    if (this.#balance < this.#currentBet) return false
    this.#balance -= this.#currentBet
    this.#totalWagered += this.#currentBet
    return true
  }

  addWin(amount: Souls): void {
    this.#balance += amount
    this.#totalEarned += amount
    this.#stageEarned += amount
    this.#totalReturned += amount
    this.#highscoreStore.updateHighscore(this.#balance)
  }

  addMoney(amount: Souls): void {
    this.#balance += amount
  }

  /** Remet à zéro la jauge de quota — appelé quand un palier est franchi. */
  resetStageEarned(): void {
    this.#stageEarned = 0
  }

  /**
   * Niveau de boutique. Indexé sur le palier du run : les gains cumulés ne sont plus
   * un proxy fiable de l'avancement depuis que le quota se remplit en gains.
   */
  getShopLevel(stage?: number): 1 | 2 | 3 {
    if (stage !== undefined) return Math.min(3, Math.max(1, Math.round(stage))) as 1 | 2 | 3
    if (this.#totalEarned >= 2000) return 3
    if (this.#totalEarned >= 500) return 2
    return 1
  }

  canAfford(price: Souls): boolean {
    return this.#balance >= price
  }

  spend(amount: Souls): boolean {
    if (this.#balance < amount) return false
    this.#balance -= amount
    return true
  }

  isGameOver(): boolean {
    return this.#balance < this.minBet
  }

  debugSetEarned(amount: Souls): void { this.#totalEarned = amount }

  restart(startBalance: Souls = 100): void {
    this.#betOptions     = [...DEFAULT_BET_OPTIONS]
    this.#balance        = startBalance
    this.#currentBet     = this.#betOptions[0]
    this.#totalEarned    = 0
    this.#stageEarned    = 0
    this.#totalWagered   = 0
    this.#totalReturned  = 0
  }

  serialize() {
    return {
      balance:       this.#balance,
      currentBet:    this.#currentBet,
      totalEarned:   this.#totalEarned,
      stageEarned:   this.#stageEarned,
      totalWagered:  this.#totalWagered,
      totalReturned: this.#totalReturned,
      betOptions:    [...this.#betOptions],
    }
  }

  restore(data: ReturnType<Economy['serialize']>): void {
    this.#betOptions     = data.betOptions?.length ? [...data.betOptions] : [...DEFAULT_BET_OPTIONS]
    this.#balance        = data.balance       ?? 100
    this.#currentBet     = this.#betOptions.includes(data.currentBet) ? data.currentBet : this.#betOptions[0]
    this.#totalEarned    = data.totalEarned   ?? 0
    this.#stageEarned    = data.stageEarned   ?? 0
    this.#totalWagered   = data.totalWagered  ?? 0
    this.#totalReturned  = data.totalReturned ?? 0
  }
}
