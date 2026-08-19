import { describe, it, expect } from 'vitest'
import { getCharacterPlugin, CHARACTER_IDS } from './index.ts'
import { CHARACTERS } from '../Characters.ts'

describe('getCharacterPlugin', () => {
  it('returns a plugin for each character', () => {
    for (const id of CHARACTER_IDS) {
      const plugin = getCharacterPlugin(id)
      expect(plugin.id).toBe(id)
    }
  })

  it('every declared character has a plugin under the same id', () => {
    for (const char of CHARACTERS) {
      const plugin = getCharacterPlugin(char.id)
      expect(plugin.id).toBe(char.id)
    }
    expect([...CHARACTER_IDS].sort()).toEqual(CHARACTERS.map((c) => c.id).sort())
  })

  it('gula returns a new instance each time (factory)', () => {
    const a = getCharacterPlugin('gula')
    const b = getCharacterPlugin('gula')
    expect(a).not.toBe(b)
  })

  it('luxuria returns the same instance (singleton)', () => {
    const a = getCharacterPlugin('luxuria')
    const b = getCharacterPlugin('luxuria')
    expect(a).toBe(b)
  })

  it('throws for unknown id', () => {
    expect(() => getCharacterPlugin('fantome')).toThrow('Personnage inconnu')
  })
})
