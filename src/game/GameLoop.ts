import type { CharacterPlugin, GameContext, SpinResult, UIContext, Souls } from '../types/index.ts'
import { Economy } from './Economy.ts'
import { BonusSystem } from './BonusSystem.ts'
import { RunState } from './RunState.ts'
import { Progression } from '../meta/Progression.ts'
import { spin, calculateWins } from './SlotMachine.ts'
import { SYMBOLS } from './Symbols.ts'
import { getCharacterPlugin } from './characters/index.ts'
import { getMachine } from './machines/index.ts'
import { ReelRenderer } from '../ui/ReelRenderer.ts'
import { HUD } from '../ui/HUD.ts'
import { ShopUI } from '../ui/ShopUI.ts'
import { CharacterSelect } from '../ui/CharacterSelect.ts'
import { ProfileModal } from '../ui/ProfileModal.ts'
import { DialogueUI } from '../ui/DialogueUI.ts'
import { CHARACTERS, getCharacter } from './Characters.ts'

const SAVE_KEY = 'casinotro_v2'

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export class GameLoop {
  private economy = new Economy(100)
  private bonusSystem = new BonusSystem()
  private run = new RunState()
  private progression = new Progression()
  private plugin: CharacterPlugin = { id: 'joueur' }
  private isSpinning = false
  private symbolMap: Record<string, any>

  private renderer: ReelRenderer
  private hud: HUD
  private shop: ShopUI
  private characterSelect: CharacterSelect
  private profileModal: ProfileModal
  private dialogueUI: DialogueUI

  private get ctx(): GameContext {
    return {
      economy: this.economy,
      bonusSystem: this.bonusSystem,
      ui: this.uiContext,
      addLog: (msg, muted) => this.shop.addLog(msg, muted),
    }
  }

  private get uiContext(): UIContext {
    return {
      addLog: (msg, muted) => this.shop.addLog(msg, muted),
      triggerDialogue: (lines) => this.dialogueUI.show(lines),
      updateHUD: () => this.hud.update({ level: this.run.stage, goal: this.run.currentGoal }, this.bonusSystem.getModifiers().luck),
      updateShop: () => this.shop.updateDisplay(),
    }
  }

  constructor() {
    this.symbolMap = Object.fromEntries(SYMBOLS.map(s => [s.id, s]))

    this.renderer = new ReelRenderer(() => this.restartRun())
    this.hud = new HUD(
      this.economy,
      () => this.handleSpin(),
      (amount) => { this.economy.setBet(amount); this.uiContext.updateHUD() }
    )
    this.dialogueUI = new DialogueUI()
    this.shop = new ShopUI(
      this.bonusSystem,
      this.economy,
      () => { this.uiContext.updateHUD(); this.renderer.showModifiers(this.bonusSystem.getModifiers()); this.save() },
      async (offer) => {
        if (offer.needsTarget === 'column') return this.renderer.selectColumn()
        if (offer.needsTarget === 'symbol') return this.renderer.selectSymbol()
        return null
      }
    )
    this.characterSelect = new CharacterSelect(CHARACTERS, (c) => this.startRun(c.id))
    this.profileModal = new ProfileModal()

    document.getElementById('pm-close')?.addEventListener('click', () => this.profileModal.close())
    document.querySelector('.char-hud-identity')?.addEventListener('click', () => {
      this.profileModal.open(getCharacter(this.run.characterId)!, this.economy, { level: this.run.stage, goal: this.run.currentGoal }, this.bonusSystem)
    })
    document.getElementById('new-game-btn')?.addEventListener('click', () => this.restartRun())

    this.boot()
  }

  private boot(): void {
    const save = this.loadSave()
    if (save) {
      this.run.restore(save.run)
      this.economy.restore(save.economy)
      this.bonusSystem.restore(save.bonusSystem)
      this.plugin = getCharacterPlugin(this.run.characterId)
      this.plugin.onSetup?.(this.ctx)

      const grid = save.grid
        ? save.grid.map((col: string[]) => col.map((id: string) => this.symbolMap[id] ?? SYMBOLS[0]))
        : spin({}, this.getLuckFactor(), this.plugin.getSpinOptions?.(this.ctx) ?? {}).grid

      this.renderer.displayGrid(grid, this.bonusSystem.getModifiers())
      this.renderer.showModifiers(this.bonusSystem.getModifiers())
      this.shop.setOffers(save.shopOffers ?? [], this.economy.getShopLevel())
      this.uiContext.updateHUD()
      this.applyCharacterTheme()
      this.characterSelect.hide()
    }
  }

  startRun(characterId: string): void {
    this.plugin.onTeardown?.(this.ctx)
    this.plugin = getCharacterPlugin(characterId)

    this.run.reset(characterId, 'megaways')
    this.economy.restart(100)
    this.bonusSystem.reset()
    this.renderer.hideGameOver()
    this.renderer.clearHighlights()
    this.characterSelect.hide()
    this.clearSave()

    this.plugin.onSetup?.(this.ctx)
    this.applyCharacterTheme()

    const opts = this.plugin.getSpinOptions?.(this.ctx) ?? {}
    const { grid } = spin({}, this.getLuckFactor(), opts)
    this.renderer.displayGrid(grid, this.bonusSystem.getModifiers())
    this.renderer.showModifiers(this.bonusSystem.getModifiers())
    this.shop.refresh(1)
    this.hud.setSpinEnabled(true)
    this.hud.setSpinLabel('SPIN')
    this.isSpinning = false
    this.uiContext.updateHUD()
    const char = getCharacter(characterId)
    this.shop.addLog(`${char?.emoji ?? ''} ${char?.name ?? characterId} — bonne chance.`, true)
    this.save(grid)
  }

  async handleSpin(): Promise<void> {
    if (this.isSpinning || this.economy.isGameOver()) return
    if (!this.economy.placeBet()) {
      if (this.plugin.onLossCheck?.(this.ctx)) {
        this.gameOver('Mise impossible.')
      }
      return
    }

    this.isSpinning = true
    this.hud.setSpinEnabled(false)
    this.hud.setSpinLabel('SPIN…')
    this.renderer.hideWin()
    this.renderer.clearHighlights()
    this.uiContext.updateHUD()
    this.run.spinCount++

    if (!this.run.dialoguePlayed) {
      this.run.dialoguePlayed = true
      const lines = this.plugin.onDialogueTrigger?.(this.ctx)
      if (lines?.length) await this.dialogueUI.show(lines)
    }

    await this.plugin.onBeforeSpin?.(this.ctx)

    const mods = this.bonusSystem.getModifiers()
    const stickyPositions = mods.stickyPositions ?? {}
    const opts = this.plugin.getSpinOptions?.(this.ctx) ?? {}
    const { grid } = spin(stickyPositions, this.getLuckFactor(), opts)

    await this.renderer.animateSpin(grid)

    const result: SpinResult = calculateWins(grid, this.economy.currentBet, mods)
    this.bonusSystem.processPostSpin(result, grid)

    await this.plugin.onAfterSpin?.(this.ctx, result)

    if (result.totalWin > 0) {
      this.economy.addWin(result.totalWin)
      this.progression.updateHighscore(this.economy.balance)
      this.renderer.highlightWins(result.winLines)
      this.renderer.showWin(result.totalWin, result.winLines)
      this.uiContext.updateHUD()
      this.shop.addLog(this.buildWinLog(result))
      await this.plugin.onWin?.(this.ctx, result.totalWin)
      await delay(1400)
      this.renderer.hideWin()
      this.renderer.clearHighlights()
    } else {
      this.shop.addLog('Aucune combinaison.', true)
    }

    if (result.scatterTriggered) await this.handleFreeSpins(8)

    if (result.dropBonus && !this.bonusSystem.isFull) {
      const level = this.economy.getShopLevel()
      const offers = this.bonusSystem.getShopOffers(level as 1 | 2 | 3)
      if (offers[0]) {
        this.bonusSystem.addBonus(offers[0], null)
        this.renderer.showWin(0, null, `🎁 ${offers[0].name}`)
        await delay(1600)
        this.renderer.hideWin()
      }
    }

    this.uiContext.updateHUD()
    this.shop.updateDisplay()
    this.checkStageProgress(grid)

    if (this.plugin.onLossCheck?.(this.ctx)) {
      this.gameOver('Condition de défaite du personnage.')
      return
    }
    if (this.economy.isGameOver()) {
      this.gameOver(`Palier ${this.run.stage} · objectif ${this.run.currentGoal}⛧ · solde ${this.economy.balance.toFixed(2)}⛧`)
      return
    }

    this.save(grid)
    this.isSpinning = false
    await delay(150)
    this.hud.setSpinEnabled(true)
    this.hud.setSpinLabel('SPIN')
  }

  private async handleFreeSpins(count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      await delay(380)
      const mods = this.bonusSystem.getModifiers()
      const opts = this.plugin.getSpinOptions?.(this.ctx) ?? {}
      const { grid } = spin(mods.stickyPositions ?? {}, this.getLuckFactor(), opts)
      await this.renderer.animateSpin(grid)
      const result = calculateWins(grid, this.economy.currentBet, mods)
      this.bonusSystem.processPostSpin(result, grid)
      this.renderer.displayGrid(grid, this.bonusSystem.getModifiers())
      if (result.totalWin > 0) {
        this.economy.addWin(result.totalWin)
        this.renderer.highlightWins(result.winLines)
        this.renderer.showWin(result.totalWin, result.winLines)
        this.uiContext.updateHUD()
        await delay(900)
        this.renderer.hideWin()
        this.renderer.clearHighlights()
      }
    }
  }

  private checkStageProgress(grid: any[][]): void {
    if (this.economy.balance >= this.run.currentGoal && this.run.stage < 3) {
      this.plugin.onStageComplete?.(this.ctx, this.run.stage)
      this.run.advanceStage()
      this.economy.setBetOptions(this.run.betOptions)
      this.shop.refresh(this.economy.getShopLevel())
      this.shop.addLog(`Palier ${this.run.stage} atteint — boutique renouvelée !`)
      this.uiContext.updateHUD()
      this.save(grid)
    }
  }

  private gameOver(text: string): void {
    this.clearSave()
    this.renderer.showGameOver(text)
    this.isSpinning = false
  }

  private restartRun(): void {
    this.clearSave()
    this.renderer.hideGameOver()
    this.renderer.clearHighlights()
    this.hud.setSpinEnabled(false)
    this.characterSelect.show()
  }

  private getLuckFactor(): number {
    const luckBonus = this.plugin.getLuckBonus?.(this.ctx) ?? 0
    return (this.bonusSystem.getModifiers().luck + luckBonus) / 100 + this.economy.rtpNudge
  }

  private applyCharacterTheme(): void {
    const char = getCharacter(this.run.characterId)
    if (!char) return
    document.documentElement.style.setProperty('--char-color', char.color ?? '#0f1110')
    document.documentElement.style.setProperty('--char-edge', char.colorEdge ?? '#2f5136')
    const sigilEl = document.getElementById('char-hud-sigil')
    const nameEl  = document.getElementById('char-hud-name')
    const sinEl   = document.getElementById('char-hud-sin')
    if (sigilEl) sigilEl.textContent = char.sigil ?? char.emoji
    if (nameEl)  nameEl.textContent  = char.name
    if (sinEl)   sinEl.textContent   = char.sin
    this.dialogueUI.setSigil(char.sigil ?? char.emoji)
  }

  private buildWinLog(result: SpinResult): string {
    if (!result.winLines.length) return 'Aucune combinaison.'
    const best = result.winLines.reduce((a, b) => b.count > a.count ? b : a)
    return `${best.count} × ${best.symbolId} — +${result.totalWin.toFixed(2)}⛧`
  }

  private save(grid?: any[][]): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        run:         this.run.serialize(),
        economy:     this.economy.serialize(),
        bonusSystem: this.bonusSystem.serialize(),
        shopOffers:  this.shop.getOffers(),
        grid:        grid?.map(col => col.map((s: any) => s.id)),
      }))
    } catch {}
  }

  private loadSave(): any {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  }

  private clearSave(): void {
    try { localStorage.removeItem(SAVE_KEY) } catch {}
  }
}
