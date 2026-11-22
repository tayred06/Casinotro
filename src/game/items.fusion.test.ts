import { describe, it, expect, beforeEach } from 'vitest'
import { BonusSystem } from './BonusSystem.ts'
import { requireItem, nextRarity } from './items/index.ts'

const GOLDEN = 'golden_column'   // ciblé (colonne)
const SAFETY = 'safety_net'      // sans cible
const REROLL = 'free_reroll'     // consommable
const WILD   = 'wild_column'     // maxOwned: 1

describe('Fusion — matrice', () => {
  let bs: BonusSystem
  beforeEach(() => { bs = new BonusSystem() })

  it('même id et même rareté fusionnent, sans cible', () => {
    bs.acquire(SAFETY, 'commun')
    const r = bs.acquire(SAFETY, 'commun')
    expect(r?.fused).toBe(true)
    expect(bs.activeBonus).toHaveLength(1)
    expect(bs.activeBonus[0].rarity).toBe('rare')
  })

  it('même cible fusionne, cibles différentes coexistent', () => {
    bs.acquire(GOLDEN, 'commun', 0)
    expect(bs.acquire(GOLDEN, 'commun', 1)?.fused).toBe(false)
    expect(bs.activeBonus).toHaveLength(2)

    expect(bs.acquire(GOLDEN, 'commun', 0)?.fused).toBe(true)
    expect(bs.activeBonus).toHaveLength(2)
    expect(bs.activeBonus[0].rarity).toBe('rare')
  })

  it('commun + rare cohabitent — la rareté fait partie de l\'identité', () => {
    bs.acquire(SAFETY, 'commun')
    expect(bs.acquire(SAFETY, 'rare')?.fused).toBe(false)
    expect(bs.activeBonus.map(i => i.rarity)).toEqual(['commun', 'rare'])
  })

  it('un consommable fusionne ses charges, jamais son effet', () => {
    bs.acquire(REROLL, 'commun')          // 1 charge
    const before = bs.activeBonus[0].remainingCharges
    bs.acquire(REROLL, 'commun')          // +1 charge, ×1,5
    const inst = bs.activeBonus[0]
    expect(bs.activeBonus).toHaveLength(1)
    expect(inst.remainingCharges).toBe(Math.round(((before ?? 0) + 1) * 1.5))
    // Le multiplicateur du palier reste celui de la définition, pas une valeur cumulée.
    expect(requireItem(REROLL).tiers[inst.rarity].params.mult).toBeUndefined()
  })

  it('un achat qui fusionne reste légal à inventaire plein', () => {
    bs.acquire(SAFETY, 'commun')
    bs.acquire(GOLDEN, 'commun', 0)
    bs.acquire(REROLL, 'commun')
    expect(bs.isFull).toBe(true)                      // 3 slots au palier 1

    expect(bs.buyState(SAFETY, 'commun', null)).toBe('fusion')
    expect(bs.acquire(SAFETY, 'commun')?.fused).toBe(true)
    expect(bs.activeBonus).toHaveLength(3)

    // Un item neuf, lui, reste bloqué.
    expect(bs.buyState('greed_eye', 'commun', null)).toBe('full')
    expect(bs.acquire('greed_eye', 'commun')).toBeNull()
  })

  it('maxOwned borne la famille — la Colonne Wild ne se multiplie pas', () => {
    bs.acquire(WILD, 'commun', 0)
    expect(bs.buyState(WILD, 'commun', 2)).toBe('max_owned')
    expect(bs.acquire(WILD, 'commun', 2)).toBeNull()
    // Sa seule progression est la fusion sur la même colonne.
    expect(bs.acquire(WILD, 'commun', 0)?.fused).toBe(true)
    expect(bs.activeBonus[0].rarity).toBe('rare')
  })

  it('un bonus épique ne fusionne plus', () => {
    bs.acquire(SAFETY, 'epique')
    expect(nextRarity('epique')).toBeNull()
    expect(bs.buyState(SAFETY, 'epique', null)).toBe('ok')
    bs.acquire(SAFETY, 'epique')
    expect(bs.activeBonus).toHaveLength(2)
  })
})
