import { describe, it, expect } from 'vitest'
import {
  SYMBOLS, WIN_SYMBOLS, WILD, SCATTER,
  getSymbolById, generateReelColumn, resolvePool, winSymbolsOf,
} from './Symbols.ts'
import { seedRng } from '../utils/Random.ts'

const ALL_IDS = SYMBOLS.map(s => s.id)

describe('SYMBOL_LIBRARY', () => {
  it('expose 11 symboles payants plus wild et scatter', () => {
    expect(SYMBOLS).toHaveLength(13)
    expect(WIN_SYMBOLS).toHaveLength(11)
    expect(WILD.id).toBe('wild')
    expect(SCATTER.id).toBe('scatter')
  })

  it('chaque symbole a les champs requis', () => {
    for (const s of SYMBOLS) {
      expect(typeof s.id).toBe('string')
      expect(typeof s.name).toBe('string')
      expect(typeof s.emoji).toBe('string')
      expect(s.weight).toBeGreaterThan(0)
      expect(typeof s.color).toBe('number')
    }
  })

  it('les ids sont uniques', () => {
    expect(new Set(ALL_IDS).size).toBe(ALL_IDS.length)
  })

  it('WIN_SYMBOLS exclut wild et scatter', () => {
    const ids = WIN_SYMBOLS.map(s => s.id)
    expect(ids).not.toContain('wild')
    expect(ids).not.toContain('scatter')
  })
})

describe('resolvePool', () => {
  it('résout des ids connus', () => {
    expect(resolvePool(['lemon', 'wild']).map(s => s.id)).toEqual(['lemon', 'wild'])
  })

  it('lève sur un id inconnu', () => {
    expect(() => resolvePool(['xyz'])).toThrow(/Symbole inconnu/)
  })
})

describe('winSymbolsOf', () => {
  it('trie du plus rare au plus fréquent et retire wild/scatter', () => {
    const ids = winSymbolsOf(['ten', 'dog', 'wild', 'scatter', 'lemon']).map(s => s.id)
    expect(ids).toEqual(['dog', 'lemon', 'ten'])
  })
})

describe('getSymbolById', () => {
  it('retrouve un symbole existant', () => {
    expect(getSymbolById('lemon')!.name).toBe('Pique')
  })

  it('retourne undefined pour un id inconnu', () => {
    expect(getSymbolById('xyz')).toBeUndefined()
  })
})

describe('generateReelColumn', () => {
  it('retourne le bon nombre de symboles', () => {
    expect(generateReelColumn(ALL_IDS, 4)).toHaveLength(4)
    expect(generateReelColumn(ALL_IDS, 7)).toHaveLength(7)
  })

  it('ne tire que dans le pool fourni', () => {
    const pool = ['lemon', 'bell']
    const col = generateReelColumn(pool, 20)
    for (const sym of col) expect(pool).toContain(sym.id)
  })

  it('est reproductible à graine égale', () => {
    seedRng(42)
    const a = generateReelColumn(ALL_IDS, 6).map(s => s.id)
    seedRng(42)
    const b = generateReelColumn(ALL_IDS, 6).map(s => s.id)
    expect(a).toEqual(b)
  })

  it('la chance raréfie les bas-payants', () => {
    const count = (luck: number) => {
      seedRng(7)
      let n = 0
      for (let i = 0; i < 400; i++) {
        for (const s of generateReelColumn(ALL_IDS, 5, luck)) if (s.id === 'ten') n++
      }
      return n
    }
    expect(count(1)).toBeLessThan(count(0))
  })
})
