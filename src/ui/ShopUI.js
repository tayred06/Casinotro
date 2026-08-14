import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import { BONUS_POOL } from '../game/BonusSystem.js'
import { SYMBOLS } from '../game/Symbols.js'

const W = 400
const H = 750

const S_TITLE  = new TextStyle({ fontSize: 20, fill: 0xFFFFFF, fontFamily: 'monospace', fontWeight: 'bold' })
const S_NAME   = new TextStyle({ fontSize: 15, fill: 0xFFFFFF, fontFamily: 'monospace', fontWeight: 'bold' })
const S_DESC   = new TextStyle({ fontSize: 12, fill: 0xAAAAAA, fontFamily: 'monospace', wordWrap: true, wordWrapWidth: 260 })
const S_PRICE  = new TextStyle({ fontSize: 14, fill: 0x88FF88, fontFamily: 'monospace', fontWeight: 'bold' })
const S_BTN    = new TextStyle({ fontSize: 13, fill: 0xFFFFFF, fontFamily: 'monospace' })
const S_HEADER = new TextStyle({ fontSize: 14, fill: 0x8888FF, fontFamily: 'monospace', fontWeight: 'bold' })

function smallBtn(label, x, y, w, color, onClick) {
  const btn = new Container()
  btn.x = x; btn.y = y
  btn.eventMode = 'static'; btn.cursor = 'pointer'
  const bg = new Graphics()
  bg.roundRect(0, 0, w, 28, 6)
  bg.fill({ color })
  btn.addChild(bg)
  const t = new Text({ text: label, style: S_BTN })
  t.anchor.set(0.5); t.x = w / 2; t.y = 14
  btn.addChild(t)
  btn.on('pointerdown', onClick)
  return btn
}

export class ShopUI {
  #bonusSystem
  #economy
  #onUpdate
  #container
  #panel
  #content
  #currentOffers = []

  constructor(app, bonusSystem, economy, onUpdate) {
    this.#bonusSystem = bonusSystem
    this.#economy = economy
    this.#onUpdate = onUpdate

    this.#container = new Container()
    this.#container.x = 800  // always visible at right of reel area

    this.#panel = new Graphics()
    this.#panel.rect(0, 0, W, H)
    this.#panel.fill({ color: 0x0d0d28, alpha: 0.97 })
    this.#container.addChild(this.#panel)

    // Left separator line
    const sep = new Graphics()
    sep.moveTo(0, 0).lineTo(0, H)
    sep.stroke({ color: 0x2a2a6a, width: 2 })
    this.#container.addChild(sep)

    // Title
    const title = new Text({ text: '🛒 BOUTIQUE', style: S_TITLE })
    title.x = 20; title.y = 15
    this.#container.addChild(title)

    this.#content = new Container()
    this.#content.y = 50
    this.#container.addChild(this.#content)

    this.refresh()
  }

  get container() { return this.#container }

  refresh() {
    this.#content.removeChildren()
    const level = this.#economy.getShopLevel()
    this.#currentOffers = this.#bonusSystem.getShopOffers(level)

    let y = 0

    const offerHeader = new Text({ text: `── OFFRES (Niveau ${level}) ──`, style: S_HEADER })
    offerHeader.x = 20; offerHeader.y = y
    this.#content.addChild(offerHeader)
    y += 30

    for (const offer of this.#currentOffers) {
      y = this.#renderOffer(offer, y)
    }

    const rerollCost = this.#bonusSystem.getModifiers().freeRerolls > 0 ? 'GRATUIT' : '$5'
    const rerollBtn = smallBtn(`🔄 Reroll (${rerollCost})`, 20, y, 180, 0x333388, () => {
      if (this.#bonusSystem.getModifiers().freeRerolls > 0) {
        this.#bonusSystem.useFreeReroll()
      } else if (!this.#economy.spend(5)) return
      this.refresh()
      this.#onUpdate()
    })
    this.#content.addChild(rerollBtn)
    y += 50

    const activeHeader = new Text({ text: '── BONUS ACTIFS ──', style: S_HEADER })
    activeHeader.x = 20; activeHeader.y = y
    this.#content.addChild(activeHeader)
    y += 30

    for (const bonus of this.#bonusSystem.activeBonus) {
      y = this.#renderActiveBonus(bonus, y)
    }

    if (this.#bonusSystem.activeBonus.length === 0) {
      const none = new Text({ text: 'Aucun bonus actif', style: S_DESC })
      none.x = 20; none.y = y
      this.#content.addChild(none)
    }
  }

  #renderOffer(offer, y) {
    const card = new Graphics()
    card.roundRect(10, y, W - 20, 90, 8)
    card.fill({ color: 0x1a1a40 })
    card.stroke({ color: 0x3333aa, width: 1 })
    this.#content.addChild(card)

    const name = new Text({ text: offer.name, style: S_NAME })
    name.x = 20; name.y = y + 10
    this.#content.addChild(name)

    const desc = new Text({ text: offer.description, style: S_DESC })
    desc.x = 20; desc.y = y + 32
    this.#content.addChild(desc)

    const price = new Text({ text: `$${offer.price}`, style: S_PRICE })
    price.x = 20; price.y = y + 60
    this.#content.addChild(price)

    const canBuy = this.#economy.canAfford(offer.price) && !this.#bonusSystem.isFull
    const buyBtn = smallBtn('Acheter', W - 110, y + 30, 90, canBuy ? 0x226622 : 0x443333, () => {
      if (!canBuy) return
      let target = null
      if (offer.needsTarget === 'column') {
        const col = parseInt(prompt(`Choisir le rouleau (0-5) pour "${offer.name}" :`) ?? '', 10)
        if (isNaN(col) || col < 0 || col > 5) return
        target = col
      } else if (offer.needsTarget === 'symbol') {
        const symbolIds = SYMBOLS.filter(s => s.id !== 'wild' && s.id !== 'scatter').map(s => s.id)
        const sym = prompt(`Choisir un symbole pour "${offer.name}" :\n${symbolIds.join(', ')}`)
        if (!symbolIds.includes(sym)) return
        target = sym
      }
      if (!this.#economy.spend(offer.price)) return
      this.#bonusSystem.addBonus(offer, target)
      this.refresh()
      this.#onUpdate()
    })
    this.#content.addChild(buyBtn)

    return y + 100
  }

  #renderActiveBonus(bonus, y) {
    const card = new Graphics()
    card.roundRect(10, y, W - 20, 60, 8)
    card.fill({ color: 0x111130 })
    card.stroke({ color: 0x4444cc, width: 1 })
    this.#content.addChild(card)

    const label = bonus.target !== null
      ? `${bonus.name} [${bonus.target}]`
      : bonus.name
    const name = new Text({ text: label, style: S_NAME })
    name.x = 20; name.y = y + 8
    this.#content.addChild(name)

    const usesText = bonus.remainingUses !== null ? ` (${bonus.remainingUses} spins)` : ''
    const desc = new Text({ text: bonus.description + usesText, style: S_DESC })
    desc.x = 20; desc.y = y + 30
    this.#content.addChild(desc)

    const sellPrice = Math.floor(bonus.price * 0.5)
    const sellBtn = smallBtn(`Vendre $${sellPrice}`, W - 130, y + 16, 110, 0x662222, () => {
      const refund = this.#bonusSystem.removeBonus(bonus.instanceId)
      this.#economy.addMoney(refund)
      this.refresh()
      this.#onUpdate()
    })
    this.#content.addChild(sellBtn)

    return y + 70
  }
}
