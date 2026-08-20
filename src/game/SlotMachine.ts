import type {
  GameSymbol, MachineConfig, Modifiers, SpinOptions, SpinResult, Souls, WinLine,
} from '../types/index.ts'
import { random, randomInt } from '../utils/Random.ts'
import { generateReelColumn, pickAnchor, toLuckProfile, WILD_ID, SCATTER_ID, winSymbolsOf } from './Symbols.ts'
import type { LuckProfile } from './Symbols.ts'

/** Hauteur de chaque colonne pour ce spin. `fixedRows` prime sur la config machine. */
function resolveRowCounts(machine: MachineConfig, fixedRows?: number): number[] {
  const n = machine.reelCount
  if (fixedRows) {
    const clamped = Math.max(1, Math.round(fixedRows))
    return Array.from({ length: n }, () => clamped)
  }
  const rows = machine.rows
  if (rows.kind === 'fixed') {
    return Array.from({ length: n }, () => rows.count)
  }
  const { min, max } = rows
  return Array.from({ length: n }, () => randomInt(min, max))
}

export function spin(
  machine: MachineConfig,
  stickyPositions: Record<string, GameSymbol> = {},
  luck: number | LuckProfile = 0,
  opts: SpinOptions = {}
): { grid: GameSymbol[][], rowCounts: number[] } {
  const { rareMultiplier = 1, fixedRows } = opts
  const profile = toLuckProfile(luck)
  const rowCounts = resolveRowCounts(machine, fixedRows)
  // Une seule ancre pour tout le spin : c'est ce qui aligne les symboles entre rouleaux.
  // Limitée aux `minMatch` premiers rouleaux — au-delà, elle ne créerait plus des gains
  // plus fréquents mais des gains pleins, et le RTP part en vrille (mesuré ×2 à ×7).
  const anchor = pickAnchor(machine.symbolPool, profile.cohesion)
  const anchorReels = machine.minMatch
  const grid = rowCounts.map((rowCount, reel) => {
    const col = generateReelColumn(machine.symbolPool, rowCount, profile, rareMultiplier,
      reel < anchorReels ? anchor : null)
    for (let row = 0; row < rowCount; row++) {
      const key = `${reel}-${row}`
      if (stickyPositions[key]) col[row] = stickyPositions[key]
    }
    return col
  })
  return { grid, rowCounts }
}

// ─── Évaluation ───────────────────────────────────────────

interface EvalContext {
  machine: MachineConfig
  grid: GameSymbol[][]
  bet: Souls
  columnMultipliers: number[]
  symbolMultipliers: Record<string, number>
  globalMultiplier: number
  jackpotMultiplier: number
}

/** Plus haut multiplicateur de colonne parmi les rouleaux qui participent. */
function bestColumnMultiplier(mults: number[], count: number): number {
  let best = 1
  for (let reel = 0; reel < count; reel++) {
    if ((mults[reel] ?? 1) > best) best = mults[reel]
  }
  return best
}

/** Plafond du cumul des multiplicateurs d'items. */
export const MULT_CAP = 6

/**
 * Les multiplicateurs d'items s'additionnent au lieu de se multiplier, et le total est
 * plafonné : en multiplicatif, quatre items donnaient ×30 sur une seule combinaison.
 */
export function combineMultipliers(mults: number[]): number {
  const total = mults.reduce((acc, m) => acc + (m - 1), 1)
  return Math.min(MULT_CAP, total)
}

function payout(
  ctx: EvalContext,
  symbolId: string,
  count: number,
  ways: number
): { multiplier: number; win: Souls } | null {
  const base = ctx.machine.paytable[symbolId]?.[count]
  if (!base) return null

  const colMult = bestColumnMultiplier(ctx.columnMultipliers, count)
  const symMult = ctx.symbolMultipliers[symbolId] ?? 1
  const jackpot = count >= ctx.machine.reelCount ? ctx.jackpotMultiplier : 1

  const multiplier = base * ways * combineMultipliers([colMult, symMult, ctx.globalMultiplier, jackpot])
  return { multiplier, win: ctx.bet * multiplier }
}

/**
 * Ways (Megaways) — le symbole compte n'importe où dans la colonne. Il faut au moins
 * une occurrence par rouleau, en partant du rouleau 1, sans trou. Le gain est
 * multiplié par le nombre de combinaisons distinctes, c'est-à-dire le produit des
 * occurrences par rouleau.
 */
