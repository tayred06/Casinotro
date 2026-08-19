import type { Souls } from '../types/index.ts'

/** Solde de départ d'un run. */
export const START_BALANCE: Souls = 100

/**
 * Le quota d'un palier s'exprime en multiples de sa mise minimale : la durée d'un palier
 * (≈ K / RTP spins) reste constante quelle que soit l'échelle des nombres.
 */
export const STAGE_QUOTA_K: [number, number, number] = [140, 180, 220]
/** Mise minimale de chaque palier — escalade ×3, pas ×25. */
export const STAGE_MIN_BETS: [Souls, Souls, Souls] = [1, 3, 8]
/** Facteur d'escalade de la mise minimale en mode infini. */
export const ENDLESS_BET_FACTOR = 3
/** Prime versée à chaque quota franchi, en fraction du quota. Finance le palier suivant. */
export const QUOTA_REWARD_FACTOR = 0.6
/** Durcissement du quota à chaque palier du mode infini (la mise monte déjà ×3). */
export const ENDLESS_GOAL_FACTOR = 1.5

/** Paliers de mise dérivés d'une mise minimale. */
export function betOptionsFor(min: Souls): Souls[] {
  return [min, min * 2, min * 3, min * 5, min * 10]
}

/** @deprecated conservé pour les sauvegardes antérieures à la refonte du quota. */
export const STAGE_GOALS: [Souls, Souls, Souls] = [500, 2000, 10000]
export const INITIAL_BET_OPTIONS: Souls[] = betOptionsFor(STAGE_MIN_BETS[0])

export class RunState {
  stage: 1 | 2 | 3 = 1
  betOptions: Souls[] = [...INITIAL_BET_OPTIONS]
  machineId = 'megaways'
  characterId = 'luxuria'
  spinCount = 0
  dialoguePlayed = false
  /** Quotas franchis au-delà du palier 3 (mode infini). 0 = run normal. */
  endlessLevel = 0

  get isEndless(): boolean {
    return this.endlessLevel > 0
  }

  /** Mise minimale du palier courant — unité dans laquelle s'exprime le quota. */
  get minBet(): Souls {
    return this.betOptions[0]
  }

  get currentGoal(): Souls {
    const k = STAGE_QUOTA_K[Math.min(this.stage, 3) - 1]
    const scale = this.endlessLevel > 0 ? ENDLESS_GOAL_FACTOR ** this.endlessLevel : 1
    return Math.round(k * this.minBet * scale)
  }

  /** Prime versée quand le quota courant est franchi. */
  get quotaReward(): Souls {
    return Math.round(this.currentGoal * QUOTA_REWARD_FACTOR)
  }

  /** Quota suivant en mode infini : objectif ×5 et paliers de mise rehaussés. */
  advanceEndless(): void {
    this.endlessLevel++
    this.betOptions = betOptionsFor(this.minBet * ENDLESS_BET_FACTOR)
  }

  advanceStage(): void {
    if (this.stage >= 3) return
    this.stage = (this.stage + 1) as 2 | 3
    this.betOptions = betOptionsFor(STAGE_MIN_BETS[this.stage - 1])
  }

  reset(characterId: string, machineId: string): void {
    this.stage = 1
    this.betOptions = [...INITIAL_BET_OPTIONS]
    this.characterId = characterId
    this.machineId = machineId
    this.spinCount = 0
    this.dialoguePlayed = false
    this.endlessLevel = 0
  }

  serialize() {
    return {
      stage: this.stage,
      betOptions: this.betOptions,
      machineId: this.machineId,
      characterId: this.characterId,
      spinCount: this.spinCount,
      dialoguePlayed: this.dialoguePlayed,
      endlessLevel: this.endlessLevel,
    }
  }

  restore(data: ReturnType<RunState['serialize']>): void {
    this.stage = data.stage ?? 1
    // Sauvegardes d'avant la refonte : les anciens paliers de mise (×25) sont abandonnés.
    const restored = data.betOptions ?? []
    this.betOptions = restored.length === 5 && restored[1] === restored[0] * 2 && restored[2] === restored[0] * 3
      ? [...restored]
      : betOptionsFor(STAGE_MIN_BETS[Math.min(this.stage, 3) - 1])
    this.machineId = data.machineId ?? 'megaways'
    this.characterId = data.characterId ?? 'luxuria'
    this.spinCount = data.spinCount ?? 0
    this.dialoguePlayed = data.dialoguePlayed ?? false
    this.endlessLevel = data.endlessLevel ?? 0
  }
}
