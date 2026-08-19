import { describe, it, expect } from 'vitest'
import { createAvaritiaPlugin } from './avaritia.ts'
import { Economy } from '../Economy.ts'
import type { GameContext, ItemDef, SpinResult, WinLine } from '../../types/index.ts'

function makeCtx(economy: Economy): GameContext {
  return {
    economy,
    bonusSystem: {} as any,
    ui: {} as any,
    addLog: () => {},
  }
}

const line = (count: number, win: number): WinLine =>
  ({ symbolId: 'lemon', count, multiplier: 1, win, ways: 1, cells: [], reelRows: [] })

const result = (lines: WinLine[]): SpinResult => ({
  totalWin: lines.reduce((s, l) => s + l.win, 0),
  winLines: lines,
  scatterTriggered: false,
  dropBonus: false,
})

const offer = (level: 1 | 2 | 3, price: number): ItemDef =>
  ({ id: 'x', name: 'X', description: '', level, price, kind: 'bonus', effect: 'none' })

describe('Avaritia — gains', () => {
  it('double les gains des lignes fortes sans créditer elle-même', () => {
    const eco = new Economy(100)
    const p = createAvaritiaPlugin()
    const ctx = makeCtx(eco)
    p.onSetup!(ctx)

    const r = result([line(4, 50)])
    p.onAfterSpin!(ctx, r)

    // GameLoop crédite result.totalWin — le plugin ne doit pas toucher au solde
    expect(r.totalWin).toBe(100)
    expect(eco.balance).toBe(100)
  })

  it('les combinaisons médiocres coûtent au lieu de rapporter', () => {
    const eco = new Economy(100)
    const p = createAvaritiaPlugin()
    const ctx = makeCtx(eco)
    p.onSetup!(ctx)

    const r = result([line(2, 30)])
    p.onAfterSpin!(ctx, r)

    expect(r.totalWin).toBe(0)
    expect(r.winLines).toHaveLength(0)
    expect(eco.balance).toBe(70)
  })
})

describe('Avaritia — paliers de boutique', () => {
  const gateAt = (earned: number, level: 1 | 2 | 3) => {
    const eco = new Economy(100)
    eco.debugSetEarned(earned)
    const p = createAvaritiaPlugin()
    p.onSetup!(makeCtx(eco))
    return p.offerModifier!(offer(level, 100))
  }

  it('1er quart : aucun achat possible', () => {
    expect(gateAt(0, 1)).toBeNull()
    expect(gateAt(499, 3)).toBeNull()
  })

  it('2e quart : niveau 1 uniquement, prix x2', () => {
    expect(gateAt(500, 1)!.price).toBe(200)
    expect(gateAt(500, 2)).toBeNull()
  })

  it('3e quart : niveaux 1-2, prix majorés', () => {
    expect(gateAt(2000, 2)!.price).toBe(150)
    expect(gateAt(2000, 3)).toBeNull()
  })

  it('4e quart : boutique complète au prix normal', () => {
    expect(gateAt(6000, 3)!.price).toBe(100)
  })
})
