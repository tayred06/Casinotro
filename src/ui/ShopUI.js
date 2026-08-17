import { BONUS_POOL } from '../game/BonusSystem.js'

const RARITY_CLASS = {
  1: 'commun',
  2: 'rare',
  3: 'épique',
}

// Assign rarity level to each bonus by price tier
function rarityFor(bonus) {
  if (bonus.id === 'greed' || bonus.id.includes('maudit')) return 'maudit'
  if (bonus.level >= 3)  return 'épique'
  if (bonus.level >= 2)  return 'rare'
  return 'commun'
}

function rarityLabel(bonus) {
  if (bonus.id === 'greed') return 'MAUDIT'
  const map = { 1: 'COMMUN', 2: 'RARE', 3: 'ÉPIQUE' }
  return map[bonus.level] ?? 'COMMUN'
}

export class ShopUI {
  #bonusSystem
  #economy
  #onUpdate
  #selectTarget
  #onBonusSold = null
  #offerModifier = null
  #currentOffers = []
  #rerollCost = 5

  constructor(bonusSystem, economy, onUpdate, selectTarget) {
    this.#bonusSystem  = bonusSystem
    this.#economy      = economy
    this.#onUpdate     = onUpdate
    this.#selectTarget = selectTarget

    document.getElementById('reroll-btn').addEventListener('click', () => {
      this.#handleReroll()
    })

    this.refresh()
  }

  // Regenerate offers + redraw everything (call on level-up, restart, restore)
  refresh(level = 1) {
    this.#currentOffers = this.#bonusSystem.getShopOffers(level)
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

  setOnBonusSold(fn)    { this.#onBonusSold    = fn }
  setOfferModifier(fn)  { this.#offerModifier  = fn }

  // For save/restore
  getOffers()            { return this.#currentOffers }
  getRerollCost()        { return this.#rerollCost }
  setRerollCost(c)       { this.#rerollCost = c }
  setOffers(offers, level = 1) {
    this.#currentOffers = offers
    this.#renderItems()
    this.#renderBonuses()
    this.#updateRerollBtn()
    const levelLbl = document.getElementById('shop-level-lbl')
    if (levelLbl) levelLbl.textContent = `NIVEAU ${level}`
  }

  addLog(text, muted = false) {
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
      container.removeChild(container.lastChild)
    }
  }

  #renderItems() {
    const container = document.getElementById('shop-items')
    container.textContent = ''

    const visibleOffers = this.#offerModifier
      ? this.#currentOffers.map(o => this.#offerModifier(o)).filter(Boolean)
      : this.#currentOffers

    if (visibleOffers.length === 0 && this.#offerModifier) {
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
      price.textContent = `$${offer.price}`

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

      item.appendChild(nameRow)
      item.appendChild(desc)
      item.appendChild(footer)

      container.appendChild(item)
    })
  }

  setLevelLabel(text) {
    const el = document.getElementById('shop-level-lbl')
    if (el) el.textContent = text
  }

  #renderBonuses() {
    const container = document.getElementById('bonuses-list')
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
      const tag = document.createElement('span')
      tag.className   = 'bonus-tag'
      const label = bonus.target !== null ? `${bonus.name} [${bonus.target}]` : bonus.name
      const uses  = bonus.remainingUses !== null ? ` (${bonus.remainingUses})` : ''
      tag.textContent = label + uses
      tag.title       = `Vendre pour $${Math.floor(bonus.price * 0.5)}`
      tag.addEventListener('click', () => {
        const refund = this.#bonusSystem.removeBonus(bonus.instanceId)
        if (this.#onBonusSold) {
          this.#onBonusSold(bonus, refund)
        } else {
          this.#economy.addMoney(refund)
          this.addLog(`Vendu : ${bonus.name} +$${refund}`, true)
        }
        this.#renderBonuses()
        this.#renderItems()
        this.#updateRerollBtn()
        this.#onUpdate()
      })
      container.appendChild(tag)
    })
  }

  #updateRerollBtn() {
    const btn  = document.getElementById('reroll-btn')
    const free = this.#bonusSystem.getModifiers().freeRerolls > 0
    const cost = free ? 'GRATUIT' : `$${this.#rerollCost}`
    btn.textContent = `Renouveler les offres — ${cost}`
    btn.disabled    = !free && !this.#economy.canAfford(this.#rerollCost)
  }

  async #handleBuy(offer, btn) {
    let target = null

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
    const level = this.#economy.getShopLevel()
    this.#currentOffers = this.#bonusSystem.getShopOffers(level)
    this.#renderItems()
    this.#updateRerollBtn()
    this.#onUpdate()
  }
}
