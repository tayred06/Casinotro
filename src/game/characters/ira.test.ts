import { describe, it, expect } from 'vitest'
import { createIraPlugin, BROKEN_SYMBOL } from './ira.ts'
import { getCharacter } from '../Characters.ts'
import { getMachine } from '../machines/index.ts'
import { seedRng } from '../../utils/Random.ts'
import type { GameContext, GameSymbol } from '../../types/index.ts'

const MACHINE = getMachine(getCharacter('ira')?.machineId ?? 'rigide')
const COLS = MACHINE.reelCount
const ROWS = MACHINE.rows.kind === 'fixed' ? MACHINE.rows.count : MACHINE.rows.max

const ctx = (): GameContext => ({
  economy: {} as any, bonusSystem: {} as any, ui: {} as any, addLog: () => {},
})

const SYM: GameSymbol = { id: 'lemon', name: 'Citron', emoji: '🍋', weight: 30, color: 0xffff00 }
const grid = (): GameSymbol[][] =>
  Array.from({ length: COLS }, () => Array.from({ length: ROWS }, () => SYM))

/** Frappe jusqu'à ce que la case [col][row] soit morte. */
function killCell(plugin: ReturnType<typeof createIraPlugin>, col: number, row: number): void {
  const states = () => plugin.getCellStates!(ctx())
  while (states()[col][row] < 1) plugin.onAction!(ctx(), 'strike')
}

describe('ira', () => {
  it('démarre avec une machine intacte', () => {
    const p = createIraPlugin()
    expect(p.getCellStates!(ctx()).flat().every(v => v === 0)).toBe(true)
    expect(p.transformGrid!(ctx(), grid()).flat()).not.toContain(BROKEN_SYMBOL)
  })

  it('une frappe abîme une case et rend un free spin amélioré', () => {
    seedRng(7)
    const p = createIraPlugin()
    const res = p.onAction!(ctx(), 'strike') as any
    expect(res.freeSpins).toBe(1)
    expect(res.winMultiplier).toBeGreaterThan(1)
    expect(res.impact).toBeDefined()
    expect(p.getCellStates!(ctx()).flat().some(v => v > 0)).toBe(true)
  })

  it('une case intacte ne meurt jamais d\'un seul coup', () => {
    seedRng(1)
    const p = createIraPlugin()
    p.onAction!(ctx(), 'strike')
    expect(p.getCellStates!(ctx()).flat().filter(v => v >= 1)).toHaveLength(0)
  })

  it('remplace les cases mortes par le symbole brisé', () => {
    seedRng(3)
    const p = createIraPlugin()
    // Frappes répétées : au moins une case finit par mourir.
    for (let i = 0; i < 200; i++) p.onAction!(ctx(), 'strike')
    const dead = p.getCellStates!(ctx()).flat().filter(v => v >= 1).length
    expect(dead).toBeGreaterThan(0)
    expect(p.transformGrid!(ctx(), grid()).flat()).toContain(BROKEN_SYMBOL)
  })

  it('perd la partie quand une colonne entière est morte', () => {
    seedRng(11)
    const p = createIraPlugin()
    expect(p.onLossCheck!(ctx())).toBe(false)
    for (let r = 0; r < ROWS; r++) killCell(p, 0, r)
    expect(p.onLossCheck!(ctx())).toBe(true)
  })

  it('serialize/restore conserve les dégâts', () => {
    seedRng(5)
    const p = createIraPlugin()
    for (let i = 0; i < 10; i++) p.onAction!(ctx(), 'strike')
    const saved = JSON.parse(JSON.stringify(p.serialize!()))
    const q = createIraPlugin()
    q.restore!(saved)
    expect(q.getCellStates!(ctx())).toEqual(p.getCellStates!(ctx()))
  })
})
