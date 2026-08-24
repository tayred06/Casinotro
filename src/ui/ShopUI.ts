import type { ItemInstance, ItemRarity, ShopOffer } from '../types/index.ts'
import type { Economy } from '../game/Economy.ts'
import type { BonusSystem } from '../game/BonusSystem.ts'
import { requireItem, tierOf, RARITY_LABEL } from '../game/items/index.ts'
import { souls, soulsGain } from '../utils/format.ts'

/** Un glyphe par palier — pierre, sang, or. */
const ITEM_GLYPHS: Record<ItemRarity, string> = {
  commun: '▲',
  rare: '◆',
  epique: '✚',
}

/** Classe CSS de rareté. `epique` sans accent : les accents ne passent pas en CSS. */
const rarityClass = (rarity: ItemRarity) => `rarity-${rarity}`

export class ShopUI {
  #bonusSystem: BonusSystem
  #economy: Economy
  #onUpdate: () => void
  #selectTarget: ((offer: ShopOffer) => Promise<number | string | null>) | null
  #onBonusSold: ((bonus: ItemInstance, refund: number) => void) | null = null
  #offerModifier: ((offer: ShopOffer) => ShopOffer | null) | null = null
  #currentOffers: ShopOffer[] = []
  #rerollCost: number = 5
  /** Niveau courant de la boutique — il vient du palier, plus des gains cumulés. */
  #level: 1 | 2 | 3 = 1

  constructor(
    bonusSystem: BonusSystem,
    economy: Economy,
    onUpdate: () => void,
    selectTarget: ((offer: ShopOffer) => Promise<number | string | null>) | null
  ) {
    this.#bonusSystem  = bonusSystem
    this.#economy      = economy
    this.#onUpdate     = onUpdate
    this.#selectTarget = selectTarget

    document.getElementById('reroll-btn')!.addEventListener('click', () => {
      this.#handleReroll()
    })

    this.refresh()
  }

  // Regenerate offers + redraw everything (call on level-up, restart, restore)
  refresh(level: number = 1) {
    this.#level = level as 1 | 2 | 3
    this.#currentOffers = this.#bonusSystem.getShopOffers(this.#level)
    this.#renderItems()
    this.#renderBonuses()
    this.#updateRerollBtn()

    const levelLbl = document.getElementById('shop-level-lbl')
    if (levelLbl) levelLbl.textContent = `NIVEAU ${level}`
  }

  // Redraw bonuses + reroll btn without touching offers (call after spin)
  updateDisplay() {
    this.#renderItems()
    this.#renderBonuses()
    this.#updateRerollBtn()
  }

