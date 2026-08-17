import { weightedRandom } from '../utils/Random.js'

export const LC_SYMBOLS = [
  { id: 'building', name: 'Immeuble', emoji: '🏢', weight: 28, color: 0x7B8FA1 },
  { id: 'car',      name: 'Voiture',  emoji: '🚗', weight: 24, color: 0xE07B54 },
  { id: 'light',    name: 'Néon',     emoji: '💡', weight: 18, color: 0xF0C040 },
  { id: 'cocktail', name: 'Cocktail', emoji: '🍸', weight: 12, color: 0x8BC34A },
  { id: 'camera',   name: 'Caméra',  emoji: '📷', weight: 8,  color: 0xE91E8C, rare: true },
  { id: 'gem',      name: 'Gemme',   emoji: '💎', weight: 5,  color: 0x00E5FF, rare: true },
  { id: 'wild',     name: 'Wild',     emoji: '🃏', weight: 3,  color: 0xFFFFFF, rare: true },
  { id: 'scatter',  name: 'Éclair',  emoji: '⚡', weight: 2,  color: 0xFFD700, rare: true },
]

export const LC_WILD    = LC_SYMBOLS.find(s => s.id === 'wild')
export const LC_SCATTER = LC_SYMBOLS.find(s => s.id === 'scatter')

// Cluster pay: minimum 5 connected symbols to win
// Multiplier applied to bet per cluster size
export const CLUSTER_PAY = {
  building: { 5: 0.5,  7: 1,    10: 2.5, 15: 6,   20: 15   },
  car:      { 5: 0.7,  7: 1.5,  10: 3.5, 15: 9,   20: 22   },
  light:    { 5: 1,    7: 2,    10: 5,   15: 14,  20: 35   },
  cocktail: { 5: 1.5,  7: 3.5,  10: 9,   15: 25,  20: 60   },
  camera:   { 5: 3,    7: 7,    10: 18,  15: 50,  20: 120  },
  gem:      { 5: 6,    7: 14,   10: 35,  15: 100, 20: 250  },
}

// Multiplier track: cascade index → multiplier value
export const CASCADE_MULTIPLIERS = [1, 2, 3, 5, 8, 15, 25, 50]

export function getLCMultiplier(cascadeIndex) {
  return CASCADE_MULTIPLIERS[Math.min(cascadeIndex, CASCADE_MULTIPLIERS.length - 1)]
}

// Pay tier: find the best matching cluster size bracket
export function getClusterPayout(symbolId, clusterSize) {
  const table = CLUSTER_PAY[symbolId]
  if (!table) return 0
  const tiers = Object.keys(table).map(Number).sort((a, b) => b - a)
  for (const tier of tiers) {
    if (clusterSize >= tier) return table[tier]
  }
  return 0
}

const LUCK_BIAS = {
  building: -0.25,
  car:      -0.15,
  light:    -0.05,
  cocktail:  0.15,
  camera:    0.40,
  gem:       0.55,
  wild:      0.50,
  scatter:   0.45,
}

export function generateLCGrid(rows, cols, luckFactor = 0, rareMultiplier = 1) {
  const pool = LC_SYMBOLS.map(s => ({
    value:  s,
    weight: Math.max(0.5,
      s.weight
      * (1 + luckFactor * (LUCK_BIAS[s.id] ?? 0))
      * (s.rare ? rareMultiplier : 1)
    ),
  }))
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => weightedRandom(pool))
  )
}
