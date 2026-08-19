import { describe, it, expect, afterEach } from 'vitest'
import type { GameSymbol } from '../types/index.ts'
import { spin, calculateWins } from './SlotMachine.ts'
import { getSymbolById } from './Symbols.ts'
import { getMachine } from './machines/index.ts'
import { seedRng, setRng } from '../utils/Random.ts'

const megaways = getMachine('megaways')
const rigide   = getMachine('rigide')

const sym = (id: string): GameSymbol => getSymbolById(id)!
const lemon = sym('lemon')
const bell = sym('bell')
const wild = sym('wild')
const scatter = sym('scatter')
const ten = sym('ten')

/** Colonne de `n` fois le même symbole. */
const col = (s: GameSymbol, n = 1): GameSymbol[] => Array.from({ length: n }, () => s)

afterEach(() => setRng(null))

describe('spin — géométrie', () => {
  it('megaways : 6 rouleaux de 2 à 7 cases', () => {
    seedRng(1)
    for (let i = 0; i < 50; i++) {
      const { grid, rowCounts } = spin(megaways)
      expect(grid).toHaveLength(6)
      expect(rowCounts).toHaveLength(6)
      for (const n of rowCounts) {
        expect(n).toBeGreaterThanOrEqual(2)
        expect(n).toBeLessThanOrEqual(7)
      }
    }
  })

  it('megaways : les hauteurs varient bien d\'un rouleau à l\'autre', () => {
    seedRng(2)
    const seen = new Set<number>()
    for (let i = 0; i < 100; i++) spin(megaways).rowCounts.forEach(n => seen.add(n))
    expect(seen.size).toBeGreaterThan(1)
  })

  it('rigide : toutes les colonnes font 5 cases', () => {
    seedRng(3)
    for (let i = 0; i < 20; i++) {
      expect(spin(rigide).rowCounts).toEqual([5, 5, 5, 5, 5, 5])
    }
  })

  it('fixedRows prime sur la config de la machine', () => {
    expect(spin(megaways, {}, 0, { fixedRows: 4 }).rowCounts).toEqual([4, 4, 4, 4, 4, 4])
    expect(spin(rigide, {}, 0, { fixedRows: 3 }).rowCounts).toEqual([3, 3, 3, 3, 3, 3])
  })

  it('applique les sticky positions', () => {
    const { grid } = spin(rigide, { '0-0': bell })
    expect(grid[0][0].id).toBe('bell')
  })

  it('est reproductible à graine égale', () => {
    seedRng(77)
    const a = spin(megaways).grid.map(c => c.map(s => s.id))
    seedRng(77)
    const b = spin(megaways).grid.map(c => c.map(s => s.id))
    expect(a).toEqual(b)
  })
})