function evaluateWays(ctx: EvalContext): WinLine[] {
  const lines: WinLine[] = []

  for (const symbol of winSymbolsOf(ctx.machine.symbolPool)) {
    const perReel: number[][] = []

    for (let reel = 0; reel < ctx.machine.reelCount; reel++) {
      const col = ctx.grid[reel] ?? []
      const rows: number[] = []
      for (let row = 0; row < col.length; row++) {
        if (col[row].id === symbol.id || col[row].id === WILD_ID) rows.push(row)
      }
      if (rows.length === 0) break
      perReel.push(rows)
    }

    const count = perReel.length
    if (count < ctx.machine.minMatch) continue

    const ways = perReel.reduce((product, rows) => product * rows.length, 1)
    const pay = payout(ctx, symbol.id, count, ways)
    if (!pay) continue

    const cells: Array<[number, number]> = []
    perReel.forEach((rows, reel) => rows.forEach(row => cells.push([reel, row])))

    lines.push({
      symbolId: symbol.id,
      count,
      ways,
      multiplier: pay.multiplier,
      win: pay.win,
      cells,
      reelRows: perReel.map(rows => rows[0]),
    })
  }

  return lines
}

/**
 * Lignes de paie — une seule case par rouleau, celle que la ligne traverse. Le symbole
 * de référence est le premier non-wild rencontré ; une ligne entièrement wild paie le
 * symbole le plus rare de la machine.
 */
function evaluateLines(ctx: EvalContext): WinLine[] {
  const paylines = ctx.machine.paylines ?? []
  const rarest = winSymbolsOf(ctx.machine.symbolPool)[0]
  const lines: WinLine[] = []

  paylines.forEach((payline, paylineIndex) => {
    const cellsOnLine: GameSymbol[] = []
    for (let reel = 0; reel < ctx.machine.reelCount; reel++) {
      const cell = ctx.grid[reel]?.[payline[reel]]
      if (!cell) return          // ligne hors grille : machine mal configurée
      cellsOnLine.push(cell)
    }

    const lead = cellsOnLine.find(s => s.id !== WILD_ID && s.id !== SCATTER_ID)
    const symbolId = lead?.id ?? rarest?.id
    if (!symbolId) return

    let count = 0
    while (count < cellsOnLine.length) {
      const id = cellsOnLine[count].id
      if (id !== symbolId && id !== WILD_ID) break
      count++
    }
    if (count < ctx.machine.minMatch) return

    const pay = payout(ctx, symbolId, count, 1)
    if (!pay) return

    const cells: Array<[number, number]> = []
    for (let reel = 0; reel < count; reel++) cells.push([reel, payline[reel]])

    lines.push({
      symbolId,
      count,
      ways: 1,
      paylineIndex,
      multiplier: pay.multiplier,
      win: pay.win,
      cells,
      reelRows: cells.map(([, row]) => row),
    })
  })

  return lines
}

/**
 * Remboursement du Filet de Sécurité sur un spin mort. 46% des spins sont morts : à 50%
 * l'item seul faisait passer le RTP de 0.88 à 1.11, soit un joueur en avantage.
 */
export const SAFETY_NET_REFUND = 0.15

export function calculateWins(
  machine: MachineConfig,
  grid: GameSymbol[][],
  bet: Souls,
  modifiers: Partial<Modifiers> = {}
): SpinResult {
  const {
    columnMultipliers = Array(machine.reelCount).fill(1),
    wildColumns = Array(machine.reelCount).fill(false),
    symbolMultipliers = {},
    jackpotMultiplier = 1,
    safetyNet = false,
    globalMultiplier = 1,
  } = modifiers

  // Colonnes wild : la colonne entière substitue n'importe quel symbole.
  const wild = { id: WILD_ID, name: 'Wild', emoji: 'W', weight: 0, color: 0xFFFFFF }
  const effectiveGrid = grid.map((col, reel) =>
    wildColumns[reel] ? col.map(() => wild) : col
  )

  const ctx: EvalContext = {
    machine,
    grid: effectiveGrid,
    bet,
    columnMultipliers,
    symbolMultipliers,
    globalMultiplier,
    jackpotMultiplier,
  }

  const winLines = machine.evaluator === 'lines' ? evaluateLines(ctx) : evaluateWays(ctx)

  const scatterCount = grid.flat().filter(s => s.id === SCATTER_ID).length
  const scatterTriggered = scatterCount >= machine.scatterMin

  let totalWin = winLines.reduce((sum, l) => sum + l.win, 0)
  if (totalWin === 0 && safetyNet) totalWin = bet * SAFETY_NET_REFUND

  const hasLargeWin = winLines.some(l => l.count >= machine.minMatch + 1)
  const dropBonus = hasLargeWin && random() < 0.15

  return { totalWin, winLines, scatterTriggered, dropBonus }
}
