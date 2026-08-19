import { describe, it, expect, vi } from 'vitest'
import { spin, calculateWins } from './SlotMachine.ts'
import { requireSymbol } from './Symbols.ts'

const lemon = requireSymbol('lemon')
const bell  = requireSymbol('bell')
const star  = requireSymbol('star')
const dog   = requireSymbol('dog')
const wild  = requireSymbol('wild')
const scatter = requireSymbol('scatter')
const diamond = requireSymbol('diamond')

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
    expect(result.totalWin).toBe(10 * 0.7)
    expect(result.scatterTriggered).toBe(false)
  })

  it('détecte 6 symboles identiques (jackpot)', () => {
    const grid = Array(6).fill([lemon])
    const result = calculateWins(grid, 5)
    expect(result.winLines[0].count).toBe(6)
    // jackpot par défaut = WIN_MULTIPLIERS[6] = 28, valeur citron = 1
    expect(result.totalWin).toBe(5 * 28)
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
    expect(lemonLine!.count).toBe(3)
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

  describe('valeur par symbole', () => {
    it("une ligne de symboles rares paie plus qu'une ligne de citrons", () => {
      const lemonLine = [[lemon], [lemon], [lemon], [bell], [bell], [bell]]
      const dogLine   = [[dog],   [dog],   [dog],   [bell], [bell], [bell]]

      const lemonWin = calculateWins(lemonLine, 10).winLines.find(l => l.symbolId === 'lemon')!
      const dogWin   = calculateWins(dogLine, 10).winLines.find(l => l.symbolId === 'dog')!

      expect(lemonWin.count).toBe(3)
      expect(dogWin.count).toBe(3)
      // même palier, mais le chien (poids 4) vaut 2.75 fois le citron (poids 30)
      expect(dogWin.win).toBeCloseTo(lemonWin.win * 2.75, 5)
    })
  })

  describe('symboles premium', () => {
    /**
     * Sans cette règle, un symbole rare devait occuper 40 % de chaque colonne
     * pour compter — il ne s'alignait donc quasi jamais, et augmenter la chance
     * faisait baisser le RTP.
     */
    it('un premium compte dès une case par rouleau', () => {
      // 4 rangées par rouleau : un symbole courant en exigerait 2, le premium 1
      const grid = Array.from({ length: 6 }, () => [star, lemon, lemon, lemon])
      const line = calculateWins(grid, 10).winLines.find(l => l.symbolId === 'star')

      expect(line).toBeDefined()
      expect(line!.count).toBe(6)
    })

    it('un symbole courant reste soumis au seuil proportionnel', () => {
      // une seule cloche sur 4 rangées : sous le seuil de 40 %
      const grid = Array.from({ length: 6 }, () => [bell, lemon, lemon, lemon])
      const line = calculateWins(grid, 10).winLines.find(l => l.symbolId === 'bell')

      expect(line).toBeUndefined()
    })
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
    // lemon sur 3 reels (0,1,2) → base 0.7 × valeur citron 1 × bet × colMultiplier[0]=2
    expect(result.totalWin).toBe(10 * 0.7 * 2)
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
    expect(result.totalWin).toBeCloseTo(10 * 0.7 * 3, 5)
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
    expect(result.totalWin).toBe(10 * 0.7 * 2)
  })
})
