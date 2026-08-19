import type { Souls } from '../types/index.ts'

/** Solde de départ d'un run. */
export const START_BALANCE: Souls = 100

export const STAGE_GOALS: [Souls, Souls, Souls] = [500, 2000, 10000]
export const INITIAL_BET_OPTIONS: Souls[] = [1, 2, 5, 10, 25]
/** Multiplicateur du quota à chaque palier du mode infini. */
export const ENDLESS_GOAL_FACTOR = 5

export class RunState {
  stage: 1 | 2 | 3 = 1
  stageGoals: [Souls, Souls, Souls] = [...STAGE_GOALS]
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

  get currentGoal(): Souls {
    if (this.endlessLevel > 0) return this.stageGoals[2] * ENDLESS_GOAL_FACTOR ** this.endlessLevel
    return this.stageGoals[this.stage - 1]
  }

  /** Quota suivant en mode infini : objectif ×5 et paliers de mise rehaussés. */
  advanceEndless(): void {
    this.endlessLevel++
    this.#scaleBetOptions()
  }

  advanceStage(): void {
    if (this.stage >= 3) return
    this.#scaleBetOptions()
    this.stage = (this.stage + 1) as 2 | 3
  }

  #scaleBetOptions(): void {
    const newMin = this.betOptions[this.betOptions.length - 1]
    this.betOptions = [
      newMin,
      newMin * 2,
      newMin * 5,
      newMin * 10,
      newMin * 25,
    ]
  }

  reset(characterId: string, machineId: string): void {
    this.stage = 1
    this.stageGoals = [...STAGE_GOALS]
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
      stageGoals: this.stageGoals,
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
    this.stageGoals = data.stageGoals ?? [...STAGE_GOALS]
    this.betOptions = data.betOptions ?? [...INITIAL_BET_OPTIONS]
    this.machineId = data.machineId ?? 'megaways'
    this.characterId = data.characterId ?? 'luxuria'
    this.spinCount = data.spinCount ?? 0
    this.dialoguePlayed = data.dialoguePlayed ?? false
    this.endlessLevel = data.endlessLevel ?? 0
  }
}
