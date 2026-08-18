import { describe, it, expect } from 'vitest'
import { RunState, STAGE_GOALS, INITIAL_BET_OPTIONS } from './RunState.ts'

describe('RunState', () => {
  it('starts at stage 1 with default goals', () => {
    const run = new RunState()
    expect(run.stage).toBe(1)
    expect(run.currentGoal).toBe(500)
    expect(run.betOptions).toEqual([1, 2, 5, 10, 25])
  })

  it('advanceStage goes to stage 2 and escalates bets', () => {
    const run = new RunState()
    run.advanceStage()
    expect(run.stage).toBe(2)
    expect(run.betOptions[0]).toBe(25) // max of stage 1 = new min
    expect(run.currentGoal).toBe(2000)
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
    expect(run.betOptions).toEqual([1, 2, 5, 10, 25])
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
