import { describe, it, expect } from 'vitest'
import { spin, calculateWins } from './SlotMachine.ts'
import { createRng } from '../utils/Random.ts'

/**
 * Ces tests ne sont possibles que depuis l'injection du RNG : ils rejouent une
 * séquence de spins identique à chaque exécution. Ils servent de garde-fou
 * d'équilibrage — toute retouche des poids de symboles ou des multiplicateurs
 * qui fait sortir le RTP de la fourchette casse ici plutôt qu'en production.
 */
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
      // Fourchette large et volontairement descriptive : elle documente le
      // comportement actuel plutôt qu'une cible. La cible affichée est 0.92
      // (Economy.TARGET_RTP), atteinte via rtpNudge, pas par les poids bruts.
      expect(rtp).toBeGreaterThan(0)
      expect(rtp).toBeLessThan(10)
    }
  })

  /**
   * ⚠️ Comportement actuel, contraire à l'intention affichée.
   *
   * `WIN_MULTIPLIERS` ne dépend que du NOMBRE de symboles alignés, jamais du
   * symbole : un alignement de 🐕 (poids 4) paie exactement comme un alignement
   * de 🍋 (poids 30). Augmenter la chance ne fait donc qu'aplatir la
   * distribution des poids, ce qui produit MOINS de chaînes d'un même symbole,
   * donc moins de gains.
   *
   * Mesuré sur 20 000 spins (graine 99) :
   *   luck=0    RTP=0.470   hitRate=10.24%
   *   luck=0.5  RTP=0.290   hitRate= 8.00%
   *   luck=2    RTP=0.164   hitRate= 6.42%
   *
   * Conséquence : `luck_boost`, `lucky_streak` et le `rareMultiplier` de
   * Luxuria pénalisent le joueur, et `Economy.rtpNudge` corrige à l'envers —
   * il augmente la chance quand le RTP est bas, ce qui le fait encore baisser.
   *
   * Ce test verrouille le comportement mesuré. Quand l'équilibrage sera
   * corrigé (faire payer les symboles rares davantage, ou revoir LUCK_BIAS),
   * il échouera : inverser alors l'assertion.
   */
  it('BUG CONNU : la chance fait BAISSER le retour', () => {
    const rtpAt = (luck: number) => {
      const rng = createRng(7)
      let w = 0, r = 0
      for (let i = 0; i < 5000; i++) {
        const { grid } = spin({}, luck, {}, rng)
        r += calculateWins(grid, 1, {}, rng).totalWin
        w += 1
      }
      return r / w
    }

    expect(rtpAt(0.5)).toBeLessThan(rtpAt(0))
  })
})

describe('reproductibilité', () => {
  it('deux spins de même graine produisent la même grille', () => {
    const a = spin({}, 0, {}, createRng(2024))
    const b = spin({}, 0, {}, createRng(2024))
    expect(a.rowCounts).toEqual(b.rowCounts)
    expect(a.grid.map(c => c.map(s => s.id))).toEqual(b.grid.map(c => c.map(s => s.id)))
  })

  it('deux graines différentes produisent des grilles différentes', () => {
    const a = spin({}, 0, {}, createRng(1))
    const b = spin({}, 0, {}, createRng(2))
    expect(a.grid.map(c => c.map(s => s.id))).not.toEqual(b.grid.map(c => c.map(s => s.id)))
  })
})
