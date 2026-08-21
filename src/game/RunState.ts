import type { Souls } from '../types/index.ts'

/** Solde de départ d'un run. */
export const START_BALANCE: Souls = 100

/**
 * Le quota d'un palier s'exprime en multiples de sa mise minimale : la durée d'un palier
 * (≈ K / RTP spins) reste constante quelle que soit l'échelle des nombres.
 */
export const STAGE_QUOTA_K: [number, number, number, number] = [180, 235, 290, 345]
/** Mise minimale de chaque palier — escalade ×3, pas ×25. */
export const STAGE_MIN_BETS: [Souls, Souls, Souls, Souls] = [1, 3, 8, 24]
/**
 * Passage en mode infini : la mise minimale (et donc la barre de vie) prend un cran ×3,
 * une seule fois. Au-delà, seul le quota durcit — sinon la vie enflait aussi vite que la
 * mise et le mode infini devenait plus confortable que le run normal.
 */
export const ENDLESS_BET_FACTOR = 3
/**
 * Vitalité : le solde est une barre de vie plafonnée par palier — le trop-plein d'un gain
 * part en crédit boutique. Le plafond s'exprime en mises minimales, comme le quota : la
 * marge se resserre palier après palier (175 → 100 → 75 → 60 mises).
 * Aucun plancher : franchir un palier agrandit la barre, il ne la remplit jamais.
 */
export const STAGE_HP_CAP_K: [number, number, number, number] = [175, 100, 75, 60]
/**
 * Plafond absolu de vitalité, tous paliers et mode infini confondus : au-delà, la barre
 * de vie cesse d'être une contrainte et le run ne peut plus se perdre.
 */
export const HP_HARD_CAP: Souls = 1000

/**
 * Mode infini seulement : la plus grosse mise vaut 80 % de la barre de vie, un spin peut
 * donc tout emporter. Les paliers à quota gardent l'échelle classique, moins brutale.
 */
export const MAX_BET_HP_RATIO = 0.8

/** Arrondi lisible : 1-2 chiffres significatifs selon l'ordre de grandeur. */
function roundBet(v: number): Souls {
  if (v < 10) return Math.max(1, Math.round(v))
  const step = 10 ** (Math.floor(Math.log10(v)) - 1)
  return Math.round(v / step) * step
}

/** Paliers de mise d'un palier à quota : échelle fixe ×1 ×2 ×3 ×5 ×10. */
export function betOptionsFor(min: Souls): Souls[] {
  return [min, min * 2, min * 3, min * 5, min * 10]
}

/**
 * Paliers de mise du mode infini : progression géométrique de la mise minimale à
 * `MAX_BET_HP_RATIO` de la vitalité maximale. Doublons écartés — la liste reste
 * strictement croissante même quand min et max sont proches.
 */
export function endlessBetOptionsFor(min: Souls, hpCap: Souls): Souls[] {
  const max = Math.max(min, roundBet(hpCap * MAX_BET_HP_RATIO))
  const ratio = (max / min) ** (1 / 4)
  const tiers: Souls[] = [min]
  for (let i = 1; i < 4; i++) {
    const value = roundBet(min * ratio ** i)
    tiers.push(Math.max(tiers[tiers.length - 1] + 1, value))
  }
  tiers.push(Math.max(tiers[tiers.length - 1] + 1, max))
  return tiers
}

/** @deprecated conservé pour les sauvegardes antérieures à la refonte du quota. */
export const STAGE_GOALS: [Souls, Souls, Souls] = [500, 2000, 10000]
export const INITIAL_BET_OPTIONS: Souls[] = betOptionsFor(STAGE_MIN_BETS[0])

/** Nombre de paliers par défaut. Avaritia en joue un de plus (voir `maxStage`). */
export const DEFAULT_MAX_STAGE = 3
export const MAX_STAGE_CAP = 4

export class RunState {
  stage: 1 | 2 | 3 | 4 = 1
  /**
   * Nombre de paliers du run. 3 pour tout le monde ; 4 pour Avaritia, dont la
   * boutique ne s'ouvre en entier qu'au dernier palier.
   */
  maxStage: number = DEFAULT_MAX_STAGE
  betOptions: Souls[] = [...INITIAL_BET_OPTIONS]
  machineId = 'megaways'
  characterId = 'luxuria'
  spinCount = 0
  dialoguePlayed = false
  /** Quotas franchis au-delà du palier 3 (mode infini). 0 = run normal. */
  endlessLevel = 0

