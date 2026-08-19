import { describe, it, expect } from 'vitest'
import { RunState, STAGE_QUOTA_K, STAGE_MIN_BETS, INITIAL_BET_OPTIONS } from './RunState.ts'

describe('RunState', () => {
  it('starts at stage 1 with default goals', () => {
    const run = new RunState()
    expect(run.stage).toBe(1)
    expect(run.currentGoal).toBe(STAGE_QUOTA_K[0] * STAGE_MIN_BETS[0])
    expect(run.betOptions).toEqual(INITIAL_BET_OPTIONS)
  })

  it('advanceStage goes to stage 2 and escalates bets', () => {
    const run = new RunState()
    run.advanceStage()
    expect(run.stage).toBe(2)
    expect(run.betOptions[0]).toBe(STAGE_MIN_BETS[1])
    expect(run.currentGoal).toBe(STAGE_QUOTA_K[1] * STAGE_MIN_BETS[1])
  })

  /** Le quota est indexé sur la mise mini : la durée d'un palier ne dépend pas de l'échelle. */
  it('garde un ratio quota / mise constant entre paliers', () => {
    const run = new RunState()
    const ratios: number[] = []
    for (let i = 0; i < 3; i++) {
      ratios.push(run.currentGoal / run.minBet)
      run.advanceStage()
    }
    expect(ratios).toEqual([...STAGE_QUOTA_K])
  })

  it('resserre la marge de vitalité palier après palier', () => {
    const run = new RunState()
    const margins: number[] = []
    for (let i = 0; i < 3; i++) {
      expect(run.hpCap).toBe(run.hpFloor * 2)
      margins.push(run.hpCap / run.minBet)
      run.advanceStage()
    }
    // 200 → 133 → 100 mises minimales de marge : la pression monte.
    expect(margins[0]).toBeGreaterThan(margins[1])
    expect(margins[1]).toBeGreaterThan(margins[2])
  })

  it('advanceStage from stage 3 does nothing', () => {
    const run = new RunState()
    run.advanceStage(); run.advanceStage(); run.advanceStage()
    expect(run.stage).toBe(3)
  })

  it('reset clears to initial state', () => {
    const run = new RunState()
    run.advanceStage()
    run.reset('gula', 'megaways')
    expect(run.stage).toBe(1)
    expect(run.betOptions).toEqual(INITIAL_BET_OPTIONS)
    expect(run.characterId).toBe('gula')
  })

  it('serialize / restore is symmetric', () => {
    const run = new RunState()
    run.advanceStage()
    run.spinCount = 42
    const data = run.serialize()
    const run2 = new RunState()
    run2.restore(data)
    expect(run2.stage).toBe(2)
    expect(run2.spinCount).toBe(42)
  })
})
