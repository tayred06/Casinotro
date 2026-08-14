import { Application } from 'pixi.js'
import { Economy } from './game/Economy.js'
import { BonusSystem } from './game/BonusSystem.js'
import { spin, calculateWins } from './game/SlotMachine.js'
import { ReelRenderer } from './ui/ReelRenderer.js'
import { HUD } from './ui/HUD.js'
import { ShopUI } from './ui/ShopUI.js'

const app = new Application()
await app.init({
  width: 1200,
  height: 750,
  backgroundColor: 0x0a0a1a,
  antialias: true,
  resolution: window.devicePixelRatio || 1,
})
document.body.appendChild(app.canvas)

const economy = new Economy(100)
const bonusSystem = new BonusSystem()

const renderer = new ReelRenderer(app)
const hud = new HUD(
  app, economy,
  handleSpin,
  (amount) => { economy.setBet(amount); hud.update() },
  () => shop.toggle()
)
const shop = new ShopUI(app, bonusSystem, economy, () => hud.update())

app.stage.addChild(renderer.container)
app.stage.addChild(hud.container)
app.stage.addChild(shop.container)

// Initial display
const { grid: initGrid, rowCounts: initRows } = spin()
renderer.displayGrid(initGrid, initRows)
hud.update()

let isSpinning = false

async function handleSpin() {
  if (isSpinning || economy.isGameOver()) return

  if (!economy.placeBet()) return

  isSpinning = true
  hud.setSpinEnabled(false)
  hud.hideWin()
  renderer.clearHighlights()

  const modifiers = bonusSystem.getModifiers()
  const stickyPositions = modifiers.stickyPositions ?? {}

  const { grid, rowCounts } = spin(stickyPositions)
  await renderer.animateSpin(grid, rowCounts)

  const winResult = calculateWins(grid, economy.currentBet, modifiers)

  bonusSystem.processPostSpin(winResult, grid)

  if (winResult.totalWin > 0) {
    economy.addWin(winResult.totalWin)
    renderer.highlightWins(winResult.winLines)
    hud.showWin(winResult.totalWin)
    hud.update()
    await delay(1200)
    hud.hideWin()
  }

  if (winResult.scatterTriggered) {
    await handleFreeSpins(10)
  }

  if (winResult.dropBonus) {
    const level = economy.getShopLevel()
    const offers = bonusSystem.getShopOffers(level)
    const dropped = offers[0]
    if (dropped && !bonusSystem.isFull) {
      let target = null
      if (dropped.needsTarget === 'column') {
        target = Math.floor(Math.random() * 6)
      } else if (dropped.needsTarget === 'symbol') {
        const ids = ['lemon', 'grape', 'bell', 'diamond', 'star', 'dog']
        target = ids[Math.floor(Math.random() * ids.length)]
      }
      bonusSystem.addBonus(dropped, target)
      hud.showWin(0, `🎁 Bonus : ${dropped.name}`)
      await delay(1800)
      hud.hideWin()
    }
  }

  hud.update()

  isSpinning = false

  if (economy.isGameOver()) {
    hud.showGameOver()
    return
  }

  // Brief cooldown before re-enabling — prevents queued pointer events
  // from immediately triggering another spin after rapid clicking
  await delay(150)
  hud.setSpinEnabled(true)
}

async function handleFreeSpins(count) {
  for (let i = 0; i < count; i++) {
    await delay(400)
    const modifiers = bonusSystem.getModifiers()
    const { grid, rowCounts } = spin(modifiers.stickyPositions ?? {})
    await renderer.animateSpin(grid, rowCounts)

    const winResult = calculateWins(grid, economy.currentBet, modifiers)
    bonusSystem.processPostSpin(winResult, grid)

    if (winResult.totalWin > 0) {
      economy.addWin(winResult.totalWin)
      renderer.highlightWins(winResult.winLines)
      hud.showWin(winResult.totalWin)
      hud.update()
      await delay(800)
      hud.hideWin()
      renderer.clearHighlights()
    }
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
