// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GameLoop } from './GameLoop.ts'
import { STAGE_QUOTA_K, ENDLESS_GOAL_FACTOR, STAGE_HP_FLOOR } from './RunState.ts'
import { mountIndexHtml, betChipLabels } from '../test/domFixture.ts'

const SAVE_KEY = 'casinotro_v3'

const overlayVisible = (id: string) =>
  !document.getElementById(id)!.classList.contains('hidden')

/** Sauvegarde minimale valide, palier 3. */
function stage3Save() {
  return {
    run: {
      stage: 3,
      betOptions: [8, 16, 24, 40, 80],
      machineId: 'megaways',
      characterId: 'luxuria',
      spinCount: 12,
      dialoguePlayed: true,
    },
    economy: {
      balance: 3000, currentBet: 24, totalEarned: 4000, stageEarned: 0,
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

    expect(betChipLabels()).toEqual(['⛧8', '⛧16', '⛧24', '⛧40', '⛧80'])
  })

  it('conserve la mise sauvegardée, validée contre les bons paliers', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(stage3Save()))
    new GameLoop()

    const active = document.querySelector('#bet-chips .chip.active')
    expect(active?.textContent).toBe('⛧24')
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

    expect(betChipLabels()).toEqual(['⛧1', '⛧2', '⛧3', '⛧5', '⛧10'])
    expect(document.getElementById('balance-display')!.textContent)
      .toBe(`⛧${STAGE_HP_FLOOR[0].toFixed(2)}`)
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

  /**
   * Régression : les paliers de mise restaient cliquables sur Gula, dont la
   * mise est censée n'être qu'imposée par l'escalade.
   */
  it("remplace les paliers par la mise imposée sur Gula", () => {
    const loop = new GameLoop()
    loop.startRun('gula')

    expect(document.getElementById('gula-bet-display')!.textContent).toBe('⛧1')
    expect(betChipLabels()).not.toContain('⛧5')

    loop.startRun('luxuria')
    expect(document.getElementById('gula-bet-display')).toBeNull()
    expect(betChipLabels()).toEqual(['⛧1', '⛧2', '⛧3', '⛧5', '⛧10'])
  })

  /**
   * Régression : setOnBonusSold n'était jamais branché, donc dévorer un bonus
   * ne déclenchait pas onShopSell et la mise de Gula restait à son niveau.
   */
  it('remet la mise de Gula à 1⛧ quand on dévore un bonus', () => {
    const loop = new GameLoop()
    loop.startRun('gula')

    const economy = (loop as any).economy
    const bonusSystem = (loop as any).bonusSystem
    const shop = (loop as any).shop

    economy.forceSetBet(12)
    bonusSystem.addBonus({ id: 'x', name: 'Test', price: 20, effect: 'chain', description: '' } as any)
    ;(shop as any).updateDisplay()

    const balanceBefore = economy.balance
    document.querySelector<HTMLElement>('.bonus-tag')!.click()

    expect(economy.currentBet).toBe(1)
    expect(economy.balance).toBe(balanceBefore) // devourRefundPercent: 0
    expect(document.getElementById('gula-bet-display')!.textContent).toBe('⛧1')
  })

  it('offre le Porte-Bonheur au démarrage de Gula', () => {
    const loop = new GameLoop()
    loop.startRun('gula')

    const active = (loop as any).bonusSystem.activeBonus
    expect(active.map((b: any) => b.id)).toContain('luck_boost')

    loop.startRun('luxuria')
    expect((loop as any).bonusSystem.activeBonus).toHaveLength(0)
  })

  it('ajoute 2 emplacements de bonus à chaque quota franchi', () => {
    const loop = new GameLoop()
    loop.startRun('luxuria')

    const bonusSystem = (loop as any).bonusSystem
    expect(bonusSystem.maxSlots).toBe(5)

    ;(loop as any).economy.addWin((loop as any).run.currentGoal)
    ;(loop as any).checkStageProgress([])

    expect((loop as any).run.stage).toBe(2)
    expect(bonusSystem.maxSlots).toBe(7)
  })

  it('poursuit la partie en mode infini depuis l\'écran de victoire', () => {
    const loop = new GameLoop()
    loop.startRun('luxuria')

    const run = (loop as any).run
    run.stage = 3
    ;(loop as any).economy.addWin(run.currentGoal)
    ;(loop as any).checkStageProgress([])

    expect(overlayVisible('end-screen-overlay')).toBe(true)
    document.getElementById('es-continue-btn')!.click()

    expect(overlayVisible('end-screen-overlay')).toBe(false)
    expect(run.isEndless).toBe(true)
    expect(run.currentGoal).toBe(Math.round(STAGE_QUOTA_K[2] * run.minBet * ENDLESS_GOAL_FACTOR))
    expect((loop as any).runEnded).toBe(false)
    expect((loop as any).bonusSystem.maxSlots).toBe(7)
  })

  it('franchit le quota sur les gains cumulés, même avec un solde ras', () => {
    const loop = new GameLoop()
    loop.startRun('luxuria')
    const economy = (loop as any).economy
    const run = (loop as any).run

    // Solde presque vide mais quota rempli : le palier doit passer quand même.
    economy.spend(economy.balance - 1)
    economy.addWin(run.currentGoal)
    ;(loop as any).checkStageProgress([])

    expect(run.stage).toBe(2)
    expect(economy.stageEarned).toBe(0)
    // Le plancher du palier 2 restaure la vitalité.
    expect(economy.balance).toBe(run.hpFloor)
    expect(economy.maxBalance).toBe(run.hpCap)
  })

  it('un gros solde sans gains ne fait pas avancer le palier', () => {
    const loop = new GameLoop()
    loop.startRun('luxuria')
    ;(loop as any).economy.addMoney(100000)
    ;(loop as any).checkStageProgress([])

    expect((loop as any).run.stage).toBe(1)
  })

  it('applique le thème du personnage choisi', () => {
    const loop = new GameLoop()
    loop.startRun('gula')

    expect(document.getElementById('char-hud-name')!.textContent).toBe('Le Convive')
    expect(document.getElementById('char-hud-sin')!.textContent).toBe('Gula')
  })
})
