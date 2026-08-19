// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GameLoop } from './GameLoop.ts'
import { mountIndexHtml, betChipLabels } from '../test/domFixture.ts'

const SAVE_KEY = 'casinotro_v3'

const overlayVisible = (id: string) =>
  !document.getElementById(id)!.classList.contains('hidden')

/** Sauvegarde minimale valide, palier 3. */
function stage3Save() {
  return {
    run: {
      stage: 3,
      stageGoals: [500, 2000, 10000],
      betOptions: [25, 50, 125, 250, 625],
      machineId: 'megaways',
      characterId: 'luxuria',
      spinCount: 12,
      dialoguePlayed: true,
    },
    economy: {
      balance: 3000, currentBet: 125, totalEarned: 4000,
      totalWagered: 900, totalReturned: 800,
    },
    bonusSystem: { active: [], chainCounts: {}, chainBonuses: {}, stickyPositions: {} },
    shopOffers: [],
    rerollCost: 25,
    grid: null,
  }
}

describe('GameLoop — reprise de sauvegarde', () => {
  beforeEach(() => {
    mountIndexHtml()
    vi.restoreAllMocks()
  })

  /**
   * Régression : boot() ne réappliquait pas run.betOptions à Economy, donc
   * recharger la page en palier 2/3 ramenait les mises initiales.
   */
  it('restaure les paliers de mise du palier sauvegardé', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(stage3Save()))
    new GameLoop()

    expect(betChipLabels()).toEqual(['⛧25', '⛧50', '⛧125', '⛧250', '⛧625'])
  })

  it('conserve la mise sauvegardée, validée contre les bons paliers', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(stage3Save()))
    new GameLoop()

    const active = document.querySelector('#bet-chips .chip.active')
    expect(active?.textContent).toBe('⛧125')
  })

  it('reprend la partie sans afficher la sélection de personnage', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(stage3Save()))
    new GameLoop()

    expect(overlayVisible('character-select-overlay')).toBe(false)
  })
})

describe('GameLoop — sauvegarde corrompue', () => {
  beforeEach(() => {
    mountIndexHtml()
    vi.restoreAllMocks()
  })

  /**
   * Régression : run.restore(save.run) n'était pas protégé. Une sauvegarde
   * malformée levait dans le constructeur et laissait un écran noir jusqu'à
   * un vidage manuel de localStorage.
   */
  const corrupted: Array<[string, string]> = [
    ['JSON invalide', '{ pas du json'],
    ['objet vide', '{}'],
    ['run absent', JSON.stringify({ economy: {}, bonusSystem: {} })],
    ['personnage inconnu', JSON.stringify({ ...stage3Save(), run: { ...stage3Save().run, characterId: 'fantome' } })],
  ]

  for (const [label, payload] of corrupted) {
    it(`ne bloque pas le démarrage — ${label}`, () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      localStorage.setItem(SAVE_KEY, payload)

      expect(() => new GameLoop()).not.toThrow()
    })
  }

  it('repart sur la sélection de personnage et purge la sauvegarde', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    localStorage.setItem(SAVE_KEY, JSON.stringify({ run: { stage: 'nawak' }, economy: null }))

    new GameLoop()

    expect(overlayVisible('character-select-overlay')).toBe(true)
    expect(localStorage.getItem(SAVE_KEY)).toBeNull()
  })
})

describe('GameLoop — nouvelle partie', () => {
  beforeEach(() => {
    mountIndexHtml()
    vi.restoreAllMocks()
  })

  it('démarre au palier 1 avec les mises initiales', () => {
    const loop = new GameLoop()
    loop.startRun('luxuria')

    expect(betChipLabels()).toEqual(['⛧1', '⛧2', '⛧5', '⛧10', '⛧25'])
    expect(document.getElementById('balance-display')!.textContent).toBe('⛧100.00')
  })

  /**
   * Régression : le coût de reroll n'était pas sauvegardé et repartait à 5⛧
   * à chaque rechargement — renouveler la boutique devenait gratuit.
   */
  it('restaure le coût de reroll sauvegardé', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(stage3Save()))
    new GameLoop()

    expect(document.getElementById('reroll-btn')!.textContent).toContain('⛧25')
  })

  it('remet le coût de reroll à 5⛧ sur une nouvelle partie', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(stage3Save()))
    const loop = new GameLoop()
    loop.startRun('luxuria')

    expect(document.getElementById('reroll-btn')!.textContent).toContain('⛧5')
  })

  it('applique le thème du personnage choisi', () => {
    const loop = new GameLoop()
    loop.startRun('gula')

    expect(document.getElementById('char-hud-name')!.textContent).toBe('Le Convive')
    expect(document.getElementById('char-hud-sin')!.textContent).toBe('Gula')
  })
})
