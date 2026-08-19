import { describe, it, expect } from 'vitest'
import { createIraPlugin } from './ira.ts'
import { spin, calculateWins, CELL_INTACT, CELL_CRACKED, CELL_DEAD } from '../SlotMachine.ts'
import { getSymbolById } from '../Symbols.ts'
import type { GameContext, CharacterAction } from '../../types/index.ts'

const lemon = getSymbolById('lemon')

// 6 rouleaux de 2 citrons : chaîne complète
const fullLemonGrid = () => Array.from({ length: 6 }, () => [lemon, lemon])

const blank = () => Array.from({ length: 6 }, () => Array(7).fill(CELL_INTACT))

function makeCtx(rowCounts = Array(6).fill(7)) {
  const logs: string[] = []
  const spins: any[] = []
  const ctx = {
    economy: {} as any,
    bonusSystem: {} as any,
    ui: {} as any,
    rowCounts,
    addLog: (msg: string) => { logs.push(msg) },
    requestSpin: async (req?: any) => { spins.push(req ?? {}) },
  } as GameContext
  return Object.assign(ctx, { logs, spins })
}

const frapper = (p: ReturnType<typeof createIraPlugin>) =>
  p.actions!.find(a => a.id === 'frapper') as CharacterAction

const totalDamage = (d: number[][]) => d.flat().reduce((a, b) => a + b, 0)

describe('calculateWins — dégâts par case', () => {
  it('sans dégât, la chaîne complète compte 6', () => {
    expect(calculateWins(fullLemonGrid(), 10).winLines[0].count).toBe(6)
  })

  it('une case morte ne casse pas le rouleau si une autre reste vivante', () => {
    const cellDamage = blank()
    cellDamage[2][0] = CELL_DEAD
    const line = calculateWins(fullLemonGrid(), 10, { cellDamage }).winLines[0]
    expect(line.count).toBe(6)
    expect(line.reelRows[2]).toBe(1) // la ligne passe par la case survivante
  })

  it('un rouleau entièrement mort est sauté sans casser la chaîne', () => {
    const cellDamage = blank()
    cellDamage[2] = Array(7).fill(CELL_DEAD)
    const line = calculateWins(fullLemonGrid(), 10, { cellDamage }).winLines[0]
    expect(line.count).toBe(5)
    expect(line.reelRows[2]).toBe(-1)
  })

  it('reelRows reste aligné sur les rouleaux physiques', () => {
    const cellDamage = blank()
    cellDamage[0] = Array(7).fill(CELL_DEAD)
    const line = calculateWins(fullLemonGrid(), 10, { cellDamage }).winLines[0]
    expect(line.reelRows).toHaveLength(6)
    expect(line.reelRows[0]).toBe(-1)
    expect(line.reelRows[1]).toBe(0)
  })

  it('une seule case fissurée divise le gain de la ligne par 2', () => {
    const cellDamage = blank()
    cellDamage[0][0] = CELL_CRACKED
    const intact  = calculateWins(fullLemonGrid(), 10).winLines[0]
    const cracked = calculateWins(fullLemonGrid(), 10, { cellDamage }).winLines[0]
    expect(cracked.win).toBeCloseTo(intact.win / 2)
  })

  it('les cases mortes ne durcissent pas le seuil de match', () => {
    // rouleau de 5 cases : 1 citron + 4 mortes → le citron seul suffit
    const grid = Array.from({ length: 6 }, () => [lemon, lemon, lemon, lemon, lemon])
    const cellDamage = blank()
    for (let reel = 0; reel < 6; reel++) {
      for (let row = 1; row < 5; row++) cellDamage[reel][row] = CELL_DEAD
    }
    expect(calculateWins(grid, 10, { cellDamage }).winLines[0].count).toBe(6)
  })
})

describe('spin — plancher de rangées', () => {
  it('minRowsPerReel garantit que la case abîmée reste affichée', () => {
    for (let i = 0; i < 40; i++) {
      const { rowCounts } = spin({}, 0, { minRowsPerReel: [6, 0, 0, 0, 0, 0] })
      expect(rowCounts[0]).toBeGreaterThanOrEqual(6)
      expect(rowCounts[0]).toBeLessThanOrEqual(7)
    }
  })

  it('sans plancher, les rangées restent variables (2 à 7)', () => {
    for (let i = 0; i < 40; i++) {
      for (const c of spin().rowCounts) {
        expect(c).toBeGreaterThanOrEqual(2)
        expect(c).toBeLessThanOrEqual(7)
      }
    }
  })
})