  setOnBonusSold(fn: (bonus: ItemInstance, refund: number) => void) { this.#onBonusSold = fn }
  setOfferModifier(fn: (offer: ShopOffer) => ShopOffer | null)      { this.#offerModifier = fn }

  // For save/restore
  getOffers(): ShopOffer[]           { return this.#currentOffers }
  getRerollCost(): number            { return this.#rerollCost }
  setRerollCost(c: number)           { this.#rerollCost = c; this.#updateRerollBtn() }
  setOffers(offers: ShopOffer[], level: number = 1) {
    this.#level = level as 1 | 2 | 3
    this.#currentOffers = offers
    this.#renderItems()
    this.#renderBonuses()
    this.#updateRerollBtn()
    const levelLbl = document.getElementById('shop-level-lbl')
    if (levelLbl) levelLbl.textContent = `NIVEAU ${level}`
  }

  addLog(text: string, muted: boolean = false) {
    const container = document.getElementById('log-entries')
    if (!container) return
    const spinNum   = document.querySelectorAll('.log-entry').length + 1

    const entry = document.createElement('div')
    entry.className = 'log-entry'

    const time = document.createElement('span')
    time.className   = 'log-spin'
    time.textContent = String(spinNum).padStart(2, '0')

    const msg = document.createElement('span')
    msg.className   = 'log-text' + (muted ? ' muted' : '')
    msg.textContent = text

    entry.appendChild(time)
    entry.appendChild(msg)

    container.prepend(entry)

    // Keep max 5 entries
    while (container.children.length > 5) {
      container.removeChild(container.lastChild!)
    }
  }

  #renderItems() {
    const container = document.getElementById('shop-items')!
    container.textContent = ''

    const visibleOffers = this.#offerModifier
      ? this.#currentOffers.map(o => this.#offerModifier!(o)).filter(Boolean) as ShopOffer[]
      : this.#currentOffers

    // Verrouillé = des offres existent mais le personnage les a toutes filtrées.
    // (Une liste d'offres vide au démarrage n'est pas un verrouillage.)
    if (visibleOffers.length === 0 && this.#currentOffers.length > 0) {
      const locked = document.createElement('div')
      locked.className = 'shop-item'
      locked.style.color = '#4f5453'
      locked.style.fontStyle = 'italic'
      locked.style.fontSize = '12.5px'
      locked.textContent = 'Boutique verrouillée — enrichissez-vous.'
      container.appendChild(locked)
      return
    }

    visibleOffers.forEach(offer => {
      const def = requireItem(offer.defId)
      const tier = tierOf(def, offer.rarity)
      const affordable = this.#economy.canAfford(offer.price)
      // Pour un item ciblé, savoir si l'achat fusionne dépend d'une cible choisie APRÈS
      // le clic : le bouton reste actif, c'est le sélecteur de cible qui tranche.
      const state = def.needsTarget ? this.#targetedBuyState(offer) : this.#bonusSystem.buyState(offer.defId, offer.rarity, null)

      const item = document.createElement('div')
      item.className = `shop-item ${rarityClass(offer.rarity)}`

      const nameRow = document.createElement('div')
      nameRow.className = 'item-name-row'

      const name = document.createElement('span')
      name.className   = 'item-name'
      name.textContent = def.name

      const badge = document.createElement('span')
      badge.className   = `rarity-badge ${rarityClass(offer.rarity)}`
      badge.textContent = RARITY_LABEL[offer.rarity]

      // Plaque d'icône (design : carré 34px, glyphe selon rareté)
      const icon = document.createElement('div')
      icon.className   = `item-icon ${rarityClass(offer.rarity)}`
      icon.textContent = ITEM_GLYPHS[offer.rarity]

      nameRow.appendChild(name)
      nameRow.appendChild(badge)

      const desc = document.createElement('span')
      desc.className   = 'item-desc'
      desc.textContent = tier.description

      const footer = document.createElement('div')
      footer.className = 'item-footer'

      const price = document.createElement('span')
      price.className   = 'item-price'
      price.textContent = souls(offer.price)

      const spacer = document.createElement('span')
      spacer.className = 'item-spacer'

      const btn = document.createElement('button')
      const label = this.#buyLabel(state, affordable)
      const canBuy = affordable && state !== 'full' && state !== 'max_owned'
      btn.className   = 'buy-btn' + (canBuy ? '' : ' cant-buy') + (state === 'fusion' ? ' fusion' : '')
      btn.textContent = label
      btn.title       = this.#buyHint(state, affordable, def.maxOwned)
      if (canBuy) {
        btn.addEventListener('click', () => this.#handleBuy(offer, btn))
      }

      footer.appendChild(price)
      footer.appendChild(spacer)
      footer.appendChild(btn)

      const body = document.createElement('div')
      body.className = 'item-body'
      body.appendChild(nameRow)
      body.appendChild(desc)

      const head = document.createElement('div')
      head.className = 'item-head'
      head.appendChild(icon)
      head.appendChild(body)

      item.appendChild(head)
      item.appendChild(footer)

      container.appendChild(item)
    })
  }

  /**
   * Pour un item ciblé, l'état 3 (bloqué) n'existe que si AUCUNE cible ne mène à une
   * fusion alors que l'inventaire est plein.
   */
  #targetedBuyState(offer: ShopOffer) {
    const targets = this.#candidateTargets(offer)
    const states = targets.map(t => this.#bonusSystem.buyState(offer.defId, offer.rarity, t))
    if (states.includes('ok')) return 'ok'
    if (states.includes('fusion')) return 'fusion'
    return states[0] ?? 'full'
  }

  /** Cibles envisageables : les rouleaux, ou les symboles déjà ciblés + un neuf. */
  #candidateTargets(offer: ShopOffer): Array<number | string | null> {
    const def = requireItem(offer.defId)
    if (def.needsTarget === 'column') {
      return Array.from({ length: this.#bonusSystem.reelCount }, (_, i) => i)
    }
    if (def.needsTarget === 'symbol') {
      const owned = this.#bonusSystem.activeBonus
        .filter(i => i.defId === offer.defId)
        .map(i => i.target as string)
      // `null` représente « un symbole encore jamais ciblé ».
      return [...owned, null]
    }
    return [null]
  }

  #buyLabel(state: string, affordable: boolean): string {
    if (!affordable) return 'Trop cher'
    if (state === 'fusion') return 'Fusionner'
    if (state === 'full') return 'Inventaire plein'
    if (state === 'max_owned') return 'Déjà possédé'
    return 'Acheter'
  }

  #buyHint(state: string, affordable: boolean, maxOwned?: number): string {
    if (!affordable) return "Pas assez d'âmes."
    if (state === 'fusion') return 'Fusionne avec un exemplaire déjà possédé — libère un emplacement.'
    if (state === 'full') return 'Inventaire plein : vendez un bonus ou visez une fusion.'
    if (state === 'max_owned') return `Limité à ${maxOwned ?? 1} exemplaire par run.`
    return ''
  }

  setLevelLabel(text: string) {
    const el = document.getElementById('shop-level-lbl')
    if (el) el.textContent = text
  }

  #renderBonuses() {
    const container = document.getElementById('bonuses-list')!
    container.textContent = ''

    const active = this.#bonusSystem.activeBonus
    if (active.length === 0) {
      const none = document.createElement('span')
      none.className   = 'no-bonus'
      none.textContent = 'Aucun bonus actif.'
      container.appendChild(none)
      return
    }

    active.forEach(bonus => {
      const def = requireItem(bonus.defId)
      const tier = tierOf(def, bonus.rarity)
      const refund = Math.floor(tier.price * 0.5)

      const card = document.createElement('div')
      card.className = `inv-item ${rarityClass(bonus.rarity)}`

      const icon = document.createElement('div')
      icon.className   = `item-icon ${rarityClass(bonus.rarity)}`
      icon.textContent = ITEM_GLYPHS[bonus.rarity]

      const nameRow = document.createElement('div')
      nameRow.className = 'item-name-row'

      // target et remainingCharges sont optionnels : comparer à null seul
      // laissait passer undefined et affichait « (undefined) » sur chaque bonus.
      const label = bonus.target != null ? `${def.name} [${bonus.target}]` : def.name
      const uses  = bonus.remainingCharges != null ? ` (${bonus.remainingCharges})` : ''

      const name = document.createElement('span')
      name.className   = 'bonus-tag'
      name.textContent = label + uses

      const badge = document.createElement('span')
      badge.className   = `rarity-badge ${rarityClass(bonus.rarity)}`
      badge.textContent = RARITY_LABEL[bonus.rarity]

      nameRow.appendChild(name)
      nameRow.appendChild(badge)

      const desc = document.createElement('span')
      desc.className   = 'item-desc'
      desc.textContent = tier.description

      const body = document.createElement('div')
      body.className = 'item-body'
      body.appendChild(nameRow)
      body.appendChild(desc)

      const head = document.createElement('div')
      head.className = 'item-head'
      head.appendChild(icon)
      head.appendChild(body)

      const footer = document.createElement('div')
      footer.className = 'item-footer'

      const price = document.createElement('span')
      price.className   = 'item-price'
      price.textContent = souls(refund)

      const spacer = document.createElement('span')
      spacer.className = 'item-spacer'

      const btn = document.createElement('button')
      btn.className   = 'sell-btn'
      btn.textContent = 'Vendre'
      btn.title       = `Vendre pour ${souls(refund)}`
      btn.addEventListener('click', () => this.#handleSell(bonus))

      footer.appendChild(price)
      footer.appendChild(spacer)
      footer.appendChild(btn)

      card.appendChild(head)
      card.appendChild(footer)

      container.appendChild(card)
    })
  }

  #handleSell(bonus: ItemInstance) {
    const name = requireItem(bonus.defId).name
    const refund = this.#bonusSystem.removeBonus(bonus.instanceId)
    if (this.#onBonusSold) {
      this.#onBonusSold(bonus, refund)
    } else {
      this.#economy.addMoney(refund)
      this.addLog(`Vendu : ${name} ${soulsGain(refund)}`, true)
    }
    this.#renderBonuses()
    this.#renderItems()
    this.#updateRerollBtn()
    this.#onUpdate()
  }

  #updateRerollBtn() {
    const btn  = document.getElementById('reroll-btn')!
    const free = this.#bonusSystem.getModifiers().freeRerolls > 0
    const cost = free ? 'GRATUIT' : souls(this.#rerollCost)
    ;(btn as HTMLButtonElement).textContent = `Renouveler les offres — ${cost}`
    ;(btn as HTMLButtonElement).disabled    = !free && !this.#economy.canAfford(this.#rerollCost)
  }

  async #handleBuy(offer: ShopOffer, btn: HTMLButtonElement) {
    const def = requireItem(offer.defId)
    let target: number | string | null = null

    if (def.needsTarget && this.#selectTarget) {
      if (btn) { btn.textContent = 'Sélectionner…'; btn.disabled = true }
      try {
        target = await this.#selectTarget(offer)
      } catch {
        // Player cancelled — restore button
        if (btn) { btn.textContent = 'Acheter'; btn.disabled = false }
        return
      }
    }

    // La vérification passe après la sélection de cible : c'est elle qui décide si
    // l'achat fusionne, donc s'il est légal à inventaire plein.
    if (this.#bonusSystem.buyState(offer.defId, offer.rarity, target) === 'full'
        || this.#bonusSystem.buyState(offer.defId, offer.rarity, target) === 'max_owned') {
      if (btn) { btn.textContent = 'Acheter'; btn.disabled = false }
      this.#renderItems()
      return
    }
    if (!this.#economy.spend(offer.price)) return
    const bought = this.#bonusSystem.acquire(offer.defId, offer.rarity, target)
    this.addLog(bought?.fused ? `Fusion — ${def.name}` : `Achat — ${def.name}`, false)
    // Un achat renouvelle les offres, gratuitement et sans toucher au coût de
    // reroll : la boutique ne garde jamais un item déjà acheté à l'écran.
    this.#currentOffers = this.#bonusSystem.getShopOffers(this.#level)
    this.#renderBonuses()
    this.#renderItems()
    this.#updateRerollBtn()
    this.#onUpdate()
  }

  #handleReroll() {
    const mods = this.#bonusSystem.getModifiers()
    if (mods.freeRerolls > 0) {
      this.#bonusSystem.useFreeReroll()
    } else {
      if (!this.#economy.spend(this.#rerollCost)) return
      this.#rerollCost += 5
    }
    this.#currentOffers = this.#bonusSystem.getShopOffers(
      this.#level, undefined, { guaranteeRare: mods.rerollGuaranteesRare })
    this.#renderItems()
    this.#updateRerollBtn()
    this.#onUpdate()
  }
}
