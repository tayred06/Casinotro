import { describe, it, expect, vi } from 'vitest'
import { spin, calculateWins } from './SlotMachine.js'
import { getSymbolById } from './Symbols.js'

const lemon = getSymbolById('lemon')
const bell  = getSymbolById('bell')
const wild  = getSymbolById('wild')
const scatter = getSymbolById('scatter')
const diamond = getSymbolById('diamond')

describe('spin', () => {
  it('retourne 6 reels', () => {
    const { grid, rowCounts } = spin()
    expect(grid).toHaveLength(6)
    expect(rowCounts).toHaveLength(6)
  })

  it('chaque reel a entre 2 et 7 symboles', () => {
    const { rowCounts } = spin()
    for (const count of rowCounts) {
      expect(count).toBeGreaterThanOrEqual(2)
      expect(count).toBeLessThanOrEqual(7)
    }
  })

  it('applique les sticky positions', () => {
    const stickyPositions = { '0-0': bell }
    const { grid } = spin(stickyPositions)
    expect(grid[0][0].id).toBe('bell')
  })
})

describe('calculateWins', () => {
  it('détecte 3 symboles identiques consécutifs', () => {
    const grid = [
      [lemon],
      [lemon],
      [lemon],
      [diamond],
      [diamond],
      [diamond],
    ]
    const result = calculateWins(grid, 10)
    expect(result.winLines).toHaveLength(1)
    expect(result.winLines[0].symbolId).toBe('lemon')
    expect(result.winLines[0].count).toBe(3)
    expect(result.totalWin).toBe(10 * 0.8)
    expect(result.scatterTriggered).toBe(false)
  })

  it('détecte 6 symboles identiques (jackpot)', () => {
    const grid = Array(6).fill([lemon])
    const result = calculateWins(grid, 5)
    expect(result.winLines[0].count).toBe(6)
    expect(result.totalWin).toBe(5 * 50)
  })

  it('le Wild complète une combinaison', () => {
    const grid = [
      [lemon],
      [lemon],
      [wild],   // Wild compte comme lemon
      [bell],
      [bell],
      [bell],
    ]
    const result = calculateWins(grid, 10)
    const lemonLine = result.winLines.find(l => l.symbolId === 'lemon')
    expect(lemonLine).toBeDefined()
    expect(lemonLine.count).toBe(3)
  })

  it('pas de gain si moins de 3 reels', () => {
    const grid = [
      [lemon],
      [lemon],
      [bell],
      [bell],
      [bell],
      [bell],
    ]
    const result = calculateWins(grid, 10)
    const lemonLine = result.winLines.find(l => l.symbolId === 'lemon')
    expect(lemonLine).toBeUndefined()
  })

  it('applique le jackpotMultiplier personnalisé', () => {
    const grid = Array(6).fill([lemon])
    const result = calculateWins(grid, 10, { jackpotMultiplier: 50 })
    expect(result.totalWin).toBe(10 * 50)
  })

  it('applique le safetyNet si gain = 0', () => {
    const grid = [
      [lemon],
      [bell],
      [lemon],
      [bell],
      [lemon],
      [bell],
    ]
    const result = calculateWins(grid, 10, { safetyNet: true })
    expect(result.totalWin).toBe(5) // 50% de la mise
  })

  it('détecte le scatter (3+ partout)', () => {
    const grid = [
      [scatter, bell],
      [scatter, bell],
      [scatter, bell],
      [bell, bell],
      [bell, bell],
      [bell, bell],
    ]
    const result = calculateWins(grid, 10)
    expect(result.scatterTriggered).toBe(true)
  })

  it('applique columnMultipliers', () => {
    const grid = [
      [lemon],
      [lemon],
      [lemon],
      [diamond],
      [diamond],
      [diamond],
    ]
    const result = calculateWins(grid, 10, { columnMultipliers: [2, 1, 1, 1, 1, 1] })
    // lemon sur 3 reels (0,1,2) → base 0.8 × bet × colMultiplier[0]=2
    expect(result.totalWin).toBe(10 * 0.8 * 2)
  })

  it('applique symbolMultipliers', () => {
    const grid = [
      [lemon],
      [lemon],
      [lemon],
      [diamond],
      [diamond],
      [diamond],
    ]
    const result = calculateWins(grid, 10, { symbolMultipliers: { lemon: 3 } })
    expect(result.totalWin).toBeCloseTo(10 * 0.8 * 3, 5)
  })

  it('applique globalMultiplier', () => {
    const grid = [
      [lemon],
      [lemon],
      [lemon],
      [diamond],
      [diamond],
      [diamond],
    ]
    const result = calculateWins(grid, 10, { globalMultiplier: 2 })
    expect(result.totalWin).toBe(10 * 0.8 * 2)
  })
})
