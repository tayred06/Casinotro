import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BonusSystem, RARITY_ODDS, ECHO_CHANCE } from './BonusSystem.ts'
import { ITEM_POOL, requireItem, RARE_PRICE_RATIO, EPIQUE_PRICE_RATIO } from './items/index.ts'
import { seedRng, setRng } from '../utils/Random.ts'
import type { ItemRarity } from '../types/index.ts'

afterEach(() => setRng(null))

/** Distribution des raretés sur un gros échantillon d'offres. */
function sample(bs: BonusSystem, level: 1 | 2 | 3, draws = 4000): Record<ItemRarity, number> {
  const counts: Record<ItemRarity, number> = { commun: 0, rare: 0, epique: 0 }
  for (let i = 0; i < draws; i++) {
    for (const offer of bs.getShopOffers(level)) counts[offer.rarity]++
  }
  const total = draws * 3
  return {
    commun: counts.commun / total,
    rare: counts.rare / total,
    epique: counts.epique / total,
  }
}

describe('Boutique — tirage de rareté en deux temps', () => {
  let bs: BonusSystem
  beforeEach(() => { bs = new BonusSystem(); seedRng(11) })

  it('respecte la table de raretés du palier', () => {
    for (const level of [1, 2, 3] as const) {
      const got = sample(bs, level)
      const want = RARITY_ODDS[String(level)]
      for (const rarity of ['commun', 'rare', 'epique'] as const) {
        expect(Math.abs(got[rarity] - want[rarity])).toBeLessThan(0.03)
      }
    }
  })

  it('le mode infini ouvre les épiques', () => {
    bs.setEndless(true)
    const got = sample(bs, 3)
    expect(Math.abs(got.epique - RARITY_ODDS.endless.epique)).toBeLessThan(0.03)
  })

  it('n\'offre jamais un item au-dessus du niveau de boutique', () => {
    for (let i = 0; i < 200; i++) {
      for (const offer of bs.getShopOffers(2)) {
        expect(requireItem(offer.defId).level).toBeLessThanOrEqual(2)
      }
    }
  })
})

describe('Boutique — prix par palier', () => {
  it('rare ≥ 2,2× commun et épique ≥ 4,5× commun', () => {
    // En dessous, acheter le palier supérieur bat la fusion et la fusion meurt.
    for (const def of ITEM_POOL) {
      expect(def.tiers.rare.price / def.tiers.commun.price).toBeGreaterThanOrEqual(RARE_PRICE_RATIO - 0.02)
      expect(def.tiers.epique.price / def.tiers.commun.price).toBeGreaterThanOrEqual(EPIQUE_PRICE_RATIO - 0.02)
    }
  })

  it('priceScale s\'applique par-dessus le palier', () => {
    const bs = new BonusSystem()
    seedRng(3)
    for (const offer of bs.getShopOffers(1, 4)) {
      expect(offer.price).toBe(Math.round(requireItem(offer.defId).tiers[offer.rarity].price * 4))
    }
  })
})

describe('Boutique — écho anti-slot-gelé', () => {
  beforeEach(() => seedRng(5))

  it('biaise les offres vers un item possédé en un seul exemplaire', () => {
    const bs = new BonusSystem()
    bs.grantSlots(5)
    bs.acquire('greed_eye', 'commun')

    let echoes = 0
    const draws = 2000
    for (let i = 0; i < draws; i++) {
      echoes += bs.getShopOffers(2).filter(o => o.defId === 'greed_eye' && o.rarity === 'commun').length
    }
    // Deux offres sur trois peuvent écho, à ECHO_CHANCE près : très au-dessus du
    // tirage uniforme (1 chance sur 11 items × 2 offres).
    const rate = echoes / draws
    expect(rate).toBeGreaterThan(2 * ECHO_CHANCE * 0.7)
  })

  it('ne fait jamais écho sur un item déjà en double', () => {
    const bs = new BonusSystem()
    bs.grantSlots(5)
    bs.acquire('golden_column', 'commun', 0)
    bs.acquire('golden_column', 'commun', 1)   // deux exemplaires, cibles différentes

    let echoes = 0
    for (let i = 0; i < 500; i++) {
      echoes += bs.getShopOffers(1).filter(o => o.defId === 'golden_column').length
    }
    // Il reste le tirage normal : on vérifie juste l'absence de sur-représentation.
    expect(echoes / 500).toBeLessThan(1)
  })
})
