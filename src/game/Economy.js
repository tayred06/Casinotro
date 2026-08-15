export const BET_OPTIONS = [1, 2, 5, 10, 25]

const HIGHSCORE_KEY = 'casinotro_highscore'
const TARGET_RTP = 0.92

export class Economy {
  #balance
  #currentBet
  #totalEarned
  #highscore
  #totalWagered = 0
  #totalReturned = 0

  constructor(startBalance = 100) {
    this.#balance = startBalance
    this.#currentBet = BET_OPTIONS[0]
    this.#totalEarned = 0
    this.#highscore = this.#loadHighscore()
  }

  get balance() { return this.#balance }
  get currentBet() { return this.#currentBet }
  get totalEarned() { return this.#totalEarned }
  get highscore() { return this.#highscore }
  get totalWagered() { return this.#totalWagered }

  get currentRTP() {
    return this.#totalWagered > 0 ? this.#totalReturned / this.#totalWagered : TARGET_RTP
  }

  get rtpNudge() {
    if (this.#totalWagered < 50) return 0
    const nudge = (TARGET_RTP - this.currentRTP) * 2
    return Math.max(-0.3, Math.min(0.5, nudge))
  }

  setBet(amount) {
    if (BET_OPTIONS.includes(amount)) this.#currentBet = amount
  }

  placeBet() {
    if (this.#balance < this.#currentBet) return false
    this.#balance -= this.#currentBet
    this.#totalWagered += this.#currentBet
    return true
  }

  addWin(amount) {
    this.#balance += amount
    this.#totalEarned += amount
    this.#totalReturned += amount
    if (this.#balance > this.#highscore) {
      this.#highscore = this.#balance
      this.#saveHighscore()
    }
  }

  addMoney(amount) {
    this.#balance += amount
  }

  getShopLevel() {
    if (this.#totalEarned >= 2000) return 3
    if (this.#totalEarned >= 500) return 2
    return 1
  }

  canAfford(price) {
    return this.#balance >= price
  }

  spend(amount) {
    if (this.#balance < amount) return false
    this.#balance -= amount
    return true
  }

  isGameOver() {
    return this.#balance < Math.min(...BET_OPTIONS)
  }

  #saveHighscore() {
    try { localStorage.setItem(HIGHSCORE_KEY, String(this.#highscore)) } catch {}
  }

  #loadHighscore() {
    try { return Number(localStorage.getItem(HIGHSCORE_KEY)) || 0 } catch { return 0 }
  }

  saveHighscore() { this.#saveHighscore() }
  loadHighscore() { this.#highscore = this.#loadHighscore() }

  debugSetEarned(amount) { this.#totalEarned = amount }

  restart(startBalance = 100) {
    this.#balance        = startBalance
    this.#currentBet     = BET_OPTIONS[0]
    this.#totalEarned    = 0
    this.#totalWagered   = 0
    this.#totalReturned  = 0
  }

  serialize() {
    return {
      balance:       this.#balance,
      currentBet:    this.#currentBet,
      totalEarned:   this.#totalEarned,
      highscore:     this.#highscore,
      totalWagered:  this.#totalWagered,
      totalReturned: this.#totalReturned,
    }
  }

  restore(data) {
    this.#balance        = data.balance       ?? 100
    this.#currentBet     = BET_OPTIONS.includes(data.currentBet) ? data.currentBet : BET_OPTIONS[0]
    this.#totalEarned    = data.totalEarned   ?? 0
    this.#highscore      = data.highscore     ?? this.#loadHighscore()
    this.#totalWagered   = data.totalWagered  ?? 0
    this.#totalReturned  = data.totalReturned ?? 0
  }
}
