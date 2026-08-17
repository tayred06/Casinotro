import { generateLCGrid, getClusterPayout, getLCMultiplier, LC_SCATTER } from './LitCitySymbols.js'

export const LC_ROWS = 5
export const LC_COLS = 5
export const MIN_CLUSTER = 5
export const SCATTER_THRESHOLD = 3
export const FREE_SPINS_COUNT = 10

export function spinLC(luckFactor = 0, rareMultiplier = 1) {
  return generateLCGrid(LC_ROWS, LC_COLS, luckFactor, rareMultiplier)
}

// BFS — returns array of cell arrays, one per cluster
export function findClusters(grid) {
  const rows = grid.length
  const cols = grid[0].length
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false))
  const clusters = []

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (visited[r][c] || !grid[r][c] || grid[r][c].id === 'scatter') continue

      const sym = grid[r][c]
      // wild connects to the first non-wild neighbour it touches (resolved below)
      const targetId = sym.id === 'wild' ? null : sym.id

      const cluster = []
      const queue   = [{ r, c }]
      visited[r][c] = true

      while (queue.length) {
        const { r: cr, c: cc } = queue.shift()
        cluster.push({ r: cr, c: cc })

        for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          const nr = cr + dr
          const nc = cc + dc
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue
          if (visited[nr][nc] || !grid[nr][nc]) continue
          const nSym = grid[nr][nc]
          if (nSym.id === 'scatter') continue
          // Match: same symbol, or wild on either side
          const matches = nSym.id === targetId || nSym.id === 'wild' || targetId === null
          if (!matches) continue
          visited[nr][nc] = true
          queue.push({ r: nr, c: nc })
        }
      }

      // Resolve targetId for pure-wild clusters (don't pay out — no symbol id)
      const resolvedId = cluster.map(({ r: cr, c: cc }) => grid[cr][cc].id).find(id => id !== 'wild') ?? null
      if (resolvedId && cluster.length >= MIN_CLUSTER) {
        clusters.push({ symbolId: resolvedId, cells: cluster })
      }
    }
  }
  return clusters
}

export function calculateLCWins(grid, clusters, bet, cascadeIndex = 0, globalMultiplier = 1) {
  const cascadeMult = getLCMultiplier(cascadeIndex)
  const winLines = []

  for (const { symbolId, cells } of clusters) {
    const basePayout = getClusterPayout(symbolId, cells.length)
    if (basePayout === 0) continue
    const totalMultiplier = basePayout * cascadeMult * globalMultiplier
    const win = bet * totalMultiplier
    winLines.push({ symbolId, count: cells.length, multiplier: totalMultiplier, cascadeMult, win, cells })
  }

  const totalWin = winLines.reduce((s, l) => s + l.win, 0)

  const scatterCount = grid.flat().filter(s => s?.id === 'scatter').length
  const freeSpinsTriggered = scatterCount >= SCATTER_THRESHOLD

  return { totalWin, winLines, freeSpinsTriggered, cascadeMult }
}

// Remove winning cells and let symbols fall. Returns new grid.
export function tumble(grid, winLines) {
  const rows = grid.length
  const cols = grid[0].length
  const next = grid.map(row => [...row])

  // Null out winning cells
  for (const { cells } of winLines) {
    for (const { r, c } of cells) {
      next[r][c] = null
    }
  }

  // Gravity: for each column, compact non-null to bottom, fill top with null
  for (let c = 0; c < cols; c++) {
    const column = next.map(row => row[c]).filter(s => s !== null)
    const empty  = rows - column.length
    for (let r = 0; r < rows; r++) {
      next[r][c] = r < empty ? null : column[r - empty]
    }
  }

  return next
}

// Fill null cells from a fresh random grid (top fill after tumble)
export function fillGrid(grid, luckFactor = 0, rareMultiplier = 1) {
  const rows = grid.length
  const cols = grid[0].length
  const fresh = generateLCGrid(rows, cols, luckFactor, rareMultiplier)
  return grid.map((row, r) =>
    row.map((cell, c) => cell ?? fresh[r][c])
  )
}
