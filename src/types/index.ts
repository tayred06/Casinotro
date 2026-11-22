// ─── Monnaie ─────────────────────────────────────────────
export type Souls = number

// ─── Symboles ────────────────────────────────────────────
export interface GameSymbol {
  id: string
  name: string
  emoji: string
  weight: number
  color: number
}

// ─── Spin ────────────────────────────────────────────────
export interface SpinOptions {
  rareMultiplier?: number
  /** Force la hauteur des colonnes, quelle que soit la machine. */
  fixedRows?: number
}

export interface SpinResult {
  totalWin: Souls
  winLines: WinLine[]
  scatterTriggered: boolean
  dropBonus: boolean
  /** Au moins une combinaison a été plafonnée par MULT_CAP. */
  capped?: boolean
  /** Free spins offerts par un item (Jackpot Amplifié épique). */
  bonusFreeSpins?: number
}

export interface WinLine {
  symbolId: string
  /** Nombre de rouleaux consécutifs (depuis le rouleau 1) qui participent. */
  count: number
  /** Multiplicateur total appliqué à la mise (paytable × bonus × ways). */
  multiplier: number
  win: Souls
  /** Nombre de combinaisons payées. Toujours 1 sur une machine à lignes. */
  ways: number
  /** Index de la ligne de paie touchée. Absent sur une machine ways. */
  paylineIndex?: number
  /** Toutes les cases gagnantes, en [rouleau, ligne]. Source du surlignage. */
  cells: Array<[number, number]>
  /** Première case gagnante par rouleau. Conservé pour compatibilité. */
  reelRows: number[]
  /** Vrai si le cumul des multiplicateurs a tapé MULT_CAP. */
  capped?: boolean
}

// ─── Modificateurs ───────────────────────────────────────
export interface Modifiers {
  columnMultipliers: number[]
  wildColumns: boolean[]
  symbolMultipliers: Record<string, number>
  jackpotMultiplier: number
  safetyNet: boolean
  globalMultiplier: number
  freeRerolls: number
  stickyEnabled: boolean
  chainEnabled: boolean
  stickyPositions: Record<string, GameSymbol>
  /** Convoitise : biais vers les hauts-payants (gains plus gros, moins fréquents). */
  rarity: number
  /** Régularité : biais de répétition d'un symbole (gains plus fréquents, même taille). */
  cohesion: number
  /** Taux de remboursement du Filet de Sécurité (0 = pas de filet). */
  safetyNetRate: number
  /** Un spin mort ne remet pas le compteur de chaîne à zéro (Filet épique). */
  chainKeepOnLoss: boolean
  /** Chaque reroll garantit au moins une offre rare (Reroll épique). */
  rerollGuaranteesRare: boolean
  /** Symbole imposé comme ancre de cohésion, s'il y en a un. */
  forcedAnchor: string | null
  /** Surpoids du scatter (Œil du Cupide épique). */
  scatterBoost: number
  /** Free spins offerts par une combinaison pleine (Jackpot épique). */
  jackpotFreeSpins: number
}

// ─── Items (bonus + consommables) ────────────────────────
export type ItemKind = 'bonus' | 'consumable'

/** Trois paliers : puissance ×1,4 par palier, coût ×2,2 puis ×4,5. */
export type ItemRarity = 'commun' | 'rare' | 'epique'

export interface ItemTier {
  price: Souls
  description: string
  /** Valeurs numériques de l'effet à ce palier. Lues par getModifiers(). */
  params: Record<string, number>
  charges?: number
}

export interface ItemDef {
  id: string
  name: string
  level: 1 | 2 | 3
  kind: ItemKind
  effect: string
  needsTarget?: 'column' | 'symbol' | null
  /** Cap par famille, ex. wild_column: 1. Absent = pas de cap. */
  maxOwned?: number
  tiers: Record<ItemRarity, ItemTier>
}

/**
 * Une instance ne dérive plus de sa définition : elle la référence. Tout ce qui a
 * besoin du prix ou de la description passe par `getItem(defId).tiers[rarity]`.
 */
export interface ItemInstance {
  instanceId: string
  defId: string
  rarity: ItemRarity
  target?: number | string | null
  remainingCharges?: number
}

/** Une entrée de boutique : une définition, tirée à une rareté, à un prix. */
export interface ShopOffer {
  defId: string
  rarity: ItemRarity
  price: Souls
}

// ─── Machine ─────────────────────────────────────────────

/** Hauteur des colonnes : figée, ou tirée au sort à chaque spin (Megaways). */
export type RowSpec =
  | { kind: 'fixed'; count: number }
  | { kind: 'variable'; min: number; max: number }

