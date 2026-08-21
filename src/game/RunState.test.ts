import { describe, it, expect } from 'vitest'
import { RunState, STAGE_QUOTA_K, STAGE_MIN_BETS, INITIAL_BET_OPTIONS, MAX_BET_HP_RATIO, HP_HARD_CAP } from './RunState.ts'

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
    run.maxStage = STAGE_QUOTA_K.length          // Avaritia joue le palier 4
    const ratios: number[] = []
    for (let i = 0; i < STAGE_QUOTA_K.length; i++) {
      ratios.push(run.currentGoal / run.minBet)
      run.advanceStage()
    }
    expect(ratios).toEqual([...STAGE_QUOTA_K])
  })

  it('resserre la marge de vitalité palier après palier', () => {
    const run = new RunState()
    const margins: number[] = []
    for (let i = 0; i < 3; i++) {
      margins.push(run.hpCap / run.minBet)
      run.advanceStage()
    }
    // 175 → 100 → 75 mises minimales de marge : la pression monte.
    expect(margins[0]).toBeGreaterThan(margins[1])
    expect(margins[1]).toBeGreaterThan(margins[2])
  })

  it('garde l\'échelle de mise classique tant qu\'il y a un quota', () => {
    const run = new RunState()
    run.maxStage = 4
    for (let i = 0; i < 4; i++) {
      const min = run.betOptions[0]
      expect(run.betOptions).toEqual([min, min * 2, min * 3, min * 5, min * 10])
      run.advanceStage()
    }
  })

  it('en mode infini, la plus grosse mise vaut ~80 % de la vitalité maximale', () => {
    const run = new RunState()
    run.maxStage = 4
    run.advanceStage(); run.advanceStage(); run.advanceStage()
    run.enterEndless()

    expect(run.maxBet / run.hpCap).toBeCloseTo(MAX_BET_HP_RATIO, 1)
    expect([...run.betOptions].sort((a, b) => a - b)).toEqual(run.betOptions)
  })

  it("le mode infini rehausse la vitalité une seule fois, à l'entrée", () => {
    const run = new RunState()
    run.maxStage = 4
    run.advanceStage(); run.advanceStage(); run.advanceStage()

    run.enterEndless()
    const endlessCap = run.hpCap
    const endlessBets = run.betOptions

    run.enterEndless()
    run.enterEndless()
    // Vitalité et mises gelées ; et plus aucun quota à atteindre.
    expect(run.hpCap).toBe(endlessCap)
    expect(run.betOptions).toEqual(endlessBets)
    expect(run.currentGoal).toBe(Infinity)
  })

  it('borne la vitalité à HP_HARD_CAP', () => {
    const run = new RunState()
    run.maxStage = 4
    for (let i = 0; i < 4; i++) {
      expect(run.hpCap).toBeLessThanOrEqual(HP_HARD_CAP)
      run.advanceStage()
    }
    run.enterEndless()
    expect(run.hpCap).toBe(HP_HARD_CAP)
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
