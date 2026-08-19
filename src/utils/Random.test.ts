import { describe, it, expect, afterEach } from 'vitest'
import { createRng, seedRng, setRng, random, randomInt, shuffleArray, weightedRandom } from './Random.ts'

afterEach(() => setRng(null))

describe('createRng', () => {
  it('produit la même séquence pour la même graine', () => {
    const a = createRng(99)
    const b = createRng(99)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('produit des séquences différentes pour des graines différentes', () => {
    expect(createRng(1)()).not.toBe(createRng(2)())
  })

  it('reste dans [0, 1)', () => {
    const rng = createRng(5)
    for (let i = 0; i < 1000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('seedRng', () => {
  it('rend tous les helpers déterministes', () => {
    seedRng(3)
    const first = [random(), randomInt(1, 100), shuffleArray([1, 2, 3, 4, 5])]
    seedRng(3)
    const second = [random(), randomInt(1, 100), shuffleArray([1, 2, 3, 4, 5])]
    expect(first).toEqual(second)
  })
})

describe('randomInt', () => {
  it('retourne toujours un entier', () => {
    seedRng(21)
    for (let i = 0; i < 200; i++) expect(Number.isInteger(randomInt(3, 7))).toBe(true)
  })

  it('retourne min quand min === max', () => {
    expect(randomInt(5, 5)).toBe(5)
  })

  it('respecte les bornes, incluses', () => {
    seedRng(11)
    const seen = new Set<number>()
    for (let i = 0; i < 500; i++) {
      const v = randomInt(2, 5)
      expect(v).toBeGreaterThanOrEqual(2)
      expect(v).toBeLessThanOrEqual(5)
      seen.add(v)
    }
    expect(seen).toEqual(new Set([2, 3, 4, 5]))
  })
})

describe('weightedRandom', () => {
  it('retourne toujours une valeur de la liste', () => {
    seedRng(6)
    const items = [{ value: 'a', weight: 10 }, { value: 'b', weight: 5 }]
    for (let i = 0; i < 200; i++) expect(['a', 'b']).toContain(weightedRandom(items))
  })

  it('ne tire jamais un poids nul quand un autre est disponible', () => {
    seedRng(4)
    const items = [{ value: 'a', weight: 0 }, { value: 'b', weight: 10 }]
    for (let i = 0; i < 200; i++) expect(weightedRandom(items)).toBe('b')
  })
})

describe('shuffleArray', () => {
  it('ne mute pas la source et conserve les éléments', () => {
    seedRng(8)
    const src = [1, 2, 3, 4, 5]
    const out = shuffleArray(src)
    expect(src).toEqual([1, 2, 3, 4, 5])
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5])
  })
})
