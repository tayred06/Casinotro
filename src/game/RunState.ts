import type { Souls } from '../types/index.ts'

export const STAGE_GOALS: [Souls, Souls, Souls] = [500, 2000, 10000]
export const INITIAL_BET_OPTIONS: Souls[] = [1, 2, 5, 10, 25]

export class RunState {
  stage: 1 | 2 | 3 = 1
  stageGoals: [Souls, Souls, Souls] = [...STAGE_GOALS]
  betOptions: Souls[] = [...INITIAL_BET_OPTIONS]
  machineId = 'megaways'
  characterId = 'luxuria'
  spinCount = 0
  dialoguePlayed = false

  get currentGoal(): Souls {
    return this.stageGoals[this.stage - 1]
  }

  advanceStage(): void {
    if (this.stage >= 3) return
    const newMin = this.betOptions[this.betOptions.length - 1]
    this.betOptions = [
      newMin,
      newMin * 2,
      newMin * 5,
      newMin * 10,
      newMin * 25,
    ]
    this.stage = (this.stage + 1) as 2 | 3
  }

  reset(characterId: string, machineId: string): void {
    this.stage = 1
    this.stageGoals = [...STAGE_GOALS]
    this.betOptions = [...INITIAL_BET_OPTIONS]
    this.characterId = characterId
    this.machineId = machineId
    this.spinCount = 0
    this.dialoguePlayed = false
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
  }
}
