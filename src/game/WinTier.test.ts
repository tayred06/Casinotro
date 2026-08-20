import { describe, it, expect } from 'vitest'
import { getWinTier, tierRank, getTierDef, WIN_TIERS } from './WinTier.ts'

describe('getWinTier', () => {
  it('renvoie none pour un gain nul ou négatif', () => {
    expect(getWinTier(0, 10)).toBe('none')
    expect(getWinTier(-5, 10)).toBe('none')
  })

  it('renvoie none si la mise est nulle (pas de division par zéro)', () => {
    expect(getWinTier(500, 0)).toBe('none')
    expect(getWinTier(500, -1)).toBe('none')
  })

  it('classe par ratio gain/mise', () => {
    expect(getWinTier(40, 10)).toBe('none')       // ×4
    expect(getWinTier(50, 10)).toBe('nice')       // ×5
    expect(getWinTier(150, 10)).toBe('big')       // ×15
    expect(getWinTier(400, 10)).toBe('mega')      // ×40
    expect(getWinTier(1000, 10)).toBe('epic')     // ×100
    expect(getWinTier(3000, 10)).toBe('legendary')// ×300
    expect(getWinTier(99999, 10)).toBe('legendary')
  })

  it('est invariant à l’échelle des mises', () => {
    for (const bet of [0.5, 1, 10, 250, 4000]) {
      expect(getWinTier(bet * 20, bet)).toBe('big')
    }
  })

  it('prend le seuil exact, pas juste au-dessus', () => {
    for (const tier of WIN_TIERS) {
      if (tier.minRatio === 0) continue
      expect(getWinTier(tier.minRatio * 10, 10)).toBe(tier.id)
      expect(getWinTier((tier.minRatio - 0.001) * 10, 10)).not.toBe(tier.id)
    }
  })
})

describe('WIN_TIERS', () => {
  it('est trié par seuil strictement décroissant', () => {
    for (let i = 1; i < WIN_TIERS.length; i++) {
      expect(WIN_TIERS[i].minRatio).toBeLessThan(WIN_TIERS[i - 1].minRatio)
    }
  })

  it('tierRank ordonne none < nice < … < legendary', () => {
    expect(tierRank('none')).toBe(0)
    expect(tierRank('legendary')).toBe(WIN_TIERS.length - 1)
    expect(tierRank('mega')).toBeGreaterThan(tierRank('big'))
  })

  it('getTierDef retrouve chaque palier', () => {
    for (const tier of WIN_TIERS) expect(getTierDef(tier.id)).toBe(tier)
  })
})
