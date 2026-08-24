import type {
  ItemDef, ItemInstance, ItemRarity, Modifiers, ShopOffer, SpinResult, GameSymbol, Souls,
} from '../types/index.ts'
import { random, weightedRandom, shuffleArray } from '../utils/Random.ts'
import { getItemsByLevel, requireItem, nextRarity, paramOf, tierOf } from './items/index.ts'

/** Probabilité qu'une case gagnante reste figée au spin suivant (palier commun). */
export const STICKY_CHANCE = 0.35

/** Emplacements de bonus par palier de run, et en mode infini. */
export const SLOTS_BY_STAGE: Record<number, number> = { 1: 3, 2: 4, 3: 5 }
export const ENDLESS_SLOTS = 6
export const DEFAULT_MAX_SLOTS = SLOTS_BY_STAGE[1]

/** Emplacements gagnés à chaque quota franchi (le palier suivant en ajoute un). */
export const SLOTS_PER_QUOTA = 1

export function slotsForStage(stage: number, endless = false): number {
  if (endless) return ENDLESS_SLOTS
  return SLOTS_BY_STAGE[Math.min(Math.max(stage, 1), 3)] ?? DEFAULT_MAX_SLOTS
}

/**
 * Tirage de rareté en deux temps : d'abord le palier, ensuite l'item parmi ceux
 * débloqués. Un pool aplati (13 items × 3 raretés) ferait dériver les proportions.
 */
export const RARITY_ODDS: Record<string, Record<ItemRarity, number>> = {
  1:       { commun: 1,    rare: 0,    epique: 0 },
  2:       { commun: 0.75, rare: 0.25, epique: 0 },
  3:       { commun: 0.55, rare: 0.35, epique: 0.10 },
  endless: { commun: 0.45, rare: 0.35, epique: 0.20 },
}

/** Probabilité qu'une offre « écho » soit biaisée vers un item déjà possédé. */
export const ECHO_CHANCE = 0.4
/** Nombre d'offres tirées normalement, sans écho. */
const PURE_OFFERS = 1

/** Trois issues possibles pour un achat, pas un booléen. */
export type BuyState = 'ok' | 'fusion' | 'full' | 'max_owned'

export class BonusSystem {
  static #counter = 0
  /** Nombre de rouleaux de la machine courante — dimensionne les modificateurs. */
  #reelCount = 6
  #active: ItemInstance[] = []
  #chainCounts: Record<string, number> = {}    // { [symbolId]: number } — spins consécutifs gagnants
  #chainBonuses: Record<string, number> = {}   // { [symbolId]: number } — bonus permanents acquis
  #stickyPositions: Record<string, GameSymbol> = {} // { [`${reel}-${row}`]: Symbol }
  #stickyTtl: Record<string, number> = {}      // spins restants pour chaque case collée
  #maxSlots = DEFAULT_MAX_SLOTS
  #priceScale = 1
  #endless = false
  /** Régularité accumulée par les spins perdants (Porte-Bonheur épique). */
  #pityCohesion = 0
  /** Rouleaux wild tirés pour le spin courant, par instance. */
  #wildRoll: Record<string, boolean> = {}
  /** Ancre maintenue par le Métronome épique. */
  #heldAnchor: string | null = null
  #heldAnchorSpins = 0

