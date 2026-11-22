import { describe, it, expect } from 'vitest'
import { CHARACTERS } from '../Characters.ts'
import { RunState, STAGE_QUOTA_K, STAGE_MIN_BETS } from '../RunState.ts'
import { createAvaritiaPlugin, AVARITIA_PARAMS } from './avaritia.ts'
import { Economy } from '../Economy.ts'
import type { GameContext, ShopOffer, SpinResult, WinLine } from '../../types/index.ts'

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

/** Un item réel par niveau — offerModifier lit le niveau depuis la définition. */
const ITEM_BY_LEVEL: Record<1 | 2 | 3, string> = {
  1: 'golden_column',
  2: 'wild_column',
  3: 'jackpot_boost',
}

const offer = (level: 1 | 2 | 3, price: number): ShopOffer =>
  ({ defId: ITEM_BY_LEVEL[level], rarity: 'commun', price })

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

const gateAtTier = (earned: number, level: 1 | 2 | 3) => {
  const eco = new Economy(100)
  eco.debugSetEarned(earned)
  const p = createAvaritiaPlugin()
  p.onSetup!(makeCtx(eco))
  return p.offerModifier!(offer(level, 100))
}

describe('Avaritia — paliers de boutique', () => {
  const gateAt = gateAtTier

  it('1er quart : aucun achat possible', () => {
    expect(gateAt(0, 1)).toBeNull()
    expect(gateAt(179, 3)).toBeNull()
  })

  it('2e quart : niveau 1 uniquement, prix x2', () => {
    expect(gateAt(180, 1)!.price).toBe(200)
    expect(gateAt(180, 2)).toBeNull()
  })

  it('3e quart : niveaux 1-2, prix majorés', () => {
    expect(gateAt(885, 2)!.price).toBe(150)
    expect(gateAt(885, 3)).toBeNull()
  })

  it('4e quart : boutique complète au prix normal', () => {
    expect(gateAt(3205, 3)!.price).toBe(100)
  })
})

describe('Avaritia — 4e palier', () => {
  it('joue un palier de plus que les autres personnages', () => {
    const avaritia = CHARACTERS.find(c => c.id === 'avaritia')!
    expect(avaritia.stages).toBe(4)

    const run = new RunState()
    run.reset('avaritia', 'rigide', avaritia.stages)
    expect(run.maxStage).toBe(4)
    for (let i = 0; i < 3; i++) run.advanceStage()
    expect(run.stage).toBe(4)
    expect(run.isFinalStage).toBe(true)
  })

  it("n'ouvre le niveau 3 de la boutique qu'au dernier palier", () => {
    const beforeLast = AVARITIA_PARAMS.shopGates[3].minEarned
    const threeStages = STAGE_QUOTA_K.slice(0, 3)
      .reduce((sum, k, i) => sum + k * STAGE_MIN_BETS[i], 0)
    expect(beforeLast).toBe(threeStages)
    expect(gateAtTier(beforeLast - 1, 3)).toBeNull()
    expect(gateAtTier(beforeLast, 3)!.price).toBe(100)
  })
})