/**
 * Mode de calcul des gains — les deux mécaniques réelles de casino.
 *  - 'ways'  : le symbole compte n'importe où dans la colonne. Gain = paytable × nombre
 *              de combinaisons (produit des occurrences par rouleau). Modèle Megaways.
 *  - 'lines' : lignes de paie tracées d'avance, une case par rouleau. Modèle classique.
 */
export type EvaluatorKind = 'ways' | 'lines'

/** paytable[symbolId][nombre de rouleaux] = multiplicateur de mise. */
export type Paytable = Record<string, Record<number, number>>

export interface MachineConfig {
  id: string
  name: string
  reelCount: number
  rows: RowSpec
  evaluator: EvaluatorKind
  /** Requis si evaluator === 'lines'. paylines[i][reel] = index de ligne. */
  paylines?: number[][]
  /** Ids de symboles utilisés par cette machine, puisés dans SYMBOL_LIBRARY. */
  symbolPool: string[]
  paytable: Paytable
  /** Nombre minimum de rouleaux consécutifs pour payer. Typiquement 3. */
  minMatch: number
  /** Nombre de scatters déclenchant les free spins. */
  scatterMin: number
  rtpTarget: number
  unlockRequirement?: string
  /** false = machine retirée du pool jouable, mais toujours validée par les tests. */
  playable?: boolean
}

// ─── Dialogue ────────────────────────────────────────────
export interface DialogueLine {
  speaker: string
  text: string
}

// ─── Contexte passé aux hooks ────────────────────────────
export interface UIContext {
  addLog(msg: string, muted?: boolean): void
  triggerDialogue(lines: DialogueLine[]): void
  updateHUD(): void
  updateShop(): void
}

export interface GameContext {
  economy: import('../game/Economy').Economy
  bonusSystem: import('../game/BonusSystem').BonusSystem
  ui: UIContext
  addLog(msg: string, muted?: boolean): void
}

// ─── Action de personnage (bouton dédié dans la barre) ───
export interface CharacterAction {
  id: string
  label: string
  hint?: string
  enabled: boolean
}

export interface CharacterActionResult {
  /** Case touchée par l'action, pour le retour visuel. */
  impact?: { col: number; row: number; broken: boolean }
  freeSpins?: number
  winMultiplier?: number
  gameOver?: string | null
}

// ─── Personnage de debug ─────────────────────────────────
/** État du bac à sable : lu par GameLoop, écrit par le panneau de debug. */
export interface DebugState {
  /** Aucune défaite : quota manqué, solde à zéro et onLossCheck sont ignorés. */
  godMode: boolean
  /** Multiplicateur appliqué à chaque gain de spin. */
  winMultiplier: number
  /** Convoitise forcée (0-100), ou null pour laisser les items décider. */
  rarityOverride: number | null
  /** Régularité forcée (0-100), ou null. */
  cohesionOverride: number | null
}

// ─── Plugin personnage ────────────────────────────────────
export interface CharacterPlugin {
  id: string
  /** Présent uniquement sur le personnage de debug. */
  debugState?: DebugState
  onSetup?(ctx: GameContext): void
  onTeardown?(ctx: GameContext): void
  onBeforeSpin?(ctx: GameContext): void
  onAfterSpin?(ctx: GameContext, result: SpinResult): void
  onWin?(ctx: GameContext, amount: Souls): void
  onStageComplete?(ctx: GameContext, stage: number): void
  onShopSell?(ctx: GameContext, item: ItemInstance): void
  onLossCheck?(ctx: GameContext): boolean
  onDialogueTrigger?(ctx: GameContext): DialogueLine[]
  getSpinOptions?(ctx: GameContext): SpinOptions
  getLuckBonus?(ctx: GameContext): number
  offerModifier?(offer: ShopOffer): ShopOffer | null
  transformGrid?(ctx: GameContext, grid: GameSymbol[][]): GameSymbol[][]
  /** Usure par case, de 0 (intacte) à 1 (morte). Indexé [colonne][ligne]. */
  getCellStates?(ctx: GameContext): number[][]
  /** Mise imposée par le personnage : le joueur ne choisit plus ses paliers. */
  getForcedBet?(ctx: GameContext): { amount: Souls; nextIncrement: number | null } | null
  getAction?(ctx: GameContext): CharacterAction | null
  onAction?(ctx: GameContext, actionId: string): Promise<CharacterActionResult> | CharacterActionResult
  serialize?(): any
  restore?(data: any): void
}
