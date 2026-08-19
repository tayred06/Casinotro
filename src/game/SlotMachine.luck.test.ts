import { describe, it, expect } from 'vitest'
import { spin, calculateWins } from './SlotMachine.ts'
import { getMachine } from './machines/index.ts'
import { seedRng } from '../utils/Random.ts'
import type { LuckProfile } from './Symbols.ts'

/**
 * Les deux axes de chance doivent faire des choses DIFFÉRENTES et mesurables :
 * la régularité monte la fréquence de gain, la convoitise monte le gain moyen.
 * Sans ces garde-fous, un simple ajustement de `RARITY_BIAS` peut silencieusement
 * transformer la convoitise en malus (c'était le bug d'origine).
 */
const N = 20_000

function measure(machineId: string, luck: Partial<LuckProfile>) {
  seedRng(11)
  const machine = getMachine(machineId)!
  const profile: LuckProfile = { rarity: 0, cohesion: 0, ...luck }
  let hits = 0
  let returned = 0
  for (let i = 0; i < N; i++) {
    const { grid } = spin(machine, {}, profile)
    const result = calculateWins(machine, grid, 1)
    if (result.totalWin > 0) hits++
    returned += result.totalWin
  }
  return { hitRate: hits / N, rtp: returned / N }
}

describe.each(['rigide', 'megaways'])('axes de chance — %s', (machineId) => {
  const base = measure(machineId, {})

  it('la régularité augmente la fréquence de gain', () => {
    const withCohesion = measure(machineId, { cohesion: 0.2 })
    expect(withCohesion.hitRate).toBeGreaterThan(base.hitRate)
  })

  it('la convoitise augmente le RTP sans reposer sur la fréquence', () => {
    const withRarity = measure(machineId, { rarity: 0.25 })
    expect(withRarity.rtp).toBeGreaterThan(base.rtp)
    // le gain vient de la taille des lots, pas d'un afflux de petits gains
    expect(withRarity.hitRate).toBeLessThan(base.hitRate + 0.01)
  })

  it('les deux axes restent bornés (pas de RTP explosif)', () => {
    const maxed = measure(machineId, { rarity: 5, cohesion: 5 })
    expect(maxed.rtp).toBeLessThan(3)
  })
})
