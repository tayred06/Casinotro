// src/game/BonusSystem.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { setRng } from '../utils/Random.ts'
import { BonusSystem } from './BonusSystem.ts'
import { ITEM_POOL, requireItem } from './items/index.ts'

const BONUS_POOL = ITEM_POOL

const goldenColumn = BONUS_POOL.find(b => b.effect === 'column_multiplier')!
const jackpotBoost = BONUS_POOL.find(b => b.effect === 'jackpot_boost')!
const safetyNet    = BONUS_POOL.find(b => b.effect === 'safety_net')!
const freeReroll   = BONUS_POOL.find(b => b.effect === 'free_reroll')!
const symbolBonus  = BONUS_POOL.find(b => b.effect === 'symbol_multiplier')!

describe('BONUS_POOL', () => {
  it('contient au moins 9 bonus', () => {
    expect(BONUS_POOL.length).toBeGreaterThanOrEqual(9)
  })

  it('chaque bonus a les champs requis', () => {
    for (const b of BONUS_POOL) {
      expect(b).toHaveProperty('id')
      expect(b).toHaveProperty('name')
      expect(b).toHaveProperty('level')
      expect(b).toHaveProperty('effect')
      for (const rarity of ['commun', 'rare', 'epique'] as const) {
        expect(b.tiers[rarity].price).toBeGreaterThan(0)
        expect(b.tiers[rarity].description.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('BonusSystem', () => {
  let bs: BonusSystem

  beforeEach(() => { bs = new BonusSystem() })

  it('commence avec 0 bonus actifs', () => {
    expect(bs.activeBonus).toHaveLength(0)
    expect(bs.isFull).toBe(false)
  })

  it('addBonus ajoute un bonus', () => {
    bs.addBonus(safetyNet)
    expect(bs.activeBonus).toHaveLength(1)
  })

  it('isFull à 5 bonus', () => {
    for (let i = 0; i < 5; i++) bs.addBonus(safetyNet)
    expect(bs.isFull).toBe(true)
  })

  it('removeBonus supprime et retourne 50% du prix', () => {
    const inst = bs.addBonus(safetyNet)
    const refund = bs.removeBonus(inst.instanceId)
    expect(refund).toBe(Math.floor(safetyNet.tiers.commun.price * 0.5))
    expect(bs.activeBonus).toHaveLength(0)
  })

  it('getShopOffers retourne 3 offres', () => {
    const offers = bs.getShopOffers(1)
    expect(offers).toHaveLength(3)
  })

  it('getShopOffers retourne des bonus du bon niveau ou inférieur', () => {
    const offers = bs.getShopOffers(1)
    for (const o of offers) {
      expect(ITEM_POOL.find(i => i.id === o.defId)!.level).toBe(1)
      // Palier 1 : la boutique ne vend que du commun.
      expect(o.rarity).toBe('commun')
    }
  })

  describe('getModifiers', () => {
    it('safetyNet actif → modifiers.safetyNet = true', () => {
      bs.addBonus(safetyNet)
      expect(bs.getModifiers().safetyNet).toBe(true)
    })

    it('jackpot_boost actif → jackpotMultiplier = 2.5', () => {
      bs.addBonus(jackpotBoost)
      expect(bs.getModifiers().jackpotMultiplier).toBe(2.5)
    })

    it('column_multiplier avec target=2 → columnMultipliers[2] = 2', () => {
      bs.addBonus(goldenColumn, 2)
      expect(bs.getModifiers().columnMultipliers[2]).toBe(2)
    })

    it('symbol_multiplier avec target="lemon" → symbolMultipliers.lemon = 2', () => {
      bs.addBonus(symbolBonus, 'lemon')
      expect(bs.getModifiers().symbolMultipliers['lemon']).toBe(2)
    })

    it('free_reroll actif → freeRerolls = 1', () => {
      bs.addBonus(freeReroll)
      expect(bs.getModifiers().freeRerolls).toBe(1)
    })
  })
})

describe('BonusSystem — Symbole Collant', () => {
  const stickyDef = BONUS_POOL.find(b => b.effect === 'sticky')!

  const winResult = (cells: Array<[number, number]>) => ({
    totalWin: 10,
    winLines: [{ symbolId: 'cherry', cells }],
  }) as any

  const grid = [['cherry', 'cherry'], ['cherry', 'cherry']] as any

  afterEach(() => setRng(null))

  it('une case collée ne peut pas se recoller au spin suivant', () => {
    const bs = new BonusSystem()
    bs.addBonus(stickyDef, null)
    setRng(() => 0) // toutes les cases éligibles collent

    const first = bs.processPostSpin(winResult([[0, 0], [1, 1]]), grid)
    expect(Object.keys(first.stickyPositions).sort()).toEqual(['0-0', '1-1'])

    // Même combinaison gagnante : les cases figées ne se reconduisent pas.
    const second = bs.processPostSpin(winResult([[0, 0], [1, 1]]), grid)
    expect(second.stickyPositions).toEqual({})
  })

  it('ne colle rien quand le tirage dépasse STICKY_CHANCE', () => {
    const bs = new BonusSystem()
    bs.addBonus(stickyDef, null)
    setRng(() => 0.99)

    const res = bs.processPostSpin(winResult([[0, 0], [1, 1]]), grid)
    expect(res.stickyPositions).toEqual({})
  })

  it('sans gain, rien ne colle', () => {
    const bs = new BonusSystem()
    bs.addBonus(stickyDef, null)
    setRng(() => 0)

    const res = bs.processPostSpin({ totalWin: 0, winLines: [] } as any, grid)
    expect(res.stickyPositions).toEqual({})
  })
})

describe('BonusSystem — cap de la chaîne', () => {
  const win = (symbolId: string) => ({
    totalWin: 10,
    winLines: [{ symbolId, count: 3, multiplier: 1, win: 10, ways: 1, cells: [], reelRows: [] }],
    scatterTriggered: false,
    dropBonus: false,
  })

  it('plafonne le bonus permanent au palier de l\'item', () => {
    const bs = new BonusSystem()
    bs.grantSlots(5)
    bs.acquire('chain', 'commun', 'lemon')

    // 3 spins gagnants d'affilée = une activation. On en enchaîne largement assez
    // pour dépasser le plafond si la croissance n'était pas bornée.
    for (let i = 0; i < 60; i++) bs.processPostSpin(win('lemon') as any, [])

    const cap = requireItem('chain').tiers.commun.params.cap
    expect(bs.getModifiers().symbolMultipliers['lemon']).toBe(cap)
  })

  it('le palier épique monte plus vite et plus haut', () => {
    const bs = new BonusSystem()
    bs.grantSlots(5)
    bs.acquire('chain', 'epique', 'lemon')
    for (let i = 0; i < 60; i++) bs.processPostSpin(win('lemon') as any, [])
    expect(bs.getModifiers().symbolMultipliers['lemon'])
      .toBe(requireItem('chain').tiers.epique.params.cap)
  })

  it('un spin perdant casse la chaîne, sauf Filet de Sécurité épique', () => {
    const dead = { totalWin: 0, winLines: [], scatterTriggered: false, dropBonus: false }

    const plain = new BonusSystem()
    plain.grantSlots(5)
    plain.acquire('chain', 'commun', 'lemon')
    plain.processPostSpin(win('lemon') as any, [])
    plain.processPostSpin(win('lemon') as any, [])
    plain.processPostSpin(dead as any, [])
    plain.processPostSpin(win('lemon') as any, [])
    expect(plain.getModifiers().symbolMultipliers['lemon']).toBeUndefined()

    const netted = new BonusSystem()
    netted.grantSlots(5)
    netted.acquire('chain', 'commun', 'lemon')
    netted.acquire('safety_net', 'epique')
    netted.processPostSpin(win('lemon') as any, [])
    netted.processPostSpin(win('lemon') as any, [])
    netted.processPostSpin(dead as any, [])
    netted.processPostSpin(win('lemon') as any, [])
    expect(netted.getModifiers().symbolMultipliers['lemon']).toBe(1.5)
  })
})
