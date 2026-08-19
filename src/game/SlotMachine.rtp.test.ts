import { describe, it, expect } from 'vitest'
import { spin, calculateWins } from './SlotMachine.ts'
import { createRng } from '../utils/Random.ts'
import { LUXURIA_PARAMS } from './characters/luxuria.ts'

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
   * souvent. » Sous l'ancien barème, ce don la pénalisait.
   */
  it('rendre les symboles rares plus fréquents augmente le retour', () => {
    expect(rtpWithRare(LUXURIA_PARAMS.rareSymbolWeightMultiplier))
      .toBeGreaterThan(rtpWithRare(1))
  })

  /**
   * Régression mesurée en partie réelle : avec rareMultiplier à 2.5, le
   * multiplicateur s'appliquait aussi au wild — qui se substitue à TOUS les
   * symboles — et les chaînes premium atteignaient le palier jackpot. Résultat
   * RTP 6.57, soit 7 fois la base. Deux garde-fous ci-dessous.
   */
  it('le don de Luxuria reste dans une fourchette jouable', () => {
    const lux = rtpWithRare(LUXURIA_PARAMS.rareSymbolWeightMultiplier)
    expect(lux).toBeLessThan(rtpWithRare(1) * 2)
  })

  it('même un multiplicateur extrême ne fait pas exploser le retour', () => {
    // Garde-fou de forme : la réponse doit rester sous-linéaire, pas ^6.
    expect(rtpWithRare(2.5)).toBeLessThan(rtpWithRare(1) * 4)
  })

  it('le rareMultiplier ne touche pas le wild', () => {
    // Le wild complète toutes les lignes : le booster multipliait le RTP par
    // près de 3 à lui seul, indépendamment des symboles premium.
    const rng = createRng(5)
    let wilds = 0, cells = 0
    for (let i = 0; i < 2000; i++) {
      const { grid } = spin({}, 0, { rareMultiplier: 5 }, rng)
      for (const col of grid) {
        for (const s of col) { cells++; if (s.id === 'wild') wilds++ }
      }
    }
    const rngBase = createRng(5)
    let wildsBase = 0, cellsBase = 0
    for (let i = 0; i < 2000; i++) {
      const { grid } = spin({}, 0, { rareMultiplier: 1 }, rngBase)
      for (const col of grid) {
        for (const s of col) { cellsBase++; if (s.id === 'wild') wildsBase++ }
      }
    }
    // La part de wilds doit rester du même ordre malgré un rareMultiplier x5.
    expect(wilds / cells).toBeLessThan((wildsBase / cellsBase) * 1.5)
  })
})