describe('calculateWins — ways (Megaways)', () => {
  const pay = (id: string, n: number) => megaways.paytable[id][n]

  it('paie 3 rouleaux consécutifs, une occurrence par rouleau', () => {
    const grid = [col(lemon), col(lemon), col(lemon), col(ten), col(ten), col(ten)]
    const r = calculateWins(megaways, grid, 10)
    const line = r.winLines.find(l => l.symbolId === 'lemon')!
    expect(line.count).toBe(3)
    expect(line.ways).toBe(1)
    expect(line.win).toBeCloseTo(10 * pay('lemon', 3))
  })

  it('multiplie par le nombre de combinaisons', () => {
    // 2 × 1 × 3 = 6 façons
    const grid = [col(lemon, 2), col(lemon, 1), col(lemon, 3), col(ten), col(ten), col(ten)]
    const line = calculateWins(megaways, grid, 10).winLines.find(l => l.symbolId === 'lemon')!
    expect(line.ways).toBe(6)
    expect(line.win).toBeCloseTo(10 * pay('lemon', 3) * 6)
  })

  it('la position dans la colonne est indifférente', () => {
    const a = [[ten, lemon], [lemon, ten], [ten, lemon], col(ten), col(ten), col(ten)]
    const b = [[lemon, ten], [lemon, ten], [lemon, ten], col(ten), col(ten), col(ten)]
    const winA = calculateWins(megaways, a, 10).winLines.find(l => l.symbolId === 'lemon')!.win
    const winB = calculateWins(megaways, b, 10).winLines.find(l => l.symbolId === 'lemon')!.win
    expect(winA).toBeCloseTo(winB)
  })

  it('un rouleau sans le symbole coupe la chaîne', () => {
    const grid = [col(lemon), col(bell), col(lemon), col(lemon), col(lemon), col(lemon)]
    const r = calculateWins(megaways, grid, 10)
    expect(r.winLines.find(l => l.symbolId === 'lemon')).toBeUndefined()
  })

  it('ne paie pas en dessous de minMatch', () => {
    const grid = [col(lemon), col(lemon), col(bell), col(bell), col(bell), col(bell)]
    const r = calculateWins(megaways, grid, 10)
    expect(r.winLines.find(l => l.symbolId === 'lemon')).toBeUndefined()
  })

  it('le wild complète une combinaison', () => {
    const grid = [col(lemon), col(wild), col(lemon), col(ten), col(ten), col(ten)]
    const line = calculateWins(megaways, grid, 10).winLines.find(l => l.symbolId === 'lemon')!
    expect(line.count).toBe(3)
  })

  it('cells liste toutes les cases payées, pas une par rouleau', () => {
    const grid = [col(lemon, 2), col(lemon, 1), col(lemon, 3), col(ten), col(ten), col(ten)]
    const line = calculateWins(megaways, grid, 10).winLines.find(l => l.symbolId === 'lemon')!
    expect(line.cells).toHaveLength(6)
    expect(line.cells).toContainEqual([0, 1])
    expect(line.cells).toContainEqual([2, 2])
  })
})

describe('calculateWins — lines (machine figée)', () => {
  const pay = (id: string, n: number) => rigide.paytable[id][n]
  /** Grille 6×5 remplie de `filler`, puis on peint une ligne de paie. */
  function gridWithLine(lineIndex: number, symbol: GameSymbol, count: number, filler = ten) {
    const g = Array.from({ length: 6 }, () => col(filler, 5))
    const payline = rigide.paylines![lineIndex]
    for (let reel = 0; reel < count; reel++) g[reel][payline[reel]] = symbol
    return g
  }

  it('paie une ligne de paie touchée', () => {
    const g = gridWithLine(0, bell, 3, lemon)
    const line = calculateWins(rigide, g, 10).winLines.find(l => l.symbolId === 'bell')!
    expect(line.count).toBe(3)
    expect(line.ways).toBe(1)
    expect(line.paylineIndex).toBe(0)
    expect(line.win).toBeCloseTo(10 * pay('bell', 3))
  })

  it('ne paie pas des symboles alignés hors ligne de paie', () => {
    // 3 cœurs en colonne 0-1-2 mais sur des lignes qu'aucune payline ne relie ainsi
    const g = Array.from({ length: 6 }, () => col(lemon, 5))
    g[0][4] = bell; g[1][0] = bell; g[2][4] = bell
    const r = calculateWins(rigide, g, 10)
    expect(r.winLines.find(l => l.symbolId === 'bell')).toBeUndefined()
  })

  it('le wild complète la ligne', () => {
    const g = gridWithLine(1, bell, 3, lemon)
    g[1][rigide.paylines![1][1]] = wild
    const line = calculateWins(rigide, g, 10).winLines.find(l => l.symbolId === 'bell')!
    expect(line.count).toBe(3)
  })

  it('compte depuis le rouleau 1 uniquement', () => {
    const g = Array.from({ length: 6 }, () => col(lemon, 5))
    const payline = rigide.paylines![0]
    for (let reel = 1; reel < 4; reel++) g[reel][payline[reel]] = bell
    const r = calculateWins(rigide, g, 10)
    expect(r.winLines.find(l => l.symbolId === 'bell')).toBeUndefined()
  })

  it('cells suit le tracé de la ligne', () => {
    const g = gridWithLine(5, bell, 4, lemon)
    const line = calculateWins(rigide, g, 10).winLines.find(l => l.symbolId === 'bell')!
    expect(line.cells).toEqual([[0, 0], [1, 1], [2, 2], [3, 3]])
  })
})

