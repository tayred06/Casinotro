import { describe, it, expect } from 'vitest'
import { weightedRandom, randomInt, shuffleArray } from './Random.js'

describe('weightedRandom', () => {
  it('retourne toujours une valeur de la liste', () => {
    const items = [
      { value: 'a', weight: 10 },
      { value: 'b', weight: 5 },
    ]
    for (let i = 0; i < 100; i++) {
      const result = weightedRandom(items)
      expect(['a', 'b']).toContain(result)
    }
  })

  it('retourne la seule valeur si weight = 0 pour les autres', () => {
    const items = [
      { value: 'a', weight: 100 },
      { value: 'b', weight: 0 },
    ]
    for (let i = 0; i < 20; i++) {
      expect(weightedRandom(items)).toBe('a')
    }
  })
})

describe('randomInt', () => {
  it('retourne un entier dans [min, max]', () => {
    for (let i = 0; i < 200; i++) {
      const n = randomInt(3, 7)
      expect(n).toBeGreaterThanOrEqual(3)
      expect(n).toBeLessThanOrEqual(7)
      expect(Number.isInteger(n)).toBe(true)
    }
  })

  it('retourne min quand min === max', () => {
    expect(randomInt(5, 5)).toBe(5)
  })
})

describe('shuffleArray', () => {
  it('retourne un tableau de même longueur avec les mêmes éléments', () => {
    const arr = [1, 2, 3, 4, 5]
    const result = shuffleArray(arr)
    expect(result).toHaveLength(arr.length)
    expect(result.sort()).toEqual([...arr].sort())
  })

  it('ne modifie pas le tableau original', () => {
    const arr = [1, 2, 3]
    shuffleArray(arr)
    expect(arr).toEqual([1, 2, 3])
  })
})
