import type { ItemDef, ItemInstance, Modifiers, SpinResult, GameSymbol } from '../types/index.ts'
import { shuffleArray } from '../utils/Random.ts'
import { getItemsByLevel } from './items/index.ts'

export class BonusSystem {
  static #counter = 0
  #active: ItemInstance[] = []
  #chainCounts: Record<string, number> = {}    // { [symbolId]: number } — spins consécutifs gagnants
  #chainBonuses: Record<string, number> = {}   // { [symbolId]: number } — bonus permanents acquis
  #stickyPositions: Record<string, GameSymbol> = {} // { [`${reel}-${row}`]: Symbol }

  get activeBonus(): ItemInstance[] { return [...this.#active] }
  get isFull(): boolean { return this.#active.length >= 5 }

  addBonus(bonusDef: ItemDef, target: number | string | null = null): ItemInstance {
    const instance: ItemInstance = {
      ...bonusDef,
      instanceId: String(++BonusSystem.#counter),
      target,
      remainingCharges: bonusDef.charges ?? undefined,
    }
    this.#active.push(instance)
    return instance
  }

  removeBonus(instanceId: string): number {
    const idx = this.#active.findIndex(b => b.instanceId === instanceId)
    if (idx === -1) return 0
    const [removed] = this.#active.splice(idx, 1)
    return Math.floor(removed.price * 0.5)
  }

  getShopOffers(level: 1 | 2 | 3): ItemDef[] {
    return shuffleArray(getItemsByLevel(level)).slice(0, 3)
  }

  getModifiers(): Modifiers {
    const modifiers: Modifiers = {
      columnMultipliers: Array(6).fill(1),
      wildColumns: Array(6).fill(false),
      symbolMultipliers: { ...this.#chainBonuses },
      jackpotMultiplier: 20,
      safetyNet: false,
      globalMultiplier: 1,
      freeRerolls: 0,
      stickyEnabled: false,
      chainEnabled: false,
      stickyPositions: this.#stickyPositions,
      luck: 0,
    }

    for (const bonus of this.#active) {
      switch (bonus.effect) {
        case 'column_multiplier':
          if (bonus.target !== null && bonus.target !== undefined) modifiers.columnMultipliers[bonus.target as number] = 2
          break
        case 'wild_column':
          if (bonus.target !== null && bonus.target !== undefined) modifiers.wildColumns[bonus.target as number] = true
          break
        case 'symbol_multiplier':
          if (bonus.target) {
            modifiers.symbolMultipliers[bonus.target as string] =
              (modifiers.symbolMultipliers[bonus.target as string] ?? 1) * 2
          }
          break
        case 'jackpot_boost':
          modifiers.jackpotMultiplier = 50
          break
        case 'safety_net':
          modifiers.safetyNet = true
          break
        case 'free_reroll':
          modifiers.freeRerolls += 1
          break
        case 'sticky':
          modifiers.stickyEnabled = true
          break
        case 'chain':
          modifiers.chainEnabled = true
          break
        case 'global_multiplier':
          if ((bonus.remainingCharges ?? 0) > 0) modifiers.globalMultiplier = 3
          break
        case 'luck_boost':
          modifiers.luck += 15
          break
        case 'lucky_streak':
          if ((bonus.remainingCharges ?? 0) > 0) modifiers.luck += 30
          break
      }
    }

    return modifiers
  }

  processPostSpin(winResult: SpinResult, grid: GameSymbol[][]): { stickyPositions: Record<string, GameSymbol> } {
    const mods = this.getModifiers()
    const { winLines, totalWin } = winResult

    // Chain tracking
    if (mods.chainEnabled) {
      const winningSymbols = new Set(winLines.map(l => l.symbolId))
      const chainBonus = this.#active.find(b => b.effect === 'chain')
      const tracked = chainBonus?.target as string | undefined

      if (tracked) {
        if (winningSymbols.has(tracked)) {
          this.#chainCounts[tracked] = (this.#chainCounts[tracked] ?? 0) + 1
          if (this.#chainCounts[tracked] >= 3) {
            this.#chainBonuses[tracked] = (this.#chainBonuses[tracked] ?? 1) * 1.5
            this.#chainCounts[tracked] = 0 // reset après activation
          }
        } else {
          this.#chainCounts[tracked] = 0
        }
      }
    }

    // Sticky positions
    const newSticky: Record<string, GameSymbol> = {}
    if (mods.stickyEnabled && totalWin > 0) {
      for (const line of winLines) {
        for (let reel = 0; reel < line.count; reel++) {
          const col = grid[reel]
          const matchRow = col.findIndex(s => s.id === line.symbolId || s.id === 'wild')
          if (matchRow !== -1) {
            newSticky[`${reel}-${matchRow}`] = col[matchRow]
          }
        }
      }
    }
    this.#stickyPositions = newSticky

    // Décrémenter les bonus à durée limitée
    for (const effect of ['global_multiplier', 'lucky_streak']) {
      const bonus = this.#active.find(b => b.effect === effect)
      if (bonus && (bonus.remainingCharges ?? 0) > 0) {
        bonus.remainingCharges = (bonus.remainingCharges ?? 0) - 1
        if (bonus.remainingCharges === 0) this.removeBonus(bonus.instanceId)
      }
    }

    return { stickyPositions: this.#stickyPositions }
  }

  resetWildColumns(): void {
    // wild_column is permanent — this method is a no-op by design
    // (kept for API compatibility; one-shot wild would remove here)
  }

  useFreeReroll(): boolean {
    const bonus = this.#active.find(b => b.effect === 'free_reroll')
    if (!bonus) return false
    this.removeBonus(bonus.instanceId)
    return true
  }

  reset(): void {
    this.#active          = []
    this.#chainCounts     = {}
    this.#chainBonuses    = {}
    this.#stickyPositions = {}
  }

  serialize() {
    return {
      active:          this.#active,
      chainCounts:     this.#chainCounts,
      chainBonuses:    this.#chainBonuses,
      stickyPositions: this.#stickyPositions,
    }
  }

  restore(data: ReturnType<BonusSystem['serialize']>): void {
    this.#active          = data.active          ?? []
    this.#chainCounts     = data.chainCounts     ?? {}
    this.#chainBonuses    = data.chainBonuses    ?? {}
    this.#stickyPositions = data.stickyPositions ?? {}
    // Advance the static counter past any restored instanceIds to prevent collisions
    const maxId = this.#active.reduce((m, b) => Math.max(m, parseInt(b.instanceId) || 0), 0)
    if (maxId > BonusSystem.#counter) BonusSystem.#counter = maxId
  }
}