describe('calculateWins — modificateurs', () => {
  const full = () => Array.from({ length: 6 }, () => col(lemon))

  it('columnMultipliers applique le plus haut des rouleaux gagnants', () => {
    const grid = [col(lemon), col(lemon), col(lemon), col(ten), col(ten), col(ten)]
    const base = calculateWins(megaways, grid, 10).winLines.find(l => l.symbolId === 'lemon')!.win
    const boosted = calculateWins(megaways, grid, 10, {
      columnMultipliers: [1, 3, 1, 1, 1, 1],
    }).winLines.find(l => l.symbolId === 'lemon')!.win
    expect(boosted).toBeCloseTo(base * 3)
  })

  it('jackpotMultiplier ne joue que sur une combinaison pleine', () => {
    const partial = [col(lemon), col(lemon), col(lemon), col(ten), col(ten), col(ten)]
    const noJackpot = calculateWins(megaways, partial, 10, { jackpotMultiplier: 2.5 })
      .winLines.find(l => l.symbolId === 'lemon')!.win
    const plain = calculateWins(megaways, partial, 10).winLines.find(l => l.symbolId === 'lemon')!.win
    expect(noJackpot).toBeCloseTo(plain)

    const withJackpot = calculateWins(megaways, full(), 10, { jackpotMultiplier: 2.5 }).totalWin
    expect(withJackpot).toBeCloseTo(calculateWins(megaways, full(), 10).totalWin * 2.5)
  })

  it('wildColumns transforme une colonne entière', () => {
    const grid = [col(lemon), col(bell), col(lemon), col(ten), col(ten), col(ten)]
    const r = calculateWins(megaways, grid, 10, { wildColumns: [false, true, false, false, false, false] })
    expect(r.winLines.find(l => l.symbolId === 'lemon')!.count).toBe(3)
  })

  it('safetyNet rembourse la moitié quand rien ne tombe', () => {
    const grid = [col(lemon), col(bell), col(lemon), col(bell), col(lemon), col(bell)]
    expect(calculateWins(megaways, grid, 10, { safetyNet: true }).totalWin).toBe(5)
  })

  it('globalMultiplier et symbolMultipliers se cumulent', () => {
    const grid = [col(lemon), col(lemon), col(lemon), col(ten), col(ten), col(ten)]
    const base = calculateWins(megaways, grid, 10).winLines.find(l => l.symbolId === 'lemon')!.win
    const boosted = calculateWins(megaways, grid, 10, {
      globalMultiplier: 3,
      symbolMultipliers: { lemon: 2 },
    }).winLines.find(l => l.symbolId === 'lemon')!.win
    expect(boosted).toBeCloseTo(base * 6)
  })
})

describe('calculateWins — scatter', () => {
  it('déclenche à partir de scatterMin', () => {
    const g2 = [col(scatter), col(scatter), col(lemon), col(lemon), col(bell), col(bell)]
    const g3 = [col(scatter), col(scatter), col(scatter), col(lemon), col(bell), col(bell)]
    expect(calculateWins(megaways, g2, 10).scatterTriggered).toBe(false)
    expect(calculateWins(megaways, g3, 10).scatterTriggered).toBe(true)
  })

  it('le scatter ne forme jamais de combinaison payante', () => {
    const grid = Array.from({ length: 6 }, () => col(scatter))
    expect(calculateWins(megaways, grid, 10).winLines).toHaveLength(0)
  })
})