describe('plugin Ira', () => {
  it('démarre sans aucun dégât', () => {
    const p = createIraPlugin(); const ctx = makeCtx()
    p.onSetup!(ctx)
    expect(totalDamage(p.getModifierOverrides!(ctx).cellDamage!)).toBe(0)
  })

  it('FRAPPER endommage exactement une case', async () => {
    const p = createIraPlugin(); const ctx = makeCtx()
    p.onSetup!(ctx)
    await frapper(p).onInvoke(ctx)
    expect(totalDamage(p.getModifierOverrides!(ctx).cellDamage!)).toBe(1)
  })

  it('FRAPPER ne touche jamais toute une colonne', async () => {
    const p = createIraPlugin(); const ctx = makeCtx()
    p.onSetup!(ctx)
    await frapper(p).onInvoke(ctx)
    const dmg = p.getModifierOverrides!(ctx).cellDamage!
    const touchedReel = dmg.findIndex(rows => rows.some(d => d > 0))
    expect(dmg[touchedReel].filter(d => d > 0)).toHaveLength(1)
  })

  it('ne peut abîmer que des cases actuellement affichées', async () => {
    const p = createIraPlugin()
    const ctx = makeCtx(Array(6).fill(2)) // 2 rangées visibles par rouleau
    p.onSetup!(ctx)
    for (let i = 0; i < 20; i++) await frapper(p).onInvoke(ctx)
    const dmg = p.getModifierOverrides!(ctx).cellDamage!
    for (const rows of dmg) {
      expect(rows.slice(2).every(d => d === CELL_INTACT)).toBe(true)
    }
  })

  it('getSpinOptions remonte un plancher couvrant la case abîmée', async () => {
    const p = createIraPlugin(); const ctx = makeCtx()
    p.onSetup!(ctx)
    await frapper(p).onInvoke(ctx)
    const dmg = p.getModifierOverrides!(ctx).cellDamage!
    const mins = p.getSpinOptions!(ctx).minRowsPerReel!
    dmg.forEach((rows, reel) => {
      const deepest = rows.reduce((acc, d, row) => (d > 0 ? row + 1 : acc), 0)
      expect(mins[reel]).toBe(deepest)
    })
  })

  it('FRAPPER déclenche un spin gratuit amélioré', async () => {
    const p = createIraPlugin(); const ctx = makeCtx()
    p.onSetup!(ctx)
    await frapper(p).onInvoke(ctx)
    expect(ctx.spins[0]).toMatchObject({ free: true, globalMultiplier: 1.5, luckBonus: 20 })
  })

  it('aucune case ne dépasse l\'état mort', async () => {
    const p = createIraPlugin(); const ctx = makeCtx()
    p.onSetup!(ctx)
    for (let i = 0; i < 200; i++) await frapper(p).onInvoke(ctx)
    expect(Math.max(...p.getModifierOverrides!(ctx).cellDamage!.flat())).toBe(CELL_DEAD)
  })

  it('défaite quand moins de 3 rouleaux restent vivants', async () => {
    const p = createIraPlugin(); const ctx = makeCtx()
    p.onSetup!(ctx)
    expect(p.onLossCheck!(ctx)).toBe(false)
    for (let i = 0; i < 200; i++) await frapper(p).onInvoke(ctx)
    expect(p.onLossCheck!(ctx)).toBe(true)
  })

  it('les dégâts sont réinitialisés entre deux runs', async () => {
    const p = createIraPlugin(); const ctx = makeCtx()
    p.onSetup!(ctx)
    await frapper(p).onInvoke(ctx)
    p.onSetup!(ctx)
    expect(totalDamage(p.getModifierOverrides!(ctx).cellDamage!)).toBe(0)
  })

  it('chaque instance a son propre état (factory)', async () => {
    const a = createIraPlugin(); const b = createIraPlugin(); const ctx = makeCtx()
    a.onSetup!(ctx); b.onSetup!(ctx)
    await frapper(a).onInvoke(ctx)
    expect(totalDamage(b.getModifierOverrides!(ctx).cellDamage!)).toBe(0)
  })
})