  get isEndless(): boolean {
    return this.endlessLevel > 0
  }

  /** Mise minimale du palier courant — unité dans laquelle s'exprime le quota. */
  get minBet(): Souls {
    return this.betOptions[0]
  }

  /** Mise maximale offerte — 80 % de la vitalité maximale en mode infini. */
  get maxBet(): Souls {
    return this.betOptions[this.betOptions.length - 1]
  }

  /**
   * Unité de référence du palier : mise minimale théorique, indépendante de `betOptions`.
   * Le cran ×3 du mode infini ne s'applique qu'une fois, à l'entrée.
   */
  get #stageUnit(): Souls {
    const base = STAGE_MIN_BETS[Math.min(this.stage, MAX_STAGE_CAP) - 1]
    return this.endlessLevel > 0 ? base * ENDLESS_BET_FACTOR : base
  }

  /**
   * Paliers de mise du palier courant. Échelle classique tant qu'il y a un quota ;
   * indexée sur la barre de vie une fois en mode infini.
   */
  #rebuildBetOptions(): void {
    this.betOptions = this.endlessLevel > 0
      ? endlessBetOptionsFor(this.#stageUnit, this.hpCap)
      : betOptionsFor(this.#stageUnit)
  }

  /**
   * Quota du palier courant. Le mode infini n'en a plus : on y joue pour aller le plus
   * loin possible, la seule limite est la barre de vie.
   */
  get currentGoal(): Souls {
    if (this.isEndless) return Infinity
    const k = STAGE_QUOTA_K[Math.min(this.stage, MAX_STAGE_CAP) - 1]
    return Math.round(k * this.minBet)
  }

  /**
   * Plafond de vitalité du palier — le solde ne monte jamais au-dessus. Indexé sur
   * l'unité du palier : en mode infini il grandit une fois, à l'entrée, puis plus jamais.
   * Borné par `HP_HARD_CAP`.
   */
  get hpCap(): Souls {
    const raw = STAGE_HP_CAP_K[Math.min(this.stage, MAX_STAGE_CAP) - 1] * this.#stageUnit
    return Math.min(HP_HARD_CAP, Math.round(raw))
  }

  /**
   * Bascule en mode infini : un cran de mise et de vitalité, une seule fois. Plus de
   * quota ensuite — le run dure tant que la vitalité tient. Idempotent.
   */
  enterEndless(): void {
    if (this.endlessLevel > 0) return
    this.endlessLevel = 1
    this.#rebuildBetOptions()
  }

  /** Dernier palier du run : au-delà, c'est la victoire ou le mode infini. */
  get isFinalStage(): boolean {
    return this.stage >= this.maxStage
  }

  advanceStage(): void {
    if (this.isFinalStage) return
    this.stage = (this.stage + 1) as 2 | 3 | 4
    this.#rebuildBetOptions()
  }

  reset(characterId: string, machineId: string, maxStage: number = DEFAULT_MAX_STAGE): void {
    this.stage = 1
    this.maxStage = Math.min(MAX_STAGE_CAP, Math.max(1, Math.round(maxStage)))
    this.betOptions = [...INITIAL_BET_OPTIONS]
    this.characterId = characterId
    this.machineId = machineId
    this.spinCount = 0
    this.dialoguePlayed = false
    this.endlessLevel = 0
  }

  serialize() {
    return {
      stage: this.stage,
      maxStage: this.maxStage,
      betOptions: this.betOptions,
      machineId: this.machineId,
      characterId: this.characterId,
      spinCount: this.spinCount,
      dialoguePlayed: this.dialoguePlayed,
      endlessLevel: this.endlessLevel,
    }
  }

  restore(data: ReturnType<RunState['serialize']>): void {
    this.stage = data.stage ?? 1
    this.maxStage = data.maxStage ?? DEFAULT_MAX_STAGE
    this.endlessLevel = data.endlessLevel ?? 0
    // Les paliers de mise se déduisent entièrement du palier et du niveau infini :
    // les recalculer évite de traîner les échelles des sauvegardes précédentes.
    this.#rebuildBetOptions()
    this.machineId = data.machineId ?? 'megaways'
    this.characterId = data.characterId ?? 'luxuria'
    this.spinCount = data.spinCount ?? 0
    this.dialoguePlayed = data.dialoguePlayed ?? false
  }
}
