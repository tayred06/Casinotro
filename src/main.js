import { Economy } from './game/Economy.js'
import { BonusSystem } from './game/BonusSystem.js'
import { spin, calculateWins } from './game/SlotMachine.js'
import { SYMBOLS } from './game/Symbols.js'
import { ReelRenderer } from './ui/ReelRenderer.js'
import { HUD } from './ui/HUD.js'
import { ShopUI } from './ui/ShopUI.js'
import { CHARACTERS, getCharacter, STARTING_CHARACTER_ID } from './game/Characters.js'
import { CharacterState } from './game/CharacterState.js'
import { CharacterSelect } from './ui/CharacterSelect.js'
import { ProfileModal } from './ui/ProfileModal.js'

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
      characterId: activeCharacter.id,
      gulaBet:     activeCharacter.effectKey === 'gula' ? gulaBet : undefined,
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

function applyCharacterTheme() {
  document.documentElement.style.setProperty('--char-color', activeCharacter.color ?? '#0f1110')
  document.getElementById('char-hud-emoji').textContent = activeCharacter.emoji
  document.getElementById('char-hud-name').textContent  = activeCharacter.name
  document.getElementById('char-hud-sin').textContent   = activeCharacter.sin
}

function getReelOptions() {
  if (activeCharacter.effectKey === 'luxuria') {
    return { rareMultiplier: activeCharacter.params.rareSymbolWeightMultiplier ?? 1 }
  }
  return {}
}

function applySpinUpkeep() {
  if (activeCharacter.effectKey !== 'luxuria') return
  const { upkeepPercent, upkeepLabel } = activeCharacter.params
  const upkeep = Math.round(economy.balance * upkeepPercent * 100) / 100
  if (upkeep > 0 && economy.spend(upkeep)) {
    shop.addLog(`${upkeepLabel} — -$${upkeep.toFixed(2)}`, true)
    hud.update(RUN)
  }
}

// ── Avaritia ──────────────────────────────────────────
function getAvaritiaGate() {
  const gates    = activeCharacter.params.shopGates
  const progress = economy.balance / (activeCharacter.goal ?? 10000)
  let gate = gates[0]
  for (const g of gates) { if (progress >= g.progress) gate = g }
  return gate
}

function avaritiaOfferModifier(offer) {
  const gate = getAvaritiaGate()
  if (gate.maxTier === 0 || offer.level > gate.maxTier) return null
  return { ...offer, price: Math.round(offer.price * gate.priceMultiplier) }
}

function updateAvaritiaLabel() {
  const gate     = getAvaritiaGate()
  const goal     = activeCharacter.goal ?? 10000
  const tierIdx  = gate.maxTier          // 0-3
  const gateLabels = ['VERROUILLÉE', 'PALIER 1/3', 'PALIER 2/3', 'OUVERTE']
  const nextGate = activeCharacter.params.shopGates[tierIdx + 1]
  const suffix   = nextGate
    ? ` — $${Math.round(nextGate.progress * goal)} requis`
    : ''
  shop.setLevelLabel(gateLabels[tierIdx] + suffix)
}

function setupAvaritia() {
  shop.setOfferModifier(avaritiaOfferModifier)
  updateAvaritiaLabel()
}

function teardownAvaritia() {
  shop.setOfferModifier(null)
}

// ── Gula ──────────────────────────────────────────────
let gulaBet = 1

function setupGula() {
  const { betEscalationFloor } = activeCharacter.params
  gulaBet = betEscalationFloor
  economy.forceSetBet(gulaBet)
  hud.showEscalatingBet(gulaBet, getGulaIncrement())

  shop.setOnBonusSold((bonus) => {
    gulaBet = activeCharacter.params.betEscalationFloor
    economy.forceSetBet(gulaBet)
    hud.showEscalatingBet(gulaBet, getGulaIncrement())
    shop.addLog(`Dévoré : ${bonus.name} — mise remise à $${gulaBet}`, true)
  })
}

function teardownGula() {
  shop.setOnBonusSold(null)
  hud.restoreBetChips()
}

function getGulaIncrement() {
  const { betEscalationPercent, betEscalationFloor } = activeCharacter.params
  return economy.balance < 100
    ? betEscalationFloor
    : Math.round(economy.balance * betEscalationPercent * 100) / 100
}

function applyBetEscalation() {
  if (activeCharacter.effectKey !== 'gula') return
  const increment = getGulaIncrement()
  gulaBet = Math.round((gulaBet + increment) * 100) / 100
  economy.forceSetBet(gulaBet)
  hud.showEscalatingBet(gulaBet, getGulaIncrement())
}

// ── Character system ──────────────────────────────────
let activeCharacter = new CharacterState(getCharacter(STARTING_CHARACTER_ID))
const characterSelect = new CharacterSelect(CHARACTERS, startRunWithCharacter)
const profileModal = new ProfileModal()

