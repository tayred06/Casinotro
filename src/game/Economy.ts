import type { Souls } from '../types/index.ts'

/** Paliers de mise par défaut. Gelé : chaque Economy en garde sa propre copie. */
export const BET_OPTIONS: readonly Souls[] = Object.freeze([1, 2, 5, 10, 25])

const HIGHSCORE_KEY = 'casinotro_highscore'
const TARGET_RTP = 0.92

export class Economy {
  #balance: Souls
  #currentBet: Souls
  #totalEarned: Souls
  #highscore: Souls
  #totalWagered: Souls = 0
  #totalReturned: Souls = 0
  #betOptions: Souls[] = [...BET_OPTIONS]

  constructor(startBalance: Souls = 100) {
    this.#balance = startBalance
    this.#currentBet = this.#betOptions[0]
    this.#totalEarned = 0
    this.#highscore = this.#loadHighscore()
  }

  get balance(): Souls { return this.#balance }
  get currentBet(): Souls { return this.#currentBet }
  get betOptions(): Souls[] { return [...this.#betOptions] }
  get totalEarned(): Souls { return this.#totalEarned }
  get highscore(): Souls { return this.#highscore }
  get totalWagered(): Souls { return this.#totalWagered }

  get currentRTP(): number {
    return this.#totalWagered > 0 ? this.#totalReturned / this.#totalWagered : TARGET_RTP
  }

  get rtpNudge(): number {
    if (this.#totalWagered < 50) return 0
    const nudge = (TARGET_RTP - this.currentRTP) * 2
    return Math.max(-0.3, Math.min(0.5, nudge))
  }

  setBet(amount: Souls): void {
    if (this.#betOptions.includes(amount)) this.#currentBet = amount
  }

  setBetOptions(options: Souls[]): void {
    if (!options.length) return
    this.#betOptions = [...options]
    if (!this.#betOptions.includes(this.#currentBet)) this.#currentBet = this.#betOptions[0]
  }

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
    this.#totalReturned += amount
    if (this.#balance > this.#highscore) {
      this.#highscore = this.#balance
      this.#saveHighscore()
    }
  }

  addMoney(amount: Souls): void {
    this.#balance += amount
  }

  getShopLevel(): number {
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
    return this.#balance < Math.min(...this.#betOptions)
  }

  #saveHighscore(): void {
    try { localStorage.setItem(HIGHSCORE_KEY, String(this.#highscore)) } catch {}
  }

  #loadHighscore(): Souls {
    try { return Number(localStorage.getItem(HIGHSCORE_KEY)) || 0 } catch { return 0 }
  }

  saveHighscore(): void { this.#saveHighscore() }
  loadHighscore(): void { this.#highscore = this.#loadHighscore() }

  debugSetEarned(amount: Souls): void { this.#totalEarned = amount }

  restart(startBalance: Souls = 100): void {
    this.#balance        = startBalance
    this.#betOptions     = [...BET_OPTIONS]
    this.#currentBet     = this.#betOptions[0]
    this.#totalEarned    = 0
    this.#totalWagered   = 0
    this.#totalReturned  = 0
  }

  serialize(): Record<string, Souls> {
    return {
      balance:       this.#balance,
      currentBet:    this.#currentBet,
      totalEarned:   this.#totalEarned,
      highscore:     this.#highscore,
      totalWagered:  this.#totalWagered,
      totalReturned: this.#totalReturned,
    }
  }

  restore(data: Record<string, Souls>): void {
    this.#balance        = data.balance       ?? 100
    this.#currentBet     = this.#betOptions.includes(data.currentBet) ? data.currentBet : this.#betOptions[0]
    this.#totalEarned    = data.totalEarned   ?? 0
    this.#highscore      = data.highscore     ?? this.#loadHighscore()
    this.#totalWagered   = data.totalWagered  ?? 0
    this.#totalReturned  = data.totalReturned ?? 0
  }
}
