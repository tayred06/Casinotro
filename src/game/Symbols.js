import { weightedRandom } from '../utils/Random.js'

export const SYMBOLS = [
  { id: 'lemon',   name: 'Citron',  emoji: '🍋', weight: 30, color: 0xFFDD00 },
  { id: 'grape',   name: 'Raisin',  emoji: '🍇', weight: 25, color: 0x9B30FF },
  { id: 'bell',    name: 'Cloche',  emoji: '🔔', weight: 18, color: 0xFF8C00 },
  { id: 'diamond', name: 'Diamant', emoji: '💎', weight: 12, color: 0x00E5FF },
  { id: 'star',    name: 'Étoile',  emoji: '⭐', weight: 8,  color: 0xFFD700 },
  { id: 'dog',     name: 'Chien',   emoji: '🐕', weight: 4,  color: 0xFF6B6B },
  { id: 'wild',    name: 'Wild',    emoji: '🃏', weight: 3,  color: 0xFFFFFF },
  { id: 'scatter', name: 'Scatter', emoji: '💫', weight: 2,  color: 0xFF69B4 },
]

export const WIN_SYMBOLS = SYMBOLS.filter(s => s.id !== 'wild' && s.id !== 'scatter')
export const WILD = SYMBOLS.find(s => s.id === 'wild')
export const SCATTER = SYMBOLS.find(s => s.id === 'scatter')

// Multipliers rebalanced: 3-symbol wins are modest, jackpots are rewarding
export const WIN_MULTIPLIERS = { 3: 0.8, 4: 3, 5: 10, 6: 50 }

export function getSymbolById(id) {
  return SYMBOLS.find(s => s.id === id)
}

export function generateReelColumn(rowCount) {
  const pool = SYMBOLS.map(s => ({ value: s, weight: s.weight }))
  return Array.from({ length: rowCount }, () => weightedRandom(pool))
}
