import type { Souls } from '../types/index.ts'

/** Solde de départ d'un run. */
export const START_BALANCE: Souls = 100

/**
 * Le quota d'un palier s'exprime en multiples de sa mise minimale : la durée d'un palier
 * (≈ K / RTP spins) reste constante quelle que soit l'échelle des nombres.
 */
export const STAGE_QUOTA_K: [number, number, number, number] = [180, 235, 290, 345]
/** Mise minimale de chaque palier — escalade ×3, pas ×25. */
export const STAGE_MIN_BETS: [Souls, Souls, Souls, Souls] = [1, 3, 8, 24]
/** Facteur d'escalade de la mise minimale en mode infini. */
export const ENDLESS_BET_FACTOR = 3
/**
 * Vitalité : le solde est une barre de vie. On démarre un palier à son plancher et on ne
 * peut jamais dépasser son plafond — le trop-plein d'un gain part en crédit boutique.
 * La marge se resserre à chaque palier (200, puis 133, puis 100 mises minimales).
 */
export const STAGE_HP_FLOOR: [Souls, Souls, Souls, Souls] = [125, 250, 500, 1500]
export const STAGE_HP_CAP: [Souls, Souls, Souls, Souls] = [250, 500, 1000, 3000]
/** Durcissement du quota à chaque palier du mode infini (la mise monte déjà ×3). */
export const ENDLESS_GOAL_FACTOR = 1.5

/** Paliers de mise dérivés d'une mise minimale. */
export function betOptionsFor(min: Souls): Souls[] {
  return [min, min * 2, min * 3, min * 5, min * 10]
}

/** @deprecated conservé pour les sauvegardes antérieures à la refonte du quota. */
export const STAGE_GOALS: [Souls, Souls, Souls] = [500, 2000, 10000]
export const INITIAL_BET_OPTIONS: Souls[] = betOptionsFor(STAGE_MIN_BETS[0])

/** Nombre de paliers par défaut. Avaritia en joue un de plus (voir `maxStage`). */
export const DEFAULT_MAX_STAGE = 3
export const MAX_STAGE_CAP = 4

export class RunState {
  stage: 1 | 2 | 3 | 4 = 1
  /**
   * Nombre de paliers du run. 3 pour tout le monde ; 4 pour Avaritia, dont la
   * boutique ne s'ouvre en entier qu'au dernier palier.
   */
  maxStage: number = DEFAULT_MAX_STAGE
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
    const k = STAGE_QUOTA_K[Math.min(this.stage, MAX_STAGE_CAP) - 1]
    const scale = this.endlessLevel > 0 ? ENDLESS_GOAL_FACTOR ** this.endlessLevel : 1
    return Math.round(k * this.minBet * scale)
  }

  /** Plancher de vitalité à l'entrée du palier. */
  get hpFloor(): Souls {
    return STAGE_HP_FLOOR[Math.min(this.stage, MAX_STAGE_CAP) - 1] * this.#endlessHpScale
  }

  /** Plafond de vitalité du palier — le solde ne monte jamais au-dessus. */
  get hpCap(): Souls {
    return STAGE_HP_CAP[Math.min(this.stage, MAX_STAGE_CAP) - 1] * this.#endlessHpScale
  }

  get #endlessHpScale(): number {
    return this.endlessLevel > 0 ? ENDLESS_BET_FACTOR ** this.endlessLevel : 1
  }

  /** Quota suivant en mode infini : objectif ×5 et paliers de mise rehaussés. */
  advanceEndless(): void {
    this.endlessLevel++
    this.betOptions = betOptionsFor(this.minBet * ENDLESS_BET_FACTOR)
  }

  /** Dernier palier du run : au-delà, c'est la victoire ou le mode infini. */
  get isFinalStage(): boolean {
    return this.stage >= this.maxStage
  }

  advanceStage(): void {
    if (this.isFinalStage) return
    this.stage = (this.stage + 1) as 2 | 3 | 4
    this.betOptions = betOptionsFor(STAGE_MIN_BETS[this.stage - 1])
  }

  reset(characterId: string, machineId: string, maxStage: number = DEFAULT_MAX_STAGE): void {
    this.stage = 1
    this.maxStage = Math.min(MAX_STAGE_CAP, Math.max(1, Math.round(maxStage)))
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
      maxStage: this.maxStage,
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
    this.maxStage = data.maxStage ?? DEFAULT_MAX_STAGE
    // Sauvegardes d'avant la refonte : les anciens paliers de mise (×25) sont abandonnés.
    const restored = data.betOptions ?? []
    this.betOptions = restored.length === 5 && restored[1] === restored[0] * 2 && restored[2] === restored[0] * 3
      ? [...restored]
      : betOptionsFor(STAGE_MIN_BETS[Math.min(this.stage, MAX_STAGE_CAP) - 1])
    this.machineId = data.machineId ?? 'megaways'
    this.characterId = data.characterId ?? 'luxuria'
    this.spinCount = data.spinCount ?? 0
    this.dialoguePlayed = data.dialoguePlayed ?? false
    this.endlessLevel = data.endlessLevel ?? 0
  }
}
