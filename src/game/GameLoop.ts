import type { CharacterPlugin, GameContext, MachineConfig, SpinResult, UIContext, Souls } from '../types/index.ts'
import { Economy } from './Economy.ts'
import { BonusSystem } from './BonusSystem.ts'
import { RunState } from './RunState.ts'
import { Progression } from '../meta/Progression.ts'
import { spin, calculateWins } from './SlotMachine.ts'
import { SYMBOLS } from './Symbols.ts'
import type { LuckProfile } from './Symbols.ts'
import { getCharacterPlugin } from './characters/index.ts'
import { getMachine, DEFAULT_MACHINE_ID } from './machines/index.ts'
import { ReelRenderer } from '../ui/ReelRenderer.ts'
import { HUD } from '../ui/HUD.ts'
import { ShopUI } from '../ui/ShopUI.ts'
import { CharacterSelect } from '../ui/CharacterSelect.ts'
import { ProfileModal } from '../ui/ProfileModal.ts'
import { PaytableModal } from '../ui/PaytableModal.ts'
import { DialogueUI } from '../ui/DialogueUI.ts'
import { EndScreen } from '../ui/EndScreen.ts'
import { CHARACTERS, getCharacter, isCharacterPlayable, getNextCharacterId } from './Characters.ts'

const SAVE_KEY = 'casinotro_v3'

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export class GameLoop {
  private progression = new Progression()
  private economy = new Economy(100, this.progression)
  private bonusSystem = new BonusSystem()
  private run = new RunState()
  private plugin: CharacterPlugin = { id: 'none' }
  private isSpinning = false
  private currentGrid: any[][] = []
  private actionBtn: HTMLButtonElement | null = null
  private symbolMap: Record<string, any>

  private renderer: ReelRenderer
  private hud: HUD
  private shop: ShopUI
  private characterSelect: CharacterSelect
  private profileModal: ProfileModal
  private paytableModal: PaytableModal
  private dialogueUI: DialogueUI
  private endScreen: EndScreen
  /** Run terminée (victoire ou défaite) : plus aucune action de jeu n'est acceptée. */
  private runEnded = false

  /** Machine de la run courante. Toute la géométrie et la paytable en découlent. */
  private get machine(): MachineConfig {
    return getMachine(this.run.machineId)
  }

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
      updateHUD: () => this.hud.update({ level: this.run.stage, goal: this.run.currentGoal }, this.bonusSystem.getModifiers()),
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
    this.characterSelect = new CharacterSelect(CHARACTERS, (c) => this.startRun(c.id), this.progression.unlockedCharacters)
    this.endScreen = new EndScreen(() => this.restartRun())
    this.profileModal = new ProfileModal()
    this.paytableModal = new PaytableModal()

    document.getElementById('pm-close')?.addEventListener('click', () => this.profileModal.close())
    document.querySelector('.char-hud-identity')?.addEventListener('click', () => {
      this.profileModal.open(getCharacter(this.run.characterId)!, this.economy, { level: this.run.stage, goal: this.run.currentGoal }, this.bonusSystem)
    })
    document.getElementById('machine-help-btn')?.addEventListener('click', () => this.paytableModal.open(this.machine))
    document.getElementById('new-game-btn')?.addEventListener('click', () => this.restartRun())

    this.actionBtn = document.getElementById('char-action-btn') as HTMLButtonElement | null
    this.actionBtn?.addEventListener('click', () => this.handleCharacterAction())

    this.boot()
  }

  private boot(): void {
    const save = this.loadSave()
    if (save) {
      // Sauvegarde d'un personnage retiré du build (démo) : on repart de la sélection.
      const saved = getCharacter(save.run?.characterId)
      if (!saved || !isCharacterPlayable(saved, this.progression.unlockedCharacters)) {
        this.clearSave()
        return
      }
      this.run.restore(save.run)
      this.economy.restore(save.economy)
      this.bonusSystem.restore(save.bonusSystem)
      this.plugin = getCharacterPlugin(this.run.characterId)
      this.plugin.onSetup?.(this.ctx)
      this.plugin.restore?.(save.pluginState)
      this.bonusSystem.setReelCount(this.machine.reelCount)
      this.applyMachineMeta()

      const rawGrid = save.grid
        ? save.grid.map((col: string[]) => col.map((id: string) => this.symbolMap[id] ?? SYMBOLS[0]))
        : spin(this.machine, {}, this.getLuckProfile(), this.plugin.getSpinOptions?.(this.ctx) ?? {}).grid

      const grid = this.applyGridTransform(rawGrid)
      this.renderer.displayGrid(grid, this.bonusSystem.getModifiers())
      this.renderer.showModifiers(this.bonusSystem.getModifiers())
      this.shop.setOffers(save.shopOffers ?? [], this.economy.getShopLevel())
      this.hud.rebuildBetChips()
      this.uiContext.updateHUD()
      this.applyCharacterTheme()
      this.refreshAction()
      this.characterSelect.hide()
    }
  }

  startRun(characterId: string): void {
    this.plugin.onTeardown?.(this.ctx)
    this.plugin = getCharacterPlugin(characterId)

    const character = getCharacter(characterId)
    this.run.reset(characterId, character?.machineId ?? DEFAULT_MACHINE_ID)
    this.bonusSystem.setReelCount(this.machine.reelCount)
    this.applyMachineMeta()
    this.economy.restart(100)
    this.hud.rebuildBetChips()
    this.bonusSystem.reset()
    this.renderer.hideGameOver()
    this.endScreen.hide()
    this.runEnded = false
    this.renderer.clearHighlights()
    this.characterSelect.hide()
    this.clearSave()

    this.plugin.onSetup?.(this.ctx)
    this.applyCharacterTheme()

    const opts = this.plugin.getSpinOptions?.(this.ctx) ?? {}
    const { grid: rawGrid } = spin(this.machine, {}, this.getLuckProfile(), opts)
    const grid = this.applyGridTransform(rawGrid)
    this.renderer.displayGrid(grid, this.bonusSystem.getModifiers())
    this.renderer.showModifiers(this.bonusSystem.getModifiers())
    this.refreshAction()
    this.shop.refresh(1)
    this.hud.setSpinEnabled(true)
    this.hud.setSpinLabel('SPIN')
    this.isSpinning = false
    this.uiContext.updateHUD()
    this.shop.addLog(`${character?.emoji ?? ''} ${character?.name ?? characterId} — bonne chance.`, true)
    this.save(grid)
  }

  async handleSpin(): Promise<void> {
    if (this.runEnded || this.isSpinning || this.economy.isGameOver()) return
    if (!this.economy.placeBet()) {
      if (this.plugin.onLossCheck?.(this.ctx)) {
        this.gameOver('Mise impossible.')
      }
      return
    }

    this.isSpinning = true
    this.hud.setSpinEnabled(false)
    this.setActionEnabled(false)
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
    const { grid: rawGrid } = spin(this.machine, stickyPositions, this.getLuckProfile(), opts)
    const grid = this.applyGridTransform(rawGrid)

    await this.renderer.animateSpin(grid)

    const result: SpinResult = calculateWins(this.machine, grid, this.economy.currentBet, mods)
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
      const offers = this.bonusSystem.getShopOffers(level)
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
    if (this.runEnded) return

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
    this.refreshAction()
  }

  private async handleFreeSpins(count: number, winMultiplier = 1): Promise<void> {
    for (let i = 0; i < count; i++) {
      await delay(380)
      const mods = this.bonusSystem.getModifiers()
      const opts = this.plugin.getSpinOptions?.(this.ctx) ?? {}
      const { grid: rawGrid } = spin(this.machine, mods.stickyPositions ?? {}, this.getLuckProfile(), opts)
      const grid = this.applyGridTransform(rawGrid)
      await this.renderer.animateSpin(grid)
      const result = calculateWins(this.machine, grid, this.economy.currentBet, mods)
      result.totalWin *= winMultiplier
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
    if (this.economy.balance >= this.run.currentGoal && this.run.stage >= 3) {
      this.progression.updateHighscore(this.economy.balance)
      this.victory()
      return
    }
    if (this.economy.balance >= this.run.currentGoal && this.run.stage < 3) {
      this.plugin.onStageComplete?.(this.ctx, this.run.stage)
      this.run.advanceStage()
      this.economy.setBetOptions(this.run.betOptions)
      this.hud.rebuildBetChips()
      this.shop.refresh(this.economy.getShopLevel())
      this.shop.addLog(`Palier ${this.run.stage} atteint — boutique renouvelée !`)
      this.uiContext.updateHUD()
      this.save(grid)
    }
  }

  /** Laisse le personnage réécrire la grille (slots morts d'Ira, etc.). */
  private applyGridTransform(grid: any[][]): any[][] {
    const transformed = this.plugin.transformGrid?.(this.ctx, grid) ?? grid
    this.currentGrid = transformed
    this.renderer.setCellStates(this.plugin.getCellStates?.(this.ctx) ?? null)
    return transformed
  }

  private refreshAction(): void {
    if (!this.actionBtn) return
    const action = this.plugin.getAction?.(this.ctx) ?? null
    if (!action) {
      this.actionBtn.classList.add('hidden')
      return
    }
    this.actionBtn.classList.remove('hidden')
    this.actionBtn.textContent = action.label
    this.actionBtn.title = action.hint ?? ''
    this.actionBtn.disabled = !action.enabled || this.isSpinning
  }

  private setActionEnabled(enabled: boolean): void {
    if (this.actionBtn) this.actionBtn.disabled = !enabled
  }

  private async handleCharacterAction(): Promise<void> {
    if (this.runEnded || this.isSpinning || this.economy.isGameOver()) return
    const action = this.plugin.getAction?.(this.ctx)
    if (!action || !action.enabled) return

    this.isSpinning = true
    this.hud.setSpinEnabled(false)
    this.setActionEnabled(false)
    this.renderer.hideWin()
    this.renderer.clearHighlights()

    const res = await this.plugin.onAction?.(this.ctx, action.id) ?? {}

    // Re-rendu immédiat : les slots brisés apparaissent avant le spin gratuit
    this.renderer.displayGrid(this.applyGridTransform(this.currentGrid), this.bonusSystem.getModifiers())
    if (res.impact) this.renderer.playImpact(res.impact.col, res.impact.row, res.impact.broken)
    this.uiContext.updateHUD()
    this.shop.updateDisplay()
    await delay(res.impact?.broken ? 760 : 520)

    if (res.gameOver || this.plugin.onLossCheck?.(this.ctx)) {
      this.gameOver(res.gameOver ?? 'Une colonne entière est morte. La machine a gagné.')
      return
    }

    if (res.freeSpins) {
      this.renderer.showWin(0, null, `🥊 Spin gratuit ×${res.winMultiplier ?? 1}`)
      await delay(900)
      this.renderer.hideWin()
      await this.handleFreeSpins(res.freeSpins, res.winMultiplier ?? 1)
    }

    this.progression.updateHighscore(this.economy.balance)
    this.checkStageProgress(this.currentGrid)
    if (this.runEnded) return
    this.uiContext.updateHUD()
    this.shop.updateDisplay()

    if (this.plugin.onLossCheck?.(this.ctx)) {
      this.gameOver('Une colonne entière est morte. La machine a gagné.')
      return
    }
    if (this.economy.isGameOver()) {
      this.gameOver(`Palier ${this.run.stage} · objectif ${this.run.currentGoal}⛧ · solde ${this.economy.balance.toFixed(2)}⛧`)
      return
    }

    this.save(this.currentGrid)
    this.isSpinning = false
    this.hud.setSpinEnabled(true)
    this.refreshAction()
  }

  private gameOver(text: string): void {
    this.clearSave()
    this.runEnded = true
    this.isSpinning = false
    this.hud.setSpinEnabled(false)
    this.actionBtn?.classList.add('hidden')
    this.endScreen.show({
      outcome: 'lose',
      kicker: `Palier ${this.run.stage} — quota manqué`,
      title: 'La maison remercie',
      body: `${text} Rassure-toi : ici, la faillite n'est jamais définitive, seulement renouvelable.`,
      stats: this.endStats(),
    })
  }

  /** Objectif du dernier palier atteint : la run est gagnée. */
  private victory(): void {
    this.clearSave()
    this.runEnded = true
    this.isSpinning = false
    this.hud.setSpinEnabled(false)
    this.actionBtn?.classList.add('hidden')

    const unlockedName = this.unlockNextCharacter()
    const body = "Tu as payé le quota. La direction note ton zèle et augmente la mise. Le ticket de sortie coûte toujours un million, et il coûtera toujours un million."

    this.endScreen.show({
      outcome: 'win',
      kicker: `Palier ${this.run.stage} — quota atteint`,
      title: 'Encore un tour',
      body: unlockedName
        ? `${body} Un nouveau pensionnaire descend : ${unlockedName}.`
        : body,
      stats: this.endStats(),
    })
  }

  /**
   * Gagner avec un personnage ouvre le suivant dans l'ordre de déblocage.
   * Retourne le nom du personnage nouvellement débloqué, ou null.
   */
  private unlockNextCharacter(): string | null {
    const nextId = getNextCharacterId(this.run.characterId)
    if (!nextId || !this.progression.unlockCharacter(nextId)) return null
    this.characterSelect.refresh(this.progression.unlockedCharacters)
    const next = getCharacter(nextId)
    this.shop.addLog(`Personnage débloqué : ${next?.name ?? nextId}.`)
    return next?.name ?? nextId
  }

  private endStats(): { k: string; v: string }[] {
    const fmt = (n: Souls) => `${Math.round(n).toLocaleString('fr-FR')} \u26E7`
    return [
      { k: 'Cagnotte finale', v: fmt(this.economy.balance) },
      { k: 'Paliers',         v: `${this.run.stage} / 3` },
      { k: 'Total misé',      v: fmt(this.economy.totalWagered) },
      { k: 'Record',          v: fmt(this.progression.highscore) },
    ]
  }

  private restartRun(): void {
    this.clearSave()
    this.runEnded = false
    this.endScreen.hide()
    this.renderer.hideGameOver()
    this.renderer.clearHighlights()
    this.hud.setSpinEnabled(false)
    this.actionBtn?.classList.add('hidden')
    this.characterSelect.show()
  }

  /**
   * Les deux axes de chance. `rtpNudge` ne touche que la convoitise : il corrige le RTP,
   * pas la fréquence de gain.
   */
  private getLuckProfile(): LuckProfile {
    const mods = this.bonusSystem.getModifiers()
    const rarityBonus = this.plugin.getLuckBonus?.(this.ctx) ?? 0
    return {
      rarity:   (mods.rarity + rarityBonus) / 100,
      cohesion: mods.cohesion / 100,
      nudge:    this.economy.rtpNudge,
    }
  }

  /** Libellé de la machine affiché au-dessus de la grille. */
  private applyMachineMeta(): void {
    const el = document.querySelector('.machine-meta')
    if (!el) return
    const m = this.machine
    const geometry = m.rows.kind === 'fixed'
      ? `${m.reelCount} × ${m.rows.count}`
      : `${m.reelCount} × ${m.rows.min}-${m.rows.max}`
    const mode = m.evaluator === 'lines'
      ? `${m.paylines?.length ?? 0} lignes`
      : 'ways'
    el.textContent = `${mode} · ${geometry}`
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
        pluginState: this.plugin.serialize?.() ?? null,
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
