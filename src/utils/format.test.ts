import { describe, it, expect } from 'vitest'
import { formatSouls, souls, soulsGain } from './format.ts'

describe('formatSouls', () => {
  it('garde les petits montants exacts, séparateurs de milliers', () => {
    expect(formatSouls(0)).toBe('0')
    expect(formatSouls(12.5)).toBe('12,5')
    expect(formatSouls(999.456)).toBe('999,46')
    expect(formatSouls(12345.6)).toBe('12 345,6')
  })

  it('compacte au-delà de 100 000 avec 3 chiffres significatifs', () => {
    expect(formatSouls(100_000)).toBe('100 K')
    expect(formatSouls(1_234_567)).toBe('1,23 M')
    expect(formatSouls(1.5e9)).toBe('1,50 Md')
    expect(formatSouls(1e13)).toBe('10,0 B')
  })

  it('bascule en notation scientifique quand les suffixes sont épuisés', () => {
    expect(formatSouls(1e22)).toBe('1,00×10^22')
  })

  it('préfixe et signe', () => {
    expect(souls(1500)).toBe('⛧1 500')
    expect(soulsGain(1500)).toBe('+⛧1 500')
    expect(soulsGain(-12.5)).toBe('-⛧12,5')
  })
})
