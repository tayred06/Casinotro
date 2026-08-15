import { Economy } from './game/Economy.js'
import { BonusSystem } from './game/BonusSystem.js'
import { spin, calculateWins } from './game/SlotMachine.js'
import { SYMBOLS } from './game/Symbols.js'
import { ReelRenderer } from './ui/ReelRenderer.js'
import { HUD } from './ui/HUD.js'
import { ShopUI } from './ui/ShopUI.js'

// ── Save system ───────────────────────────────────────
const SAVE_KEY = 'casinotro_v1'

const SYMBOL_MAP = Object.fromEntries(
  (typeof SYMBOLS !== 'undefined' ? SYMBOLS : []).map(s => [s.id, s])
)

function saveGame(grid) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      run:         { ...RUN },
      economy:     economy.serialize(),
      bonusSystem: bonusSystem.serialize(),
      shopOffers:  shop.getOffers(),
      rerollCost:  shop.getRerollCost(),
      grid:        grid.map(col => col.map(s => s.id)),
    }))
  } catch {}
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function clearSave() {
  try { localStorage.removeItem(SAVE_KEY) } catch {}
}

function gridFromIds(ids2d) {
  return ids2d.map(col => col.map(id => SYMBOL_MAP[id] ?? SYMBOLS[0]))
}

// ── Run state ─────────────────────────────────────────
const RUN = { level: 1, goal: 150 }

const economy     = new Economy(100)
const bonusSystem = new BonusSystem()
const renderer    = new ReelRenderer(restartRun)

const hud = new HUD(
  economy,
  handleSpin,
  (amount) => { economy.setBet(amount); hud.update(RUN) }
)

async function selectTarget(offer) {
  if (offer.needsTarget === 'column') return renderer.selectColumn()
  if (offer.needsTarget === 'symbol') return renderer.selectSymbol()
  return null
}

const shop = new ShopUI(bonusSystem, economy, () => {
  hud.update(RUN)
  renderer.showModifiers(bonusSystem.getModifiers())
  saveGame(renderer.currentGrid ?? [])
}, selectTarget)

function getLuckFactor() {
  return bonusSystem.getModifiers().luck / 100 + economy.rtpNudge
}

// ── Boot: restore save or start fresh ────────────────
let isSpinning = false
let bootGrid

const save = loadSave()
if (save) {
  Object.assign(RUN, save.run)
  economy.restore(save.economy)
  bonusSystem.restore(save.bonusSystem)
  bootGrid = save.grid ? gridFromIds(save.grid) : spin({}, getLuckFactor()).grid

  renderer.displayGrid(bootGrid, bonusSystem.getModifiers())
  renderer.showModifiers(bonusSystem.getModifiers())
  shop.setOffers(save.shopOffers ?? [], RUN.level)
  if (save.rerollCost) shop.setRerollCost(save.rerollCost)
  shop.addLog('Partie restaurée.', true)
} else {
  bootGrid = spin({}, getLuckFactor()).grid
  renderer.displayGrid(bootGrid, bonusSystem.getModifiers())
  shop.refresh(1)
  shop.addLog('Nouvelle run — bonne chance.', true)
}

hud.update(RUN)

