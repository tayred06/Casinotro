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
  minRowsPerReel?: number[]
}

export interface SpinResult {
  totalWin: Souls
  winLines: WinLine[]
  scatterTriggered: boolean
  dropBonus: boolean
}

export interface WinLine {
  symbolId: string
  count: number
  multiplier: number
  win: Souls
  reelRows: number[]
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
  luck: number
  cellDamage: number[][]
}

// ─── Items (bonus + consommables) ────────────────────────
export type ItemKind = 'bonus' | 'consumable'

export interface ItemDef {
  id: string
  name: string
  description: string
  level: 1 | 2 | 3
  price: Souls
  kind: ItemKind
  effect: string
  charges?: number
  needsTarget?: 'column' | 'symbol' | null
}

export interface ItemInstance extends ItemDef {
  instanceId: string
  target?: number | string | null
  remainingCharges?: number
}

// ─── Machine ─────────────────────────────────────────────
export interface MachineConfig {
  id: string
  name: string
  reelCount: number
  minRows: number
  maxRows: number
  rtpTarget: number
  unlockRequirement?: string
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
  rowCounts: number[]
  requestSpin(req?: SpinRequest): Promise<void>
  ui: UIContext
  addLog(msg: string, muted?: boolean): void
}

// ─── Plugin personnage ────────────────────────────────────
export interface CharacterPlugin {
  id: string
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
  offerModifier?(offer: ItemDef): ItemDef | null
  actions?: CharacterAction[]
  getModifierOverrides?(ctx: GameContext): Partial<Modifiers>
}

// ─── Actions de personnage (boutons UI) ──────────────────
export interface CharacterAction {
  id: string
  label: string
  title?: string
  isEnabled?(ctx: GameContext): boolean
  onInvoke(ctx: GameContext): void | Promise<void>
}

// ─── Spin déclenché par un personnage ────────────────────
export interface SpinRequest {
  free?: boolean
  globalMultiplier?: number
  luckBonus?: number
}
