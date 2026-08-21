import type { ItemDef, ItemInstance } from '../types/index.ts'
import type { Economy } from '../game/Economy.ts'
import type { BonusSystem } from '../game/BonusSystem.ts'
import { souls, soulsGain } from '../utils/format.ts'

const ITEM_GLYPHS: Record<string, string> = {
  Commun: '▲',
  Rare: '◆',
  Épique: '✚',
  Maudit: '◍',
}

const RARITY_CLASS: Record<number, string> = {
  1: 'commun',
  2: 'rare',
  3: 'épique',
}

// Assign rarity level to each bonus by price tier
function rarityFor(bonus: ItemDef): string {
  if (bonus.id === 'greed' || bonus.id.includes('maudit')) return 'maudit'
  if (bonus.level >= 3)  return 'épique'
  if (bonus.level >= 2)  return 'rare'
  return 'commun'
}

function rarityLabel(bonus: ItemDef): string {
  if (bonus.id === 'greed') return 'MAUDIT'
  const map: Record<number, string> = { 1: 'COMMUN', 2: 'RARE', 3: 'ÉPIQUE' }
  return map[bonus.level] ?? 'COMMUN'
}

export class ShopUI {
  #bonusSystem: BonusSystem
  #economy: Economy
  #onUpdate: () => void
  #selectTarget: ((offer: ItemDef) => Promise<number | string | null>) | null
  #onBonusSold: ((bonus: ItemInstance, refund: number) => void) | null = null
  #offerModifier: ((offer: ItemDef) => ItemDef | null) | null = null
  #currentOffers: ItemDef[] = []
  #rerollCost: number = 5
  /** Niveau courant de la boutique — il vient du palier, plus des gains cumulés. */
  #level: 1 | 2 | 3 = 1

  constructor(
    bonusSystem: BonusSystem,
    economy: Economy,
    onUpdate: () => void,
    selectTarget: ((offer: ItemDef) => Promise<number | string | null>) | null
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
  setOfferModifier(fn: (offer: ItemDef) => ItemDef | null)          { this.#offerModifier = fn }

  // For save/restore
  getOffers(): ItemDef[]             { return this.#currentOffers }
  getRerollCost(): number            { return this.#rerollCost }
  setRerollCost(c: number)           { this.#rerollCost = c; this.#updateRerollBtn() }
  setOffers(offers: ItemDef[], level: number = 1) {
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
      ? this.#currentOffers.map(o => this.#offerModifier!(o)).filter(Boolean) as ItemDef[]
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
      const canBuy = this.#economy.canAfford(offer.price) && !this.#bonusSystem.isFull

      const item = document.createElement('div')
      item.className = 'shop-item'

      // Name row
      const nameRow = document.createElement('div')
      nameRow.className = 'item-name-row'

      const name = document.createElement('span')
      name.className   = 'item-name'
      name.textContent = offer.name

      const badge = document.createElement('span')
      const rLabel = rarityLabel(offer)
      badge.className   = `rarity-badge rarity-${rLabel.toLowerCase()}`
      badge.textContent = rLabel

      // Plaque d'icône (design : carré 34px, glyphe selon rareté)
      const icon = document.createElement('div')
      icon.className   = 'item-icon'
      icon.textContent = ITEM_GLYPHS[rLabel] ?? '▲'

      nameRow.appendChild(name)
      nameRow.appendChild(badge)

      // Description
      const desc = document.createElement('span')
      desc.className   = 'item-desc'
      desc.textContent = offer.description

      // Footer
      const footer = document.createElement('div')
      footer.className = 'item-footer'

      const price = document.createElement('span')
      price.className   = 'item-price'
      price.textContent = souls(offer.price)

      const spacer = document.createElement('span')
      spacer.className = 'item-spacer'

      const btn = document.createElement('button')
      btn.className   = 'buy-btn' + (canBuy ? '' : ' cant-buy')
      btn.textContent = canBuy ? 'Acheter' : 'Trop cher'
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
      const refund = Math.floor(bonus.price * 0.5)

      const card = document.createElement('div')
      card.className = 'inv-item'

      const rLabel = rarityLabel(bonus)

      const icon = document.createElement('div')
      icon.className   = 'item-icon'
      icon.textContent = ITEM_GLYPHS[rLabel] ?? '▲'

      const nameRow = document.createElement('div')
      nameRow.className = 'item-name-row'

      // target et remainingCharges sont optionnels : comparer à null seul
      // laissait passer undefined et affichait « (undefined) » sur chaque bonus.
      const label = bonus.target != null ? `${bonus.name} [${bonus.target}]` : bonus.name
      const uses  = bonus.remainingCharges != null ? ` (${bonus.remainingCharges})` : ''

      const name = document.createElement('span')
      name.className   = 'bonus-tag'
      name.textContent = label + uses

      const badge = document.createElement('span')
      badge.className   = `rarity-badge rarity-${rLabel.toLowerCase()}`
      badge.textContent = rLabel

      nameRow.appendChild(name)
      nameRow.appendChild(badge)

      const desc = document.createElement('span')
      desc.className   = 'item-desc'
      desc.textContent = bonus.description

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
    const refund = this.#bonusSystem.removeBonus(bonus.instanceId)
    if (this.#onBonusSold) {
      this.#onBonusSold(bonus, refund)
    } else {
      this.#economy.addMoney(refund)
      this.addLog(`Vendu : ${bonus.name} ${soulsGain(refund)}`, true)
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

  async #handleBuy(offer: ItemDef, btn: HTMLButtonElement) {
    let target: number | string | null = null

    if (offer.needsTarget && this.#selectTarget) {
      if (btn) { btn.textContent = 'Sélectionner…'; btn.disabled = true }
      try {
        target = await this.#selectTarget(offer)
      } catch {
        // Player cancelled — restore button
        if (btn) { btn.textContent = 'Acheter'; btn.disabled = false }
        return
      }
    }

    if (!this.#economy.spend(offer.price)) return
    this.#bonusSystem.addBonus(offer, target)
    this.addLog(`Achat — ${offer.name}`, false)
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
    this.#currentOffers = this.#bonusSystem.getShopOffers(this.#level)
    this.#renderItems()
    this.#updateRerollBtn()
    this.#onUpdate()
  }
}
