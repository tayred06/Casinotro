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
): { grid: GameSymbol[][], rowCounts: number[], anchor: string | null } {
  const { rareMultiplier = 1, fixedRows } = opts
  const profile = toLuckProfile(luck)
  const rowCounts = resolveRowCounts(machine, fixedRows)
  // Une seule ancre pour tout le spin : c'est ce qui aligne les symboles entre rouleaux.
  // Limitée aux `minMatch` premiers rouleaux — au-delà, elle ne créerait plus des gains
  // plus fréquents mais des gains pleins, et le RTP part en vrille (mesuré ×2 à ×7).
  const anchor = pickAnchor(machine.symbolPool, profile.cohesion, profile.forcedAnchor ?? null)
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
  return { grid, rowCounts, anchor: anchor?.id ?? null }
}

// ─── Évaluation ───────────────────────────────────────────

interface EvalContext {
  machine: MachineConfig
  grid: GameSymbol[][]
  bet: Souls
  columnMultipliers: number[]
  /** Rouleaux transformés en wild par un item — comptés pour 1 occurrence. */
  wildColumns: boolean[]
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

/**
 * Plafond du cumul des multiplicateurs d'items, appliqué en un seul endroit : le produit
 * de toutes les sources multiplicatives d'une même combinaison (colonnes dorées, symbole
 * béni, jackpot, ligne magique, chaînes). Un plafond silencieux passe pour un bug, celui-ci
 * est affiché.
 */
export const MULT_CAP = 12

export function combineMultipliers(mults: number[]): number {
  const total = mults.reduce((acc, m) => acc * m, 1)
  return Math.min(MULT_CAP, total)
}

/**
 * Rouleaux « vrais » d'une combinaison : ceux qui ne doivent pas leur participation à une
 * colonne rendue wild par un item. Mesuré : sur `rigide`, une seule colonne wild suffisait
 * à faire passer le RTP de 0,92 à 7,0 — chaque ligne n'avait plus besoin que de deux
 * symboles au lieu de trois, sur vingt lignes. Une colonne wild ALLONGE donc les
 * combinaisons, elle n'en crée jamais le minimum.
 */
function naturalCount(wildColumns: boolean[], count: number): number {
  let natural = 0
  for (let reel = 0; reel < count; reel++) if (!wildColumns[reel]) natural++
  return natural
}

/** Colonnes wild consécutives tolérées depuis le rouleau 1. */
export const maxWildRun = (machine: MachineConfig): number => Math.max(1, machine.minMatch - 2)

/**
 * Invariant wild. Avec `minMatch` 3, deux colonnes wild sur les rouleaux 1-2 font gagner
 * les 20 lignes à CHAQUE spin : le rouleau 3 suffit à compléter, quel que soit son symbole.
 * La limite tenable est donc `minMatch - 2`, soit une seule colonne wild tant que
 * `minMatch` vaut 3 — d'où le `maxOwned: 1` de l'item côté boutique.
 */
export function sanitizeWildColumns(machine: MachineConfig, wildColumns: boolean[]): boolean[] {
  const out = [...wildColumns]
  const limit = maxWildRun(machine)
  let run = 0
  for (let reel = 0; reel < out.length; reel++) {
    if (!out[reel]) break
    run++
    if (run > limit) out[reel] = false
  }
  return out
}

function payout(
  ctx: EvalContext,
  symbolId: string,
  count: number,
  ways: number
): { multiplier: number; win: Souls; capped: boolean } | null {
  const base = ctx.machine.paytable[symbolId]?.[count]
  if (!base) return null

  const colMult = bestColumnMultiplier(ctx.columnMultipliers, count)
  const symMult = ctx.symbolMultipliers[symbolId] ?? 1
  const jackpot = count >= ctx.machine.reelCount ? ctx.jackpotMultiplier : 1

  const sources = [colMult, symMult, ctx.globalMultiplier, jackpot]
  const raw = sources.reduce((acc, m) => acc * m, 1)
  const combined = combineMultipliers(sources)
  const multiplier = base * ways * combined
  return { multiplier, win: ctx.bet * multiplier, capped: raw > combined + 1e-9 }
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
      // Une colonne rendue wild par un item ne compte que pour 1 occurrence : sinon
      // elle multiplie les ways par sa hauteur (2 à 7) sur TOUS les symboles.
      perReel.push(ctx.wildColumns[reel] ? [rows[0]] : rows)
    }

    const count = perReel.length
    if (count < ctx.machine.minMatch) continue
    if (naturalCount(ctx.wildColumns, count) < ctx.machine.minMatch) continue

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
      capped: pay.capped,
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
    if (naturalCount(ctx.wildColumns, count) < ctx.machine.minMatch) return

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
      capped: pay.capped,
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
    safetyNetRate = SAFETY_NET_REFUND,
    globalMultiplier = 1,
    jackpotFreeSpins = 0,
  } = modifiers

  // Colonnes wild : la colonne entière substitue n'importe quel symbole.
  const safeWilds = sanitizeWildColumns(machine, wildColumns)
  const wild = { id: WILD_ID, name: 'Wild', emoji: 'W', weight: 0, color: 0xFFFFFF }
  const effectiveGrid = grid.map((col, reel) =>
    safeWilds[reel] ? col.map(() => wild) : col
  )

  const ctx: EvalContext = {
    machine,
    grid: effectiveGrid,
    bet,
    columnMultipliers,
    wildColumns: safeWilds,
    symbolMultipliers,
    globalMultiplier,
    jackpotMultiplier,
  }

  const winLines = machine.evaluator === 'lines' ? evaluateLines(ctx) : evaluateWays(ctx)

  const scatterCount = grid.flat().filter(s => s.id === SCATTER_ID).length
  const scatterTriggered = scatterCount >= machine.scatterMin

  let totalWin = winLines.reduce((sum, l) => sum + l.win, 0)
  if (totalWin === 0 && safetyNet) totalWin = bet * (safetyNetRate || SAFETY_NET_REFUND)

  const hasLargeWin = winLines.some(l => l.count >= machine.minMatch + 1)
  const dropBonus = hasLargeWin && random() < 0.15

  // Jackpot Amplifié épique : une combinaison pleine offre un free spin.
  const fullCombo = winLines.some(l => l.count >= machine.reelCount)
  const bonusFreeSpins = fullCombo ? jackpotFreeSpins : 0

  return {
    totalWin, winLines, scatterTriggered, dropBonus,
    capped: winLines.some(l => l.capped),
    bonusFreeSpins,
  }
}
