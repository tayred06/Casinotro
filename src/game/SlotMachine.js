import { randomInt } from '../utils/Random.js'
import { generateReelColumn, WIN_SYMBOLS, WIN_MULTIPLIERS } from './Symbols.js'

const REEL_COUNT = 6
const MIN_ROWS = 2
const MAX_ROWS = 7

export function spin(stickyPositions = {}, luckFactor = 0) {
  const rowCounts = Array.from({ length: REEL_COUNT }, () => randomInt(MIN_ROWS, MAX_ROWS))
  const grid = rowCounts.map((rowCount, reel) => {
    const col = generateReelColumn(rowCount, luckFactor)
    for (let row = 0; row < rowCount; row++) {
      const key = `${reel}-${row}`
      if (stickyPositions[key]) col[row] = stickyPositions[key]
    }
    return col
  })
  return { grid, rowCounts }
}

export function calculateWins(grid, bet, modifiers = {}) {
  const {
    columnMultipliers = Array(REEL_COUNT).fill(1),
    wildColumns = Array(REEL_COUNT).fill(false),
    symbolMultipliers = {},
    jackpotMultiplier = 50,
    safetyNet = false,
    globalMultiplier = 1,
  } = modifiers

  // Build effective grid with wild columns applied
  const effectiveGrid = grid.map((col, reel) =>
    wildColumns[reel]
      ? col.map(() => ({ id: 'wild', name: 'Wild', emoji: '🃏', weight: 0, color: 0xFFFFFF }))
      : col
  )

  const winLines = []

  for (const symbol of WIN_SYMBOLS) {
    const reelRows = []
    for (let reel = 0; reel < REEL_COUNT; reel++) {
      const col = effectiveGrid[reel]
      // Require a proportional number of matching symbols per column
      // (prevents every reel matching every symbol due to many rows)
      const threshold = Math.max(1, Math.ceil(col.length * 0.4))
      const matchIndices = col.reduce((acc, s, i) => {
        if (s.id === symbol.id || s.id === 'wild') acc.push(i)
        return acc
      }, [])
      if (matchIndices.length < threshold) break
      reelRows.push(matchIndices[0]) // first matching row used for visual line
    }

    const count = reelRows.length
    if (count < 3) continue

    const baseMultiplier = count === 6 ? jackpotMultiplier : WIN_MULTIPLIERS[count]

    // Apply highest column multiplier among winning reels
    let colMult = 1
    for (let reel = 0; reel < count; reel++) {
      if (columnMultipliers[reel] > colMult) colMult = columnMultipliers[reel]
    }

    const symMult = symbolMultipliers[symbol.id] ?? 1
    const totalMultiplier = baseMultiplier * colMult * symMult * globalMultiplier
    const lineWin = bet * totalMultiplier

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
  const dropBonus = hasLargeWin && Math.random() < 0.15

  return { totalWin, winLines, scatterTriggered, dropBonus }
}
