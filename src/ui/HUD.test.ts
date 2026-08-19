// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { HUD } from './HUD.ts'
import { Economy } from '../game/Economy.ts'
import { Progression } from '../meta/Progression.ts'
import { mountIndexHtml, betChipLabels } from '../test/domFixture.ts'

describe('HUD — chips de mise', () => {
  let economy: Economy
  let hud: HUD

  beforeEach(() => {
    mountIndexHtml()
    economy = new Economy(100)
    hud = new HUD(economy, () => {}, (a: number) => economy.setBet(a))
  })

  it('affiche les paliers initiaux', () => {
    expect(betChipLabels()).toEqual(['⛧1', '⛧2', '⛧5', '⛧10', '⛧25'])
  })

  /**
   * Régression : restoreBetChips() n'avait aucun appelant, donc après un
   * changement de palier les chips affichaient encore les anciennes mises et
   * un clic était rejeté en silence par Economy.setBet().
   */
  it('suit les paliers après un changement de palier', () => {
    economy.setBetOptions([25, 50, 125, 250, 625])
    hud.restoreBetChips()
    expect(betChipLabels()).toEqual(['⛧25', '⛧50', '⛧125', '⛧250', '⛧625'])
  })

  it('un clic sur une chip du nouveau palier change bien la mise', () => {
    economy.setBetOptions([25, 50, 125, 250, 625])
    hud.restoreBetChips()

    const chips = document.querySelectorAll<HTMLButtonElement>('#bet-chips .chip')
    chips[2]!.click()

    expect(economy.currentBet).toBe(125)
    expect(chips[2]!.classList.contains('active')).toBe(true)
  })

  it('affiche le record depuis Progression, pas depuis Economy', () => {
    const progression = new Progression()
    progression.updateHighscore(4321)
    const h = new HUD(new Economy(100, progression), () => {}, () => {})
    h.update({ level: 1, goal: 500 } as any)
    expect(document.getElementById('highscore-display')!.textContent).toBe('⛧4321.00')
  })
})
