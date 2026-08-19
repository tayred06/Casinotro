import { describe, it, expect } from 'vitest'
import { spin, calculateWins } from './SlotMachine.ts'
import { createRng } from '../utils/Random.ts'

/**
 * Ces tests ne sont possibles que depuis l'injection du RNG : ils rejouent une
 * séquence de spins identique à chaque exécution. Ils servent de garde-fou
 * d'équilibrage — toute retouche des poids de symboles ou des multiplicateurs
 * qui fait sortir le RTP de la fourchette casse ici plutôt qu'en production.
 */
function rtpAt(luck: number, seed = 7, spins = 5000): number {
  const rng = createRng(seed)
  let wagered = 0
  let returned = 0
  for (let i = 0; i < spins; i++) {
    const { grid } = spin({}, luck, {}, rng)
    returned += calculateWins(grid, 1, {}, rng).totalWin
    wagered += 1
  }
  return returned / wagered
}

function simulate(spins: number, seed: number, bet = 1) {
  const rng = createRng(seed)
  let wagered = 0
  let returned = 0
  let winningSpins = 0

  for (let i = 0; i < spins; i++) {
    const { grid } = spin({}, 0, {}, rng)
    const result = calculateWins(grid, bet, {}, rng)
    wagered += bet
    returned += result.totalWin
    if (result.totalWin > 0) winningSpins++
  }

  return { rtp: returned / wagered, hitRate: winningSpins / spins, wagered, returned }
}

describe('RTP de la machine (luck = 0, sans bonus)', () => {
  it('est déterministe pour une graine donnée', () => {
    expect(simulate(2000, 42).rtp).toBe(simulate(2000, 42).rtp)
  })

  it('reste dans une fourchette jouable sur plusieurs graines', () => {
    for (const seed of [1, 42, 1337, 90210]) {
      const { rtp } = simulate(5000, seed)
      // Le barème est calibré pour 0,92 ; on laisse de la marge au bruit de
      // graine, l'assertion serrée sur la cible est dans le test dédié.
      expect(rtp).toBeGreaterThan(0.7)
      expect(rtp).toBeLessThan(1.2)
    }
  })

  /**
   * Le bug historique : le paiement ne dépendait que du nombre de symboles
   * alignés, jamais du symbole. Augmenter la chance raréfiait les symboles
   * courants — les seuls capables de s'aligner — et faisait donc BAISSER le
   * RTP. Mesuré alors : luck=0 → 0,470 ; luck=0,5 → 0,290 ; luck=2 → 0,164.
   *
   * Corrigé par deux règles conjointes : les symboles premium comptent dès une
   * case par rouleau, et la valeur du symbole multiplie le barème.
   */
  it('la chance augmente le retour', () => {
    const at0 = rtpAt(0)
    const at05 = rtpAt(0.5)
    const at1 = rtpAt(1)

    expect(at05).toBeGreaterThan(at0)
    expect(at1).toBeGreaterThan(at05)
  })

  it('le RTP de base vise la cible de 0,92', () => {
    // Calibré par simulation ; tolérance large pour absorber le bruit de graine.
    expect(rtpAt(0)).toBeGreaterThan(0.82)
    expect(rtpAt(0)).toBeLessThan(1.02)
  })

  it('la chance ne fait pas exploser l economie', () => {
    // Chance maximale atteignable en jeu : bonus (+45) et rtpNudge (+0,5).
    expect(rtpAt(0.95)).toBeLessThan(rtpAt(0) * 2)
  })
})

describe('rareMultiplier (mécanique de Luxuria)', () => {
  const rtpWithRare = (rareMultiplier: number, seed = 11, spins = 5000) => {
    const rng = createRng(seed)
    let w = 0, r = 0
    for (let i = 0; i < spins; i++) {
      const { grid } = spin({}, 0, { rareMultiplier }, rng)
      r += calculateWins(grid, 1, {}, rng).totalWin
      w += 1
    }
    return r / w
  }

  /**
   * Luxuria est décrite ainsi : « Les symboles rares apparaissent bien plus
   * souvent. » Sous l'ancien barème, ce don la pénalisait — les symboles rares
   * ne s'alignaient jamais et remplaçaient ceux qui le faisaient.
   */
  it('rendre les symboles rares plus fréquents augmente le retour', () => {
    expect(rtpWithRare(2.5)).toBeGreaterThan(rtpWithRare(1))
  })
})
