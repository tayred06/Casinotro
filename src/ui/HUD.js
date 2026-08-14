import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import { BET_OPTIONS } from '../game/Economy.js'

const W = 1200
const H = 750

const STYLE_LABEL = new TextStyle({ fontSize: 14, fill: 0x888888, fontFamily: 'monospace' })
const STYLE_VALUE = new TextStyle({ fontSize: 22, fill: 0xFFFFFF, fontFamily: 'monospace', fontWeight: 'bold' })
const STYLE_WIN   = new TextStyle({ fontSize: 36, fill: 0xFFDD00, fontFamily: 'monospace', fontWeight: 'bold' })
const STYLE_BTN   = new TextStyle({ fontSize: 18, fill: 0xFFFFFF, fontFamily: 'monospace', fontWeight: 'bold' })
const STYLE_OVER  = new TextStyle({ fontSize: 48, fill: 0xFF4444, fontFamily: 'monospace', fontWeight: 'bold' })

function makeButton(label, x, y, w, h, color, onClick) {
  const btn = new Container()
  btn.x = x; btn.y = y
  btn.eventMode = 'static'
  btn.cursor = 'pointer'

  const bg = new Graphics()
  bg.roundRect(0, 0, w, h, 8)
  bg.fill({ color })
  btn.addChild(bg)

  const txt = new Text({ text: label, style: STYLE_BTN })
  txt.anchor.set(0.5)
  txt.x = w / 2; txt.y = h / 2
  btn.addChild(txt)

  btn.on('pointerdown', onClick)
  btn.on('pointerover', () => { bg.tint = 0xCCCCCC })
  btn.on('pointerout',  () => { bg.tint = 0xFFFFFF })

  btn._bg = bg
  return btn
}

export class HUD {
  #economy
  #container
  #balanceText
  #highscoreText
  #winText
  #spinBtn
  #betButtons = []
  #gameOverOverlay

  constructor(app, economy, onSpin, onBetChange, onShopToggle) {
    this.#economy = economy
    this.#container = new Container()

    // Bottom bar background
    const bar = new Graphics()
    bar.rect(0, H - 120, W, 120)
    bar.fill({ color: 0x111128, alpha: 0.95 })
    this.#container.addChild(bar)

    // Balance
    const balLabel = new Text({ text: 'SOLDE', style: STYLE_LABEL })
    balLabel.x = 30; balLabel.y = H - 110
    this.#container.addChild(balLabel)

    this.#balanceText = new Text({ text: '$100', style: STYLE_VALUE })
    this.#balanceText.x = 30; this.#balanceText.y = H - 90
    this.#container.addChild(this.#balanceText)

    // Highscore
    const hsLabel = new Text({ text: 'MEILLEUR', style: STYLE_LABEL })
    hsLabel.x = 160; hsLabel.y = H - 110
    this.#container.addChild(hsLabel)

    this.#highscoreText = new Text({ text: '$0', style: STYLE_VALUE })
    this.#highscoreText.x = 160; this.#highscoreText.y = H - 90
    this.#container.addChild(this.#highscoreText)

    // Bet selector
    const betLabel = new Text({ text: 'MISE', style: STYLE_LABEL })
    betLabel.x = 320; betLabel.y = H - 110
    this.#container.addChild(betLabel)

    BET_OPTIONS.forEach((amount, i) => {
      const isSelected = amount === economy.currentBet
      const btn = makeButton(`$${amount}`, 320 + i * 70, H - 90, 60, 36,
        isSelected ? 0x4444aa : 0x2a2a5e,
        () => onBetChange(amount)
      )
      this.#betButtons.push({ btn, amount })
      this.#container.addChild(btn)
    })

    // Shop button
    const shopBtn = makeButton('🛒 BOUTIQUE', W - 320, H - 95, 140, 46, 0x225522, onShopToggle)
    this.#container.addChild(shopBtn)

    // Spin button
    this.#spinBtn = makeButton('▶ SPIN', W - 160, H - 95, 130, 46, 0x22aa44, onSpin)
    this.#container.addChild(this.#spinBtn)

    // Win text (hidden by default)
    this.#winText = new Text({ text: '', style: STYLE_WIN })
    this.#winText.anchor.set(0.5)
    this.#winText.x = W / 2; this.#winText.y = H - 145
    this.#winText.visible = false
    this.#container.addChild(this.#winText)

    // Game over overlay (hidden)
    this.#gameOverOverlay = new Container()
    this.#gameOverOverlay.visible = false
    const overBg = new Graphics()
    overBg.rect(0, 0, W, H)
    overBg.fill({ color: 0x000000, alpha: 0.75 })
    this.#gameOverOverlay.addChild(overBg)
    const overText = new Text({ text: 'GAME OVER', style: STYLE_OVER })
    overText.anchor.set(0.5); overText.x = W / 2; overText.y = H / 2 - 30
    const restartText = new Text({ text: 'Rechargez la page pour rejouer', style: STYLE_LABEL })
    restartText.anchor.set(0.5); restartText.x = W / 2; restartText.y = H / 2 + 30
    this.#gameOverOverlay.addChild(overText, restartText)
    this.#container.addChild(this.#gameOverOverlay)
  }

  get container() { return this.#container }

  update() {
    this.#balanceText.text = `$${this.#economy.balance.toFixed(2)}`
    this.#highscoreText.text = `$${this.#economy.highscore.toFixed(2)}`

    for (const { btn, amount } of this.#betButtons) {
      btn._bg.tint = amount === this.#economy.currentBet ? 0x6666ff : 0xFFFFFF
    }
  }

  setSpinEnabled(enabled) {
    this.#spinBtn.eventMode = enabled ? 'static' : 'none'
    this.#spinBtn._bg.alpha = enabled ? 1 : 0.4
  }

  showWin(amount) {
    if (amount <= 0) { this.#winText.visible = false; return }
    this.#winText.text = `+$${amount.toFixed(2)}`
    this.#winText.visible = true
  }

  hideWin() {
    this.#winText.visible = false
  }

  showGameOver() {
    this.#gameOverOverlay.visible = true
  }
}
