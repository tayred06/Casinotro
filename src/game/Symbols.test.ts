import { describe, it, expect } from 'vitest'
import { SYMBOLS, WIN_SYMBOLS, WILD, SCATTER, WIN_MULTIPLIERS, getSymbolById, generateReelColumn } from './Symbols.ts'

describe('SYMBOLS', () => {
  it('contient 8 symboles', () => {
    expect(SYMBOLS).toHaveLength(8)
  })

  it('chaque symbole a les champs requis', () => {
    for (const s of SYMBOLS) {
      expect(s).toHaveProperty('id')
      expect(s).toHaveProperty('name')
      expect(s).toHaveProperty('emoji')
      expect(typeof s.weight).toBe('number')
      expect(s.weight).toBeGreaterThan(0)
      expect(typeof s.color).toBe('number')
    }
  })
})

describe('WIN_SYMBOLS', () => {
  it('exclut wild et scatter', () => {
    const ids = WIN_SYMBOLS.map(s => s.id)
    expect(ids).not.toContain('wild')
    expect(ids).not.toContain('scatter')
    expect(WIN_SYMBOLS).toHaveLength(6)
  })
})

describe('WIN_MULTIPLIERS', () => {
  it('a les 4 paliers définis', () => {
    expect(WIN_MULTIPLIERS[3]).toBe(0.85)
    expect(WIN_MULTIPLIERS[4]).toBe(3.4)
    expect(WIN_MULTIPLIERS[5]).toBe(11.8)
    expect(WIN_MULTIPLIERS[6]).toBe(35)
  })
})

describe('getSymbolById', () => {
  it('retrouve un symbole existant', () => {
    expect(getSymbolById('lemon')?.name).toBe('Citron')
  })

  it('retourne undefined pour un id inconnu', () => {
    expect(getSymbolById('xyz')).toBeUndefined()
  })
})

describe('generateReelColumn', () => {
  it('retourne le bon nombre de symboles', () => {
    expect(generateReelColumn(4)).toHaveLength(4)
    expect(generateReelColumn(7)).toHaveLength(7)
  })

  it('retourne uniquement des Symbol valides', () => {
    const col = generateReelColumn(5)
    const validIds = SYMBOLS.map(s => s.id)
    for (const sym of col) {
      expect(validIds).toContain(sym.id)
    }
  })
})
