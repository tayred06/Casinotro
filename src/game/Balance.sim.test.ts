import { describe, it, expect } from 'vitest'
import { spin, calculateWins } from './SlotMachine.ts'
import { getMachine } from './machines/index.ts'
import { Economy } from './Economy.ts'
import { RunState, START_BALANCE } from './RunState.ts'
import { seedRng } from '../utils/Random.ts'
import type { Modifiers } from '../types/index.ts'

/**
 * Garde-fou de durée de run. Sans lui, chaque retouche de paytable ou de quota fait
 * dériver la longueur d'une partie sans que rien n'échoue.
 *
 * Simulation volontairement nue : aucun achat boutique, aucun personnage, mise minimale.
 * C'est le plancher de difficulté — un joueur qui dépense bien fait mieux.
 */

const machine = getMachine('megaways')!

interface RunOutcome {
  spins: number
  won: boolean
  stageReached: number
}

function simulateRun(): RunOutcome {
  const run = new RunState()
  const economy = new Economy(START_BALANCE)
  economy.setBetOptions(run.betOptions)
  let spins = 0

  // Borne dure : un run qui dépasse ça signale un RTP effectif ≥ 1.
  while (spins < 5000) {
    if (economy.isGameOver()) return { spins, won: false, stageReached: run.stage }
    if (!economy.placeBet()) return { spins, won: false, stageReached: run.stage }
    spins++

    const luck = { rarity: 0, cohesion: 0, nudge: economy.rtpNudge }
    const { grid } = spin(machine, {}, luck as never, {} as never)
    const result = calculateWins(machine, grid, economy.currentBet, {} as Partial<Modifiers>)
    if (result.totalWin > 0) economy.addWin(result.totalWin)

    if (economy.stageEarned >= run.currentGoal) {
      economy.addMoney(run.quotaReward)
      economy.resetStageEarned()
      if (run.stage >= 3) return { spins, won: true, stageReached: 3 }
      run.advanceStage()
      economy.setBetOptions(run.betOptions)
    }
  }
  return { spins, won: true, stageReached: run.stage }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

describe('équilibrage — durée de run', () => {
  it('mise minimale, sans boutique : run long mais mortel', () => {
    seedRng(7)
    const runs: RunOutcome[] = []
    for (let i = 0; i < 200; i++) runs.push(simulateRun())

    const lengths = runs.map(r => r.spins)
    const winRate = runs.filter(r => r.won).length / runs.length
    const medianLen = median(lengths)

    console.log(
      `spins médian ${medianLen} · min ${Math.min(...lengths)} · max ${Math.max(...lengths)} · ` +
      `victoires ${(winRate * 100).toFixed(1)}% · palier moyen ` +
      `${(runs.reduce((a, r) => a + r.stageReached, 0) / runs.length).toFixed(2)}`
    )

    // ~4 s par spin : 300-700 spins ≈ 20-45 min.
    expect(medianLen).toBeGreaterThan(250)
    expect(medianLen).toBeLessThan(800)
    // Le run doit rester perdable sans être injouable.
    expect(winRate).toBeGreaterThan(0.05)
    expect(winRate).toBeLessThan(0.6)
  })
})
