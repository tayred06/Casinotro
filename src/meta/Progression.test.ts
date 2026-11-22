// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { Progression } from './Progression.ts'

const KEY = 'casinotro_meta_v2'
const LEGACY_KEY = 'casinotro_highscore'

describe('Progression', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('démarre à 0 avec rigide débloquée', () => {
    const p = new Progression()
    expect(p.highscore).toBe(0)
    expect(p.unlockedMachines.has('rigide')).toBe(true)
  })

  it('updateHighscore ne retient que les valeurs supérieures', () => {
    const p = new Progression()
    p.updateHighscore(500)
    p.updateHighscore(200)
    expect(p.highscore).toBe(500)
  })

  it('persiste le record entre deux instances', () => {
    new Progression().updateHighscore(1234)
    expect(new Progression().highscore).toBe(1234)
  })

  it('unlockMachine persiste', () => {
    new Progression().unlockMachine('bonus_buy')
    expect(new Progression().unlockedMachines.has('bonus_buy')).toBe(true)
  })

  describe('migration depuis l\'ancienne clé d\'Economy', () => {
    it('récupère un record écrit sous casinotro_highscore', () => {
      localStorage.setItem(LEGACY_KEY, '4200')
      const p = new Progression()
      expect(p.highscore).toBe(4200)
    })

    it('retire l\'ancienne clé après migration', () => {
      localStorage.setItem(LEGACY_KEY, '4200')
      new Progression()
      expect(localStorage.getItem(LEGACY_KEY)).toBeNull()
    })

    it('ne régresse pas si le méta est déjà meilleur', () => {
      localStorage.setItem(KEY, JSON.stringify({ highscore: 9000, unlockedMachines: ['rigide'] }))
      localStorage.setItem(LEGACY_KEY, '100')
      expect(new Progression().highscore).toBe(9000)
    })
  })

  describe('tutoriel', () => {
    it('démarre non fait, sans étape vue', () => {
      const p = new Progression()
      expect(p.tutorialDone).toBe(false)
      expect(p.tutorialSeen.size).toBe(0)
    })

    it('persiste fin et étapes vues dans casinotro_meta_v2', () => {
      new Progression().saveTutorial(true, ['mise', 'quota'])
      const raw = JSON.parse(localStorage.getItem(KEY)!)
      expect(raw.tutorialDone).toBe(true)
      expect(raw.tutorialSeen).toEqual(['mise', 'quota'])
      const p = new Progression()
      expect(p.tutorialDone).toBe(true)
      expect([...p.tutorialSeen]).toEqual(['mise', 'quota'])
    })

    it('un profil sans champ tuto le voit', () => {
      localStorage.setItem(KEY, JSON.stringify({ highscore: 9000, unlockedMachines: ['rigide'] }))
      const p = new Progression()
      expect(p.tutorialDone).toBe(false)
      expect(p.highscore).toBe(9000)
    })

    it('ne perd pas le tuto quand un autre champ est sauvegardé', () => {
      new Progression().saveTutorial(true, [])
      new Progression().updateHighscore(10)
      expect(new Progression().tutorialDone).toBe(true)
    })
  })
})
