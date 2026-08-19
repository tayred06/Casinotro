// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { ShopUI } from './ShopUI.ts'
import { BonusSystem } from '../game/BonusSystem.ts'
import { Economy } from '../game/Economy.ts'
import { createAvaritiaPlugin } from '../game/characters/avaritia.ts'
import type { GameContext, ItemDef } from '../types/index.ts'
import { mountIndexHtml, bonusTagLabels, shopItemLabels } from '../test/domFixture.ts'

const item = (over: Partial<ItemDef> = {}): ItemDef => ({
  id: 'safety_net', name: 'Filet', description: 'test',
  level: 1, price: 15, kind: 'bonus', effect: 'safety_net', ...over,
})

function makeShop(economy = new Economy(1000), bonusSystem = new BonusSystem()) {
  const shop = new ShopUI(bonusSystem, economy, () => {}, null)
  return { shop, economy, bonusSystem }
}

describe('ShopUI — bonus actifs', () => {
  beforeEach(() => mountIndexHtml())

  /**
   * Régression : le rendu lisait `bonus.remainingUses`, champ inexistant,
   * et le comparait à null. `undefined !== null` étant vrai, chaque bonus
   * s'affichait « Nom (undefined) ».
   */
  it('un bonus permanent n\'affiche aucun compteur de charges', () => {
    const { shop, bonusSystem } = makeShop()
    bonusSystem.addBonus(item(), null)
    shop.updateDisplay()

    expect(bonusTagLabels()).toEqual(['Filet'])
    expect(bonusTagLabels().join()).not.toContain('undefined')
  })

  it('un consommable affiche ses charges restantes', () => {
    const { shop, bonusSystem } = makeShop()
    bonusSystem.addBonus(item({ id: 'lucky_streak', name: 'Coup de Chance', charges: 10 }), null)
    shop.updateDisplay()

    expect(bonusTagLabels()).toEqual(['Coup de Chance (10)'])
  })

  it('affiche la cible quand le bonus en a une, colonne 0 comprise', () => {
    const { shop, bonusSystem } = makeShop()
    bonusSystem.addBonus(item({ name: 'Colonne Dorée' }), 0)
    shop.updateDisplay()

    expect(bonusTagLabels()).toEqual(['Colonne Dorée [0]'])
  })
})

describe('ShopUI — filtrage par le personnage', () => {
  beforeEach(() => mountIndexHtml())

  const avaritiaCtx = (economy: Economy): GameContext => ({
    economy, bonusSystem: {} as any, ui: {} as any,
    addLog: () => {},
  })

  /**
   * Régression : le message de verrouillage se déclenchait dès qu'un
   * offerModifier était posé. Depuis que GameLoop en pose toujours un, tous
   * les personnages auraient affiché « Boutique verrouillée ».
   */
  it('sans filtrage, les offres restent visibles', () => {
    const { shop } = makeShop()
    shop.setOfferModifier(offer => offer)
    shop.refresh(1)

    expect(shopItemLabels().length).toBeGreaterThan(0)
    expect(shopItemLabels().join()).not.toContain('Boutique verrouillée')
  })

  it('une liste d\'offres vide n\'est pas un verrouillage', () => {
    const { shop } = makeShop()
    shop.setOfferModifier(offer => offer)
    shop.setOffers([], 1)

    expect(shopItemLabels()).toEqual([])
  })

  it('Avaritia verrouille tant que rien n\'a été gagné', () => {
    const economy = new Economy(1000)
    const { shop } = makeShop(economy)
    const plugin = createAvaritiaPlugin()
    plugin.onSetup!(avaritiaCtx(economy))

    shop.setOfferModifier(offer => plugin.offerModifier!(offer))
    shop.refresh(1)

    expect(shopItemLabels().join()).toContain('Boutique verrouillée')
  })

  it('Avaritia rouvre le niveau 1 à prix double une fois enrichie', () => {
    const economy = new Economy(1000)
    economy.debugSetEarned(500)
    const { shop } = makeShop(economy)
    const plugin = createAvaritiaPlugin()
    plugin.onSetup!(avaritiaCtx(economy))

    shop.setOfferModifier(offer => plugin.offerModifier!(offer))
    shop.setOffers([item({ price: 20 })], 1)

    const labels = shopItemLabels().join()
    expect(labels).not.toContain('Boutique verrouillée')
    expect(labels).toContain('⛧40')
  })
})

describe('ShopUI — vente d\'un bonus', () => {
  beforeEach(() => mountIndexHtml())

  it('notifie onBonusSold avec le remboursement', () => {
    const { shop, bonusSystem } = makeShop()
    bonusSystem.addBonus(item({ price: 30 }), null)
    shop.updateDisplay()

    const sold: Array<{ name: string; refund: number }> = []
    shop.setOnBonusSold((bonus, refund) => sold.push({ name: bonus.name, refund }))

    document.querySelector<HTMLElement>('#bonuses-list .bonus-tag')!.click()

    expect(sold).toEqual([{ name: 'Filet', refund: 15 }])
    expect(bonusSystem.activeBonus).toHaveLength(0)
  })
})
