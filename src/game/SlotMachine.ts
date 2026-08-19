import type { GameSymbol, SpinOptions, SpinResult, WinLine, Modifiers, Souls } from '../types/index.ts'
import { randomInt } from '../utils/Random.ts'
import type { Rng } from '../utils/Random.ts'
import { generateReelColumn, WIN_SYMBOLS, WIN_MULTIPLIERS, symbolValue, isPremium, PREMIUM_MAX_TIER } from './Symbols.ts'
import { getMachine } from './machines/index.ts'

// Les dimensions viennent de la config machine plutôt que d'être redéclarées ici.
// (Le moteur ne gère encore qu'une machine : passer la config en paramètre de
// spin() reste à faire pour en supporter plusieurs — voir docs/AUDIT.md §2.2.)
const MACHINE = getMachine('megaways')
const REEL_COUNT = MACHINE.reelCount
const MIN_ROWS = MACHINE.minRows
const MAX_ROWS = MACHINE.maxRows

// États de dégât d'une case (Ira)
export const CELL_INTACT = 0
export const CELL_CRACKED = 1
export const CELL_DEAD = 2

const CRACKED_WIN_FACTOR = 0.5

export { REEL_COUNT, MIN_ROWS, MAX_ROWS }

export function spin(
  stickyPositions: Record<string, GameSymbol> = {},
  luckFactor = 0,
  opts: SpinOptions = {},
  rng: Rng = Math.random
): { grid: GameSymbol[][], rowCounts: number[] } {
  const { rareMultiplier = 1, minRowsPerReel = [] } = opts

  const rowCounts = Array.from({ length: REEL_COUNT }, (_, reel) => {
    // Un rouleau doit garder assez de rangées pour que ses cases abîmées
    // restent affichées d'un tour à l'autre.
    const floor = Math.min(Math.max(MIN_ROWS, minRowsPerReel[reel] ?? MIN_ROWS), MAX_ROWS)
    return randomInt(floor, MAX_ROWS, rng)
  })

  const grid = rowCounts.map((rowCount, reel) => {
    const col = generateReelColumn(rowCount, luckFactor, rareMultiplier, rng)
    for (let row = 0; row < rowCount; row++) {
      const key = `${reel}-${row}`
      if (stickyPositions[key]) col[row] = stickyPositions[key]
    }
    return col
  })
  return { grid, rowCounts }
}

export function calculateWins(
  grid: GameSymbol[][],
  bet: Souls,
  modifiers: Partial<Modifiers> = {},
  rng: Rng = Math.random
): SpinResult {
  const {
    columnMultipliers = Array(REEL_COUNT).fill(1),
    wildColumns = Array(REEL_COUNT).fill(false),
    symbolMultipliers = {},
    jackpotMultiplier = WIN_MULTIPLIERS[6]!,
    safetyNet = false,
    globalMultiplier = 1,
    cellDamage = [],
  } = modifiers

  // Build effective grid with wild columns applied
  const effectiveGrid = grid.map((col, reel) =>
    wildColumns[reel]
      ? col.map(() => ({ id: 'wild', name: 'Wild', emoji: '🃏', weight: 0, color: 0xFFFFFF }))
      : col
  )

  const damageAt = (reel: number, row: number): number =>
    cellDamage[reel]?.[row] ?? CELL_INTACT

  const winLines: WinLine[] = []

  for (const symbol of WIN_SYMBOLS) {
    // reelRows reste aligné sur l'index du rouleau physique :
    // -1 = rouleau entièrement mort, sauté sans casser la chaîne.
    const reelRows: number[] = []
    let count = 0
    let degraded = false

    for (let reel = 0; reel < REEL_COUNT; reel++) {
      const col = effectiveGrid[reel]

      // Les cases mortes ne comptent ni comme match, ni dans le seuil.
      const liveRows = col.reduce((acc: number[], _s, i) => {
        if (damageAt(reel, i) < CELL_DEAD) acc.push(i)
        return acc
      }, [])

      if (liveRows.length === 0) {
        reelRows.push(-1)
        continue
      }

      // Les symboles courants doivent occuper 40 % de la colonne, ce qui évite
      // qu'un rouleau haut valide tous les symboles à la fois. Les premium
      // comptent dès une case : sans ça ils ne s'alignaient jamais, et la
      // chance faisait baisser le RTP en les favorisant.
      const threshold = isPremium(symbol.id)
        ? 1
        : Math.max(1, Math.ceil(liveRows.length * 0.4))
      const matchIndices = liveRows.filter(
        i => col[i].id === symbol.id || col[i].id === 'wild'
      )
      if (matchIndices.length < threshold) break

      reelRows.push(matchIndices[0]) // first matching row used for visual line
      if (matchIndices.some(i => damageAt(reel, i) === CELL_CRACKED)) degraded = true
      count++
    }

    if (count < 3) continue

    // Les premium plafonnent avant le jackpot : voir PREMIUM_MAX_TIER.
    const tier = isPremium(symbol.id) ? Math.min(count, PREMIUM_MAX_TIER) : count
    const baseMultiplier = tier === REEL_COUNT ? jackpotMultiplier : WIN_MULTIPLIERS[tier]

    // Apply highest column multiplier among participating reels
    let colMult = 1
    for (let reel = 0; reel < reelRows.length; reel++) {
      if (reelRows[reel] === -1) continue
      if (columnMultipliers[reel] > colMult) colMult = columnMultipliers[reel]
    }

    const symMult = symbolMultipliers[symbol.id] ?? 1
    // La rareté détermine la taille du gain ; le nombre aligné, le palier.
    const totalMultiplier =
      baseMultiplier * symbolValue(symbol.id) * colMult * symMult * globalMultiplier
    let lineWin = bet * totalMultiplier

    // Une case fissurée dans la chaîne divise le gain de la ligne
    if (degraded) lineWin *= CRACKED_WIN_FACTOR

    winLines.push({ symbolId: symbol.id, count, multiplier: totalMultiplier, win: lineWin, reelRows })
  }

  // Scatter check
  const scatterCount = grid.flat().filter(s => s.id === 'scatter').length
  const scatterTriggered = scatterCount >= 3

  let totalWin = winLines.reduce((sum, l) => sum + l.win, 0)

  if (totalWin === 0 && safetyNet) {
    totalWin = bet * 0.5
  }

  const hasLargeWin = winLines.some(l => l.count >= 4)
  const dropBonus = hasLargeWin && rng() < 0.15

  return { totalWin, winLines, scatterTriggered, dropBonus }
}
