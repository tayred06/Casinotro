import { describe, it, expect, afterEach } from 'vitest'
import { spin, calculateWins } from './SlotMachine.ts'
import { BonusSystem } from './BonusSystem.ts'
import { getMachine } from './machines/index.ts'
import { seedRng, setRng } from '../utils/Random.ts'
import type { Modifiers } from '../types/index.ts'

/**
 * Premier test qui inclut des items dans la mesure du RTP. Ce n'est PAS une extension de
 * `SlotMachine.rtp.test.ts` : c'est un plafond de sécurité, pas une cible. Les items sont
 * la progression roguelike et poussent le RTP très au-dessus de 100 % par construction —
 * ce qui est interdit, c'est l'emballement multiplicatif.
 *
 * Les seuils viennent de la mesure, pas d'un vœu. Sur `rigide` (20 lignes, 40 000 spins) :
 *   base 0,94 · Colonne Dorée épique 3,77 · Symbole Collant épique 2,07 · Œil 1,51
 *   Colonne Wild épique 1,51 · build de 5 épiques 7,64
 * Un multiplicateur de colonne touche toutes les lignes qui la traversent, donc ×4 vaut
 * ×4 de RTP : c'est structurel, pas un bug. Le garde-fou utile est le plafond ×12 du
 * cumul, qui empêche 4 × 4 × 2,5 × 3 de se multiplier jusqu'à ×120.
 */
const SOLO_CEILING = 4.2   // un item seul ne doit jamais dépasser la Colonne Dorée épique
const BUILD_CEILING = 10   // cinq emplacements d'épiques, endgame assumé
const SPINS = 40_000
const FREE_SPINS = 8
const machine = getMachine('rigide')

afterEach(() => setRng(null))

function measure(build: (bs: BonusSystem) => void, seed = 4, override?: Partial<Modifiers>): number {
  const bs = new BonusSystem()
  bs.setReelCount(machine.reelCount)
  bs.grantSlots(20)
  build(bs)

  seedRng(seed)
  let wagered = 0
  let returned = 0

  for (let i = 0; i < SPINS; i++) {
    wagered += 1
    bs.rollSpinState()
    const mods = { ...bs.getModifiers(), ...override }
    const luck = { rarity: mods.rarity / 100, cohesion: mods.cohesion / 100,
                   forcedAnchor: mods.forcedAnchor, scatterBoost: mods.scatterBoost }
    const { grid, anchor } = spin(machine, mods.stickyPositions ?? {}, luck)
    const result = calculateWins(machine, grid, 1, mods)
    returned += result.totalWin
    bs.processPostSpin(result, grid, { anchorId: anchor })

    if (result.scatterTriggered) {
      for (let f = 0; f < FREE_SPINS; f++) {
        returned += calculateWins(machine, spin(machine, {}, luck).grid, 1, mods).totalWin
      }
    }
  }

  return returned / wagered
}

describe('Plafond de RTP avec items', () => {
  it('chaque épique pris seul reste sous le plafond solo', () => {
    const solo: Array<[string, (bs: BonusSystem) => void]> = [
      ['wild_column',       bs => { bs.acquire('wild_column', 'epique', 0) }],
      ['golden_column',     bs => { bs.acquire('golden_column', 'epique', 0) }],
      ['symbol_multiplier', bs => { bs.acquire('symbol_multiplier', 'epique', 'lemon') }],
      ['jackpot_boost',     bs => { bs.acquire('jackpot_boost', 'epique') }],
      ['greed_eye',         bs => { bs.acquire('greed_eye', 'epique') }],
      ['chain',             bs => { bs.acquire('chain', 'epique', 'lemon') }],
      ['sticky',            bs => { bs.acquire('sticky', 'epique') }],
      ['safety_net',        bs => { bs.acquire('safety_net', 'epique') }],
      ['global_multiplier', bs => { bs.acquire('global_multiplier', 'epique') }],
    ]
    for (const [id, build] of solo) {
      expect(measure(build), id).toBeLessThan(SOLO_CEILING)
    }
  })

  it('la Colonne Wild reste tenable — c\'est l\'item que l\'invariant surveille', () => {
    // Permanente, elle valait ×3,5 de RTP à elle seule : chaque ligne n'avait plus besoin
    // que de deux symboles au lieu de trois. D'où l'intermittence et `maxOwned: 1`.
    expect(measure(bs => bs.acquire('wild_column', 'epique', 0))).toBeLessThan(2)
  })

  it('des colonnes wild permanentes et consécutives restent bornées par l\'invariant', () => {
    // État inatteignable en jeu (maxOwned + intermittence) : on borne le moteur seul.
    const two   = measure(() => {}, 4, { wildColumns: [true, true, false, false, false, false] })
    const three = measure(() => {}, 4, { wildColumns: [true, true, true, false, false, false] })
    // L'invariant ramène 2 et 3 colonnes au même état qu'une seule.
    expect(three).toBeCloseTo(two, 5)
  })

  it('cinq emplacements d\'épiques multiplicatifs restent sous le plafond de build', () => {
    expect(measure(bs => {
      bs.acquire('golden_column', 'epique', 0)
      bs.acquire('symbol_multiplier', 'epique', 'lemon')
      bs.acquire('jackpot_boost', 'epique')
      bs.acquire('greed_eye', 'epique')
      bs.acquire('chain', 'epique', 'lemon')
    })).toBeLessThan(BUILD_CEILING)
  })

  it('une chaîne saturée sur un run long reste sous le plafond de build', () => {
    expect(measure(bs => {
      bs.acquire('chain', 'epique', 'lemon')
      bs.acquire('symbol_multiplier', 'epique', 'lemon')
      bs.acquire('regularity', 'epique')
    })).toBeLessThan(BUILD_CEILING)
  })

  it('le Filet de Sécurité épique rend le joueur gagnant à lui seul', () => {
    // P(spin mort) mesuré à 0,707 sur `rigide` : rembourser 25 % ajoute ~18 points de RTP.
    // D'où 15/20/25 % au lieu des 50/65/80 % envisagés — à 50 %, l'item seul valait +35.
    const rtp = measure(bs => bs.acquire('safety_net', 'epique'))
    expect(rtp).toBeGreaterThan(1)
    expect(rtp).toBeLessThan(1.4)
  })
})
