import { describe, it, expect } from 'vitest'
import { getCharacterPlugin, CHARACTER_IDS } from './index.ts'
import { CHARACTERS } from '../Characters.ts'

describe('cohérence CHARACTERS / registre de plugins', () => {
  it('chaque personnage jouable a un plugin du même id', () => {
    for (const char of CHARACTERS) {
      expect(() => getCharacterPlugin(char.id)).not.toThrow()
      expect(getCharacterPlugin(char.id).id).toBe(char.id)
    }
  })

  it('aucun plugin orphelin dans CHARACTER_IDS', () => {
    const declared = CHARACTERS.map(c => c.id).sort()
    expect([...CHARACTER_IDS].sort()).toEqual(declared)
  })
})

describe('getCharacterPlugin', () => {
  it('returns a plugin for each character', () => {
    for (const id of CHARACTER_IDS) {
      const plugin = getCharacterPlugin(id)
      expect(plugin.id).toBe(id)
    }
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