// ── Spin ─────────────────────────────────────────────
async function handleSpin() {
  if (isSpinning || economy.isGameOver()) return
  if (!economy.placeBet()) return

  isSpinning = true
  hud.setSpinEnabled(false)
  hud.setSpinLabel('SPIN…')
  renderer.hideWin()
  renderer.clearHighlights()
  hud.update(RUN)

  const modifiers       = bonusSystem.getModifiers()
  const stickyPositions = modifiers.stickyPositions ?? {}
  const { grid }        = spin(stickyPositions, getLuckFactor())

  await renderer.animateSpin(grid)

  const winResult = calculateWins(grid, economy.currentBet, modifiers)
  bonusSystem.processPostSpin(winResult, grid)

  if (winResult.totalWin > 0) {
    economy.addWin(winResult.totalWin)
    renderer.highlightWins(winResult.winLines)
    renderer.showWin(winResult.totalWin, winResult.winLines)
    hud.update(RUN, modifiers.luck)
    shop.addLog(buildWinLog(winResult))

    await delay(1400)
    renderer.hideWin()
    renderer.clearHighlights()
  } else {
    shop.addLog('Aucune combinaison.', true)
  }

  if (winResult.scatterTriggered) {
    await handleFreeSpins(8)
  }

  // Bonus drop from large win
  if (winResult.dropBonus && !bonusSystem.isFull) {
    const level  = economy.getShopLevel()
    const offers = bonusSystem.getShopOffers(level)
    if (offers[0]) {
      bonusSystem.addBonus(offers[0], null)
      renderer.showWin(0, null, `🎁 ${offers[0].name}`)
      await delay(1600)
      renderer.hideWin()
    }
  }

  hud.update(RUN, bonusSystem.getModifiers().luck)
  // Only update display — do NOT regenerate shop offers
  shop.updateDisplay()

  checkRunProgress(grid)
  saveGame(grid)

  isSpinning = false
  await delay(150)

  if (!economy.isGameOver()) {
    hud.setSpinEnabled(true)
    hud.setSpinLabel('SPIN')
  }
}

async function handleFreeSpins(count) {
  for (let i = 0; i < count; i++) {
    await delay(380)
    const modifiers = bonusSystem.getModifiers()
    const { grid }  = spin(modifiers.stickyPositions ?? {}, getLuckFactor())
    await renderer.animateSpin(grid)

    const winResult = calculateWins(grid, economy.currentBet, modifiers)
    bonusSystem.processPostSpin(winResult, grid)
    renderer.displayGrid(grid, bonusSystem.getModifiers())

    if (winResult.totalWin > 0) {
      economy.addWin(winResult.totalWin)
      renderer.highlightWins(winResult.winLines)
      renderer.showWin(winResult.totalWin, winResult.winLines)
      hud.update(RUN, modifiers.luck)
      await delay(900)
      renderer.hideWin()
      renderer.clearHighlights()
    }
  }
}

function checkRunProgress(grid) {
  if (economy.balance >= RUN.goal) {
    RUN.level++
    RUN.goal = Math.round(RUN.goal * 2.6)
    shop.refresh(economy.getShopLevel())   // level-up: regenerate offers
    shop.addLog(`Niveau ${RUN.level} — boutique renouvelée !`)
    hud.update(RUN)
    if (grid) saveGame(grid)
  } else if (economy.isGameOver()) {
    clearSave()
    const overText = `Niveau ${RUN.level} · objectif $${RUN.goal} · solde $${economy.balance.toFixed(2)}`
    renderer.showGameOver(overText)
  }
}

function restartRun() {
  clearSave()
  Object.assign(RUN, { level: 1, goal: 150 })
  economy.restart(100)
  bonusSystem.reset()
  renderer.hideGameOver()
  renderer.clearHighlights()

  const { grid } = spin({}, getLuckFactor())
  renderer.displayGrid(grid, bonusSystem.getModifiers())
  renderer.showModifiers(bonusSystem.getModifiers())
  shop.refresh(1)
  hud.update(RUN, 0)
  hud.setSpinEnabled(true)
  hud.setSpinLabel('SPIN')
  isSpinning = false
  shop.addLog('Nouvelle run — bonne chance.', true)
  saveGame(grid)
}

// Exposed for the "Nouvelle partie" button
window.__newGame = restartRun

function buildWinLog(result) {
  if (!result.winLines.length) return 'Aucune combinaison.'
  const best = result.winLines.reduce((a, b) => b.count > a.count ? b : a)
  return `${best.count} × ${best.symbolId} — +$${result.totalWin.toFixed(2)}`
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
