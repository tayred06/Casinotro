import { shuffleArray } from '../utils/Random.js'

export const BONUS_POOL = [
  // Niveau 1
  {
    id: 'golden_column', name: 'Colonne Dorée',
    description: 'Un rouleau choisi vaut x2',
    level: 1, price: 20, effect: 'column_multiplier', needsTarget: 'column',
  },
  {
    id: 'safety_net', name: 'Filet de Sécurité',
    description: 'Spin sans gain → récupère 50% de la mise',
    level: 1, price: 15, effect: 'safety_net', needsTarget: null,
  },
  {
    id: 'free_reroll', name: 'Reroll Gratuit',
    description: '1 reroll de boutique gratuit',
    level: 1, price: 10, effect: 'free_reroll', needsTarget: null,
  },
  {
    id: 'symbol_multiplier', name: 'Symbole Béni',
    description: 'Un symbole choisi rapporte x2',
    level: 1, price: 25, effect: 'symbol_multiplier', needsTarget: 'symbol',
  },
  // Niveau 2
  {
    id: 'wild_column', name: 'Colonne Wild',
    description: 'Un rouleau entier devient Wild (permanent)',
    level: 2, price: 50, effect: 'wild_column', needsTarget: 'column',
  },
  {
    id: 'chain', name: 'Chaîne',
    description: 'Un symbole qui gagne 3 spins consécutifs gagne +50% permanent',
    level: 2, price: 40, effect: 'chain', needsTarget: 'symbol',
  },
  {
    id: 'sticky', name: 'Symbole Collant',
    description: 'Les symboles gagnants restent en place 1 spin',
    level: 2, price: 45, effect: 'sticky', needsTarget: null,
  },
  // Niveau 3
  {
    id: 'jackpot_boost', name: 'Jackpot Amplifié',
    description: 'Le multiplicateur x6 passe de x20 à x50',
    level: 3, price: 80, effect: 'jackpot_boost', needsTarget: null,
  },
  {
    id: 'global_multiplier', name: 'Ligne Magique',
    description: 'x3 sur tous les gains pendant 5 spins',
    level: 3, price: 100, effect: 'global_multiplier', needsTarget: null,
  },
]

export class BonusSystem {
  static #counter = 0
  #active = []
  #chainCounts = {}     // { [symbolId]: number } — spins consécutifs gagnants
  #chainBonuses = {}    // { [symbolId]: number } — bonus permanents acquis
  #stickyPositions = {} // { [`${reel}-${row}`]: Symbol }

  get activeBonus() { return [...this.#active] }
  get isFull() { return this.#active.length >= 5 }

  addBonus(bonusDef, target = null) {
    const instance = {
      ...bonusDef,
      instanceId: String(++BonusSystem.#counter),
      target,
      remainingUses: bonusDef.effect === 'global_multiplier' ? 5 : null,
    }
    this.#active.push(instance)
    return instance
  }

  removeBonus(instanceId) {
    const idx = this.#active.findIndex(b => b.instanceId === instanceId)
    if (idx === -1) return 0
    const [removed] = this.#active.splice(idx, 1)
    return Math.floor(removed.price * 0.5)
  }

  getShopOffers(level) {
    const eligible = BONUS_POOL.filter(b => b.level <= level)
    return shuffleArray(eligible).slice(0, 3)
  }

  getModifiers() {
    const modifiers = {
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
    }

    for (const bonus of this.#active) {
      switch (bonus.effect) {
        case 'column_multiplier':
          if (bonus.target !== null) modifiers.columnMultipliers[bonus.target] = 2
          break
        case 'wild_column':
          if (bonus.target !== null) modifiers.wildColumns[bonus.target] = true
          break
        case 'symbol_multiplier':
          if (bonus.target) {
            modifiers.symbolMultipliers[bonus.target] =
              (modifiers.symbolMultipliers[bonus.target] ?? 1) * 2
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
          if (bonus.remainingUses > 0) modifiers.globalMultiplier = 3
          break
      }
    }

    return modifiers
  }

  processPostSpin(winResult, grid) {
    const mods = this.getModifiers()
    const { winLines, totalWin } = winResult

    // Chain tracking
    if (mods.chainEnabled) {
      const winningSymbols = new Set(winLines.map(l => l.symbolId))
      const chainBonus = this.#active.find(b => b.effect === 'chain')
      const tracked = chainBonus?.target

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
    const newSticky = {}
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

    // Décrémenter global_multiplier
    const globalBonus = this.#active.find(b => b.effect === 'global_multiplier')
    if (globalBonus && globalBonus.remainingUses > 0) {
      globalBonus.remainingUses -= 1
      if (globalBonus.remainingUses === 0) {
        this.removeBonus(globalBonus.instanceId)
      }
    }

    return { stickyPositions: this.#stickyPositions }
  }

  resetWildColumns() {
    // wild_column is permanent — this method is a no-op by design
    // (kept for API compatibility; one-shot wild would remove here)
  }

  useFreeReroll() {
    const bonus = this.#active.find(b => b.effect === 'free_reroll')
    if (!bonus) return false
    this.removeBonus(bonus.instanceId)
    return true
  }
}