  get activeBonus(): ItemInstance[] { return [...this.#active] }
  get reelCount(): number { return this.#reelCount }

  setReelCount(n: number): void { this.#reelCount = n }
  get isFull(): boolean { return this.#active.length >= this.#maxSlots }
  get maxSlots(): number { return this.#maxSlots }
  get endless(): boolean { return this.#endless }
  setEndless(v: boolean): void { this.#endless = v }

  /** Emplacements imposés par le palier courant. Ne descend jamais en dessous. */
  setMaxSlots(n: number): void { this.#maxSlots = Math.max(this.#maxSlots, n) }
  /** Élargit l'inventaire (quota franchi, panneau de debug). */
  grantSlots(n: number): void { this.#maxSlots += n }

  defOf(instance: ItemInstance): ItemDef { return requireItem(instance.defId) }
  priceOf(instance: ItemInstance): Souls { return tierOf(this.defOf(instance), instance.rarity).price }
  nameOf(instance: ItemInstance): string { return this.defOf(instance).name }

  addBonus(def: ItemDef, target: number | string | null = null, rarity: ItemRarity = 'commun'): ItemInstance {
    const instance: ItemInstance = {
      instanceId: String(++BonusSystem.#counter),
      defId: def.id,
      rarity,
      target,
      remainingCharges: tierOf(def, rarity).charges ?? undefined,
    }
    this.#active.push(instance)
    return instance
  }

  // ─── Fusion ────────────────────────────────────────────

  /**
   * Deux items fusionnent s'ils partagent id, rareté et cible. Cibles différentes =
   * ils coexistent ; raretés différentes aussi (commun + rare est légal).
   */
  findFusion(defId: string, rarity: ItemRarity, target: number | string | null = null): ItemInstance | null {
    const def = requireItem(defId)
    return this.#active.find(inst => {
      if (inst.defId !== defId || inst.rarity !== rarity) return false
      if (def.needsTarget) return (inst.target ?? null) === (target ?? null)
      return true
    }) ?? null
  }

  /** Nombre d'exemplaires possédés d'une définition, toutes raretés confondues. */
  countOwned(defId: string): number {
    return this.#active.filter(i => i.defId === defId).length
  }

  /**
   * État d'achat. `fusion` reste légal à inventaire plein : la fusion libère un slot
   * au lieu d'en consommer un.
   */
  buyState(defId: string, rarity: ItemRarity, target: number | string | null = null): BuyState {
    const def = requireItem(defId)
    const twin = this.findFusion(defId, rarity, target)
    if (twin) {
      // Un bonus déjà épique ne fusionne plus ; un consommable, si — il cumule ses charges.
      if (nextRarity(rarity) || def.kind === 'consumable') return 'fusion'
    }
    if (def.maxOwned !== undefined && this.countOwned(defId) >= def.maxOwned) return 'max_owned'
    if (this.isFull) return 'full'
    return 'ok'
  }

  /**
   * Achat effectif : fusionne si un jumeau existe, sinon ajoute une instance.
   * Retourne l'instance touchée et si elle vient d'une fusion.
   */
  acquire(
    defId: string,
    rarity: ItemRarity = 'commun',
    target: number | string | null = null
  ): { instance: ItemInstance; fused: boolean } | null {
    const def = requireItem(defId)
    const state = this.buyState(defId, rarity, target)
    if (state === 'full' || state === 'max_owned') return null

    if (state === 'fusion') {
      const twin = this.findFusion(defId, rarity, target)!
      const up = nextRarity(rarity)
      if (def.kind === 'consumable') {
        // La fusion d'un consommable ne touche que les charges : un ×9 sur cinq spins
        // vaudrait plus que tout le reste du build réuni.
        const gained = tierOf(def, rarity).charges ?? 0
        twin.remainingCharges = Math.round(((twin.remainingCharges ?? 0) + gained) * 1.5)
        if (up) twin.rarity = up
      } else {
        twin.rarity = up!
      }
      return { instance: twin, fused: true }
    }

    return { instance: this.addBonus(def, target, rarity), fused: false }
  }

  removeBonus(instanceId: string): number {
    const idx = this.#active.findIndex(b => b.instanceId === instanceId)
    if (idx === -1) return 0
    const [removed] = this.#active.splice(idx, 1)
    return Math.floor(this.priceOf(removed) * 0.5)
  }

  // ─── Boutique ──────────────────────────────────────────

  #rarityTable(level: 1 | 2 | 3): Record<ItemRarity, number> {
    return this.#endless ? RARITY_ODDS.endless : RARITY_ODDS[String(level)]
  }

  #rollRarity(level: 1 | 2 | 3): ItemRarity {
    const table = this.#rarityTable(level)
    const entries = Object.entries(table)
      .filter(([, w]) => w > 0)
      .map(([r, w]) => ({ value: r as ItemRarity, weight: w }))
    if (!entries.length) return 'commun'
    return weightedRandom(entries)
  }

  /**
   * Écho anti-slot-gelé : une offre sur trois est tirée à l'aveugle, les autres ont
   * ~40 % de chance d'être biaisées vers un item déjà possédé en un seul exemplaire.
   * Sans ça, un slot se gèle sur un item non fusionnable — 33 % du build mort au palier 1.
   */
  #echoCandidate(pool: ItemDef[]): { def: ItemDef; rarity: ItemRarity } | null {
    const singles = this.#active.filter(inst => this.countOwned(inst.defId) === 1)
      .filter(inst => pool.some(d => d.id === inst.defId))
      .filter(inst => nextRarity(inst.rarity) !== null || this.defOf(inst).kind === 'consumable')
    if (!singles.length) return null
    const pick = singles[Math.floor(random() * singles.length)]
    return { def: this.defOf(pick), rarity: pick.rarity }
  }

  /**
   * Les prix sont exprimés en multiples de la mise minimale du palier : sinon un item à
   * 80⛧ est hors de portée au palier 1 et bradé au palier 3.
   */
  getShopOffers(
    level: 1 | 2 | 3,
    priceScale: number = this.#priceScale,
    opts: { guaranteeRare?: boolean } = {}
  ): ShopOffer[] {
    const pool = getItemsByLevel(level)
    const shuffled = shuffleArray(pool)
    const offers: ShopOffer[] = []

    for (let i = 0; i < 3; i++) {
      const echo = i >= PURE_OFFERS && random() < ECHO_CHANCE ? this.#echoCandidate(pool) : null
      const def = echo?.def ?? shuffled[i % shuffled.length]
      const rarity = echo?.rarity ?? this.#rollRarity(level)
      offers.push({
        defId: def.id,
        rarity,
        price: Math.round(tierOf(def, rarity).price * priceScale),
      })
    }

    // Reroll épique : au moins une offre rare garantie.
    if (opts.guaranteeRare && !offers.some(o => o.rarity !== 'commun')) {
      const idx = Math.floor(random() * offers.length)
      const def = requireItem(offers[idx].defId)
      offers[idx] = { defId: def.id, rarity: 'rare', price: Math.round(tierOf(def, 'rare').price * priceScale) }
    }

    return offers
  }

  get priceScale(): number { return this.#priceScale }
  setPriceScale(scale: number): void {
    if (scale > 0) this.#priceScale = scale
  }

  /**
   * Tirage des colonnes wild du spin. Une colonne wild PERMANENTE est intenable sur une
   * machine à lignes : mesurée à ×3,5 de RTP à elle seule (chaque ligne n'a plus besoin
   * que de deux symboles au lieu de trois, sur vingt lignes). Elle est donc intermittente,
   * et le tirage est figé pour tout le spin — sinon l'affichage et l'évaluation divergent.
   */
  rollSpinState(): void {
    this.#wildRoll = {}
    for (const bonus of this.#active) {
      const def = this.defOf(bonus)
      if (def.effect !== 'wild_column') continue
      this.#wildRoll[bonus.instanceId] = random() < paramOf(def, bonus.rarity, 'chance', 0.15)
    }
  }

  // ─── Modificateurs ─────────────────────────────────────

  getModifiers(): Modifiers {
    const modifiers: Modifiers = {
      columnMultipliers: Array(this.#reelCount).fill(1),
      wildColumns: Array(this.#reelCount).fill(false),
      symbolMultipliers: { ...this.#chainBonuses },
      jackpotMultiplier: 1,
      safetyNet: false,
      globalMultiplier: 1,
      freeRerolls: 0,
      stickyEnabled: false,
      chainEnabled: false,
      stickyPositions: this.#stickyPositions,
      rarity: 0,
      cohesion: 0,
      safetyNetRate: 0,
      chainKeepOnLoss: false,
      rerollGuaranteesRare: false,
      forcedAnchor: null,
      scatterBoost: 0,
      jackpotFreeSpins: 0,
    }

    const boostColumn = (reel: number, mult: number) => {
      if (reel < 0 || reel >= this.#reelCount || mult <= 1) return
      modifiers.columnMultipliers[reel] = Math.max(modifiers.columnMultipliers[reel], mult)
    }

    for (const bonus of this.#active) {
      const def = this.defOf(bonus)
      const p = (key: string, fallback = 0) => paramOf(def, bonus.rarity, key, fallback)

      switch (def.effect) {
        case 'column_multiplier': {
          const reel = bonus.target as number
          if (reel === null || reel === undefined) break
          boostColumn(reel, p('mult', 2))
          // Palier épique : portée, pas puissance — le rouleau voisin prend ×1,5.
          const adjacent = p('adjacentMult')
          if (adjacent > 1) boostColumn(reel + 1 < this.#reelCount ? reel + 1 : reel - 1, adjacent)
          break
        }
        case 'wild_column':
          if (bonus.target !== null && bonus.target !== undefined && this.#wildRoll[bonus.instanceId]) {
            modifiers.wildColumns[bonus.target as number] = true
            boostColumn(bonus.target as number, p('mult', 1))
          }
          break
        case 'symbol_multiplier':
          if (bonus.target) {
            const id = bonus.target as string
            modifiers.symbolMultipliers[id] = (modifiers.symbolMultipliers[id] ?? 1) * p('mult', 2)
            if (p('anchorPriority') > 0) modifiers.forcedAnchor = id
          }
          break
        case 'jackpot_boost':
          modifiers.jackpotMultiplier = Math.max(modifiers.jackpotMultiplier, p('mult', 2.5))
          modifiers.jackpotFreeSpins = Math.max(modifiers.jackpotFreeSpins, p('freeSpins'))
          break
        case 'safety_net':
          modifiers.safetyNet = true
          modifiers.safetyNetRate = Math.max(modifiers.safetyNetRate, p('rate', 0.15))
          if (p('keepChain') > 0) modifiers.chainKeepOnLoss = true
          break
        case 'free_reroll':
          modifiers.freeRerolls += bonus.remainingCharges ?? 0
          if (p('guaranteeRare') > 0 && (bonus.remainingCharges ?? 0) > 0) modifiers.rerollGuaranteesRare = true
          break
        case 'sticky':
          modifiers.stickyEnabled = true
          break
        case 'chain':
          modifiers.chainEnabled = true
          break
        case 'global_multiplier':
          if ((bonus.remainingCharges ?? 0) > 0) {
            modifiers.globalMultiplier = Math.max(modifiers.globalMultiplier, p('mult', 3))
          }
          break
        case 'luck_boost':
          // Hybride : un peu des deux, sans exceller nulle part.
          modifiers.rarity += p('rarity', 10)
          modifiers.cohesion += p('cohesion', 10)
          if (p('pityCohesion') > 0) modifiers.cohesion += this.#pityCohesion
          break
        case 'regularity':
          modifiers.cohesion += p('cohesion', 20)
          if (p('anchorHold') > 0 && this.#heldAnchor && !modifiers.forcedAnchor) {
            modifiers.forcedAnchor = this.#heldAnchor
          }
          break
        case 'greed_eye':
          modifiers.rarity += p('rarity', 25)
          modifiers.scatterBoost = Math.max(modifiers.scatterBoost, p('scatterBoost'))
          break
        case 'lucky_streak':
          if ((bonus.remainingCharges ?? 0) > 0) modifiers.rarity += p('rarity', 30)
          break
      }
    }

    return modifiers
  }

  // ─── Après-spin ────────────────────────────────────────

  processPostSpin(
    winResult: SpinResult,
    grid: GameSymbol[][],
    opts: { anchorId?: string | null; freeSpin?: boolean } = {}
  ): { stickyPositions: Record<string, GameSymbol> } {
    const mods = this.getModifiers()
    const { winLines, totalWin } = winResult

    // Chaînes — croissance bornée : sans plafond, le mode infini la fait composer sans fin.
    if (mods.chainEnabled) {
      const winningSymbols = new Set(winLines.map(l => l.symbolId))
      const chainBonus = this.#active.find(b => this.defOf(b).effect === 'chain')
      const tracked = chainBonus?.target as string | undefined

      if (chainBonus && tracked) {
        const def = this.defOf(chainBonus)
        const needed = paramOf(def, chainBonus.rarity, 'spins', 3)
        const gain = paramOf(def, chainBonus.rarity, 'gain', 1.5)
        const cap = paramOf(def, chainBonus.rarity, 'cap', 3)

        if (winningSymbols.has(tracked)) {
          this.#chainCounts[tracked] = (this.#chainCounts[tracked] ?? 0) + 1
          if (this.#chainCounts[tracked] >= needed) {
            this.#chainBonuses[tracked] = Math.min(cap, (this.#chainBonuses[tracked] ?? 1) * gain)
            this.#chainCounts[tracked] = 0 // reset après activation
          }
        } else if (!mods.chainKeepOnLoss) {
          this.#chainCounts[tracked] = 0
        }
      }
    }

    this.#updateSticky(winLines, grid, totalWin, mods)

    // Pity de régularité : chaque spin perdant en rajoute, un gain remet à zéro.
    const pity = this.#active.reduce(
      (max, b) => Math.max(max, paramOf(this.defOf(b), b.rarity, 'pityCohesion')), 0)
    if (pity > 0) this.#pityCohesion = totalWin > 0 ? 0 : this.#pityCohesion + pity
    else this.#pityCohesion = 0

    this.#updateHeldAnchor(opts.anchorId ?? null)

    // Bonus à durée limitée. Le palier épique met son décompte en pause en free spins.
    for (const bonus of [...this.#active]) {
      const def = this.defOf(bonus)
      if (def.effect !== 'global_multiplier' && def.effect !== 'lucky_streak') continue
      if (opts.freeSpin && paramOf(def, bonus.rarity, 'pauseInFreeSpins') > 0) continue
      if ((bonus.remainingCharges ?? 0) > 0) {
        bonus.remainingCharges = (bonus.remainingCharges ?? 0) - 1
        if (bonus.remainingCharges === 0) this.removeBonus(bonus.instanceId)
      }
    }

    return { stickyPositions: this.#stickyPositions }
  }

  /**
   * Deux garde-fous contre l'auto-entretien : une case déjà collée ne peut pas se
   * recoller (elle a gagné parce qu'elle était figée), et chaque case gagnante ne colle
   * qu'avec la probabilité du palier.
   */
  #updateSticky(
    winLines: SpinResult['winLines'],
    grid: GameSymbol[][],
    totalWin: Souls,
    mods: Modifiers
  ): void {
    const stickyItem = this.#active.find(b => this.defOf(b).effect === 'sticky')
    const chance = stickyItem ? paramOf(this.defOf(stickyItem), stickyItem.rarity, 'chance', STICKY_CHANCE) : 0
    const duration = stickyItem ? paramOf(this.defOf(stickyItem), stickyItem.rarity, 'duration', 1) : 1

    const previousSticky = this.#stickyPositions
    const previousTtl = this.#stickyTtl
    const nextSticky: Record<string, GameSymbol> = {}
    const nextTtl: Record<string, number> = {}

    // Cases collées qui ont encore du temps devant elles (palier épique, 2 spins).
    for (const [key, ttl] of Object.entries(previousTtl)) {
      if (ttl > 1 && previousSticky[key]) {
        nextSticky[key] = previousSticky[key]
        nextTtl[key] = ttl - 1
      }
    }

    if (mods.stickyEnabled && totalWin > 0) {
      for (const line of winLines) {
        for (const [reel, row] of line.cells) {
          const key = `${reel}-${row}`
          // Une case déjà collée ne se recolle pas — y compris au 2e spin d'un collage épique.
          if (previousSticky[key] || nextSticky[key]) continue
          const symbol = grid[reel]?.[row]
          if (symbol && random() < chance) {
            nextSticky[key] = symbol
            nextTtl[key] = duration
          }
        }
      }
    }

    this.#stickyPositions = nextSticky
    this.#stickyTtl = nextTtl
  }

  /** Métronome épique : la machine « insiste » et garde la même ancre plusieurs spins. */
  #updateHeldAnchor(anchorId: string | null): void {
    const hold = this.#active.reduce(
      (max, b) => Math.max(max, paramOf(this.defOf(b), b.rarity, 'anchorHold')), 0)
    if (hold <= 0) {
      this.#heldAnchor = null
      this.#heldAnchorSpins = 0
      return
    }
    if (this.#heldAnchorSpins > 1) {
      this.#heldAnchorSpins -= 1
      return
    }
    this.#heldAnchor = anchorId
    this.#heldAnchorSpins = anchorId ? hold : 0
  }

  resetWildColumns(): void {
    // wild_column is permanent — this method is a no-op by design
    // (kept for API compatibility; one-shot wild would remove here)
  }

  useFreeReroll(): boolean {
    const bonus = this.#active.find(b => this.defOf(b).effect === 'free_reroll' && (b.remainingCharges ?? 0) > 0)
    if (!bonus) return false
    bonus.remainingCharges = (bonus.remainingCharges ?? 1) - 1
    if ((bonus.remainingCharges ?? 0) <= 0) this.removeBonus(bonus.instanceId)
    return true
  }

  reset(): void {
    this.#active          = []
    this.#chainCounts     = {}
    this.#chainBonuses    = {}
    this.#stickyPositions = {}
    this.#stickyTtl       = {}
    this.#maxSlots        = DEFAULT_MAX_SLOTS
    this.#endless         = false
    this.#pityCohesion    = 0
    this.#heldAnchor      = null
    this.#heldAnchorSpins = 0
    this.#wildRoll        = {}
  }

  serialize() {
    return {
      maxSlots:        this.#maxSlots,
      active:          this.#active,
      chainCounts:     this.#chainCounts,
      chainBonuses:    this.#chainBonuses,
      stickyPositions: this.#stickyPositions,
      stickyTtl:       this.#stickyTtl,
      endless:         this.#endless,
      pityCohesion:    this.#pityCohesion,
      heldAnchor:      this.#heldAnchor,
      heldAnchorSpins: this.#heldAnchorSpins,
    }
  }

  restore(data: ReturnType<BonusSystem['serialize']>): void {
    this.#active          = data.active          ?? []
    this.#chainCounts     = data.chainCounts     ?? {}
    this.#chainBonuses    = data.chainBonuses    ?? {}
    this.#stickyPositions = data.stickyPositions ?? {}
    this.#stickyTtl       = data.stickyTtl       ?? {}
    this.#maxSlots        = data.maxSlots        ?? DEFAULT_MAX_SLOTS
    this.#endless         = data.endless         ?? false
    this.#pityCohesion    = data.pityCohesion    ?? 0
    this.#heldAnchor      = data.heldAnchor      ?? null
    this.#heldAnchorSpins = data.heldAnchorSpins ?? 0
    // Advance the static counter past any restored instanceIds to prevent collisions
    const maxId = this.#active.reduce((m, b) => Math.max(m, parseInt(b.instanceId) || 0), 0)
    if (maxId > BonusSystem.#counter) BonusSystem.#counter = maxId
  }
}
