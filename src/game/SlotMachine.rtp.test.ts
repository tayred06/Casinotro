import { describe, it, expect, afterEach } from 'vitest'
import { spin, calculateWins } from './SlotMachine.ts'
import { playableMachines } from './machines/index.ts'
import { seedRng, setRng } from '../utils/Random.ts'
import type { MachineConfig } from '../types/index.ts'

const SPINS = 100_000
const SEEDS = [1, 7, 99]
const FREE_SPINS = 8

/**
 * Mesure le RTP de base d'une machine : mise de 1 par spin, plus les free spins
 * offerts par le scatter (gratuits, donc du retour pur). Aucun bonus de boutique —
 * les items sont la progression roguelike et poussent le RTP au-dessus de la cible
 * de façon assumée.
 */
function measureRTP(machine: MachineConfig, seed: number): number {
  seedRng(seed)
  let wagered = 0
  let returned = 0

  for (let i = 0; i < SPINS; i++) {
    wagered += 1
    const { grid } = spin(machine)
    const result = calculateWins(machine, grid, 1)
    returned += result.totalWin

    if (result.scatterTriggered) {
      for (let f = 0; f < FREE_SPINS; f++) {
        returned += calculateWins(machine, spin(machine).grid, 1).totalWin
      }
    }
  }

  return returned / wagered
}

afterEach(() => setRng(null))

// Seules les machines jouables sont mesurées : megaways est mis de côté (`playable:
// false`) et sa mesure doublait le temps de la suite. Sa config reste validée par
// machines.test.ts.
describe('RTP', () => {
  for (const machine of playableMachines()) {
    // Une seule graine ne suffit pas : les gros symboles sont assez rares pour
    // déplacer le résultat de plusieurs points. On moyenne, et on vérifie en plus
    // qu'aucune graine ne part complètement ailleurs.
    it(`${machine.id} tient sa cible de ${(machine.rtpTarget * 100).toFixed(0)}%`, () => {
      const runs = SEEDS.map(seed => measureRTP(machine, seed))
      const mean = runs.reduce((a, b) => a + b, 0) / runs.length

      expect(mean).toBeGreaterThan(machine.rtpTarget - 0.015)
      expect(mean).toBeLessThan(machine.rtpTarget + 0.015)

      for (const rtp of runs) {
        expect(rtp).toBeGreaterThan(machine.rtpTarget - 0.03)
        expect(rtp).toBeLessThan(machine.rtpTarget + 0.03)
      }
    })
  }
})