document.getElementById('pm-close').addEventListener('click', () => profileModal.close())
document.querySelector('.char-hud-identity').addEventListener('click', () => {
  profileModal.open(activeCharacter, economy, RUN, bonusSystem)
})

// ── Boot: restore save or show character select ───────
let isSpinning = false

const save = loadSave()
if (save) {
  const savedChar = getCharacter(save.characterId) ?? getCharacter(STARTING_CHARACTER_ID)
  activeCharacter = new CharacterState(savedChar)

  Object.assign(RUN, save.run)
  economy.restore(save.economy)
  bonusSystem.restore(save.bonusSystem)
  const bootGrid = save.grid ? gridFromIds(save.grid) : spin({}, getLuckFactor()).grid

  renderer.displayGrid(bootGrid, bonusSystem.getModifiers())
  renderer.showModifiers(bonusSystem.getModifiers())
  shop.setOffers(save.shopOffers ?? [], RUN.level)
  if (save.rerollCost) shop.setRerollCost(save.rerollCost)
  shop.addLog('Partie restaurée.', true)
  hud.update(RUN)
  applyCharacterTheme()
  if (activeCharacter.effectKey === 'gula') {
    gulaBet = save.gulaBet ?? activeCharacter.params.betEscalationFloor
    setupGula()
    hud.showEscalatingBet(gulaBet, getGulaIncrement())
  }
  if (activeCharacter.effectKey === 'avaritia') setupAvaritia()
  characterSelect.hide()
}
// If no save: overlay stays visible — game starts via startRunWithCharacter()

// ── Start run with selected character ─────────────────
function startRunWithCharacter(character) {
  teardownGula()
  teardownAvaritia()
  activeCharacter = new CharacterState(character)
  applyCharacterTheme()
  characterSelect.hide()
  clearSave()

  Object.assign(RUN, { level: 1, goal: 150 })
  economy.restart(activeCharacter.getStartBalance() ?? 100)
  bonusSystem.reset()
  renderer.hideGameOver()
  renderer.clearHighlights()

  const { grid } = spin({}, getLuckFactor(), getReelOptions())
  renderer.displayGrid(grid, bonusSystem.getModifiers())
  renderer.showModifiers(bonusSystem.getModifiers())
  shop.refresh(1)
  if (activeCharacter.effectKey === 'gula')     setupGula()
  if (activeCharacter.effectKey === 'avaritia') setupAvaritia()
  hud.update(RUN, 0)
  hud.setSpinEnabled(true)
  hud.setSpinLabel('SPIN')
  isSpinning = false
  shop.addLog(`${character.emoji} ${character.name} — bonne chance.`, true)
  saveGame(grid)
}

// ── Spin ─────────────────────────────────────────────
async function handleSpin() {
  if (isSpinning || economy.isGameOver()) return
  if (!economy.placeBet()) {
    if (activeCharacter.effectKey === 'gula') {
      clearSave()
      const overText = `Niveau ${RUN.level} · mise $${gulaBet.toFixed(2)} · solde $${economy.balance.toFixed(2)}`
      renderer.showGameOver(overText)
    }
    return
  }

  isSpinning = true
  hud.setSpinEnabled(false)
  hud.setSpinLabel('SPIN…')
  renderer.hideWin()
  renderer.clearHighlights()
  hud.update(RUN)

  applySpinUpkeep()

  const modifiers       = bonusSystem.getModifiers()
  const stickyPositions = modifiers.stickyPositions ?? {}
  const { grid }        = spin(stickyPositions, getLuckFactor(), getReelOptions())

  await renderer.animateSpin(grid)

  const winResult = calculateWins(grid, economy.currentBet, modifiers)
  bonusSystem.processPostSpin(winResult, grid)

  if (activeCharacter.effectKey === 'avaritia' && winResult.totalWin > 0) {
    const m = activeCharacter.params.winMultiplier
    winResult.totalWin = winResult.totalWin * m
    winResult.winLines = winResult.winLines.map(l => ({ ...l, win: l.win * m }))
  }

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
  shop.updateDisplay()

  applyBetEscalation()
  if (activeCharacter.effectKey === 'avaritia') updateAvaritiaLabel()
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
    const { grid }  = spin(modifiers.stickyPositions ?? {}, getLuckFactor(), getReelOptions())
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
    shop.refresh(economy.getShopLevel())
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
  renderer.hideGameOver()
  renderer.clearHighlights()
  hud.setSpinEnabled(false)
  characterSelect.show()
}

window.__newGame = restartRun

function buildWinLog(result) {
  if (!result.winLines.length) return 'Aucune combinaison.'
  const best = result.winLines.reduce((a, b) => b.count > a.count ? b : a)
  return `${best.count} × ${best.symbolId} — +$${result.totalWin.toFixed(2)}`
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
