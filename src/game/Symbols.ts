import type { GameSymbol } from '../types/index.ts'
import { weightedRandom } from '../utils/Random.ts'
import type { Rng } from '../utils/Random.ts'

interface SymbolDef extends GameSymbol {
  rare?: boolean
}

const ALL_SYMBOLS: SymbolDef[] = [
  { id: 'lemon',   name: 'Citron',  emoji: '🍋', weight: 30, color: 0xFFDD00 },
  { id: 'grape',   name: 'Raisin',  emoji: '🍇', weight: 25, color: 0x9B30FF },
  { id: 'bell',    name: 'Cloche',  emoji: '🔔', weight: 18, color: 0xFF8C00 },
  { id: 'diamond', name: 'Diamant', emoji: '💎', weight: 12, color: 0x00E5FF },
  { id: 'star',    name: 'Étoile',  emoji: '⭐', weight: 8,  color: 0xFFD700, rare: true },
  { id: 'dog',     name: 'Chien',   emoji: '🐕', weight: 4,  color: 0xFF6B6B, rare: true },
  { id: 'wild',    name: 'Wild',    emoji: '🃏', weight: 3,  color: 0xFFFFFF, rare: true },
  { id: 'scatter', name: 'Scatter', emoji: '💫', weight: 2,  color: 0xFF69B4, rare: true },
]

export const SYMBOLS: GameSymbol[] = ALL_SYMBOLS
export const WIN_SYMBOLS: GameSymbol[] = ALL_SYMBOLS.filter(s => s.id !== 'wild' && s.id !== 'scatter')
export const WILD = ALL_SYMBOLS.find(s => s.id === 'wild')
export const SCATTER = ALL_SYMBOLS.find(s => s.id === 'scatter')

// Multipliers rebalanced: 3-symbol wins are modest, jackpots are rewarding
export const WIN_MULTIPLIERS: Record<number, number> = { 3: 0.8, 4: 3, 5: 10, 6: 50 }

export function getSymbolById(id: string): GameSymbol | undefined {
  return ALL_SYMBOLS.find(s => s.id === id)
}

/** Comme getSymbolById, mais lève sur un id inconnu. Pour les fixtures et les tests. */
export function requireSymbol(id: string): GameSymbol {
  const symbol = getSymbolById(id)
  if (!symbol) throw new Error(`Symbole inconnu : ${id}`)
  return symbol
}

// Bias per symbol: positive = boosted by luck, negative = reduced by luck
const LUCK_BIAS: Record<string, number> = {
  lemon:   -0.30,
  grape:   -0.20,
  bell:    -0.10,
  diamond:  0.20,
  star:     0.40,
  dog:      0.60,
  wild:     0.50,
  scatter:  0.50,
}

export function generateReelColumn(
  rowCount: number,
  luckFactor = 0,
  rareMultiplier = 1,
  rng: Rng = Math.random
): GameSymbol[] {
  const pool = ALL_SYMBOLS.map(s => ({
    value:  s as GameSymbol,
    weight: Math.max(0.5,
      s.weight
      * (1 + luckFactor * (LUCK_BIAS[s.id] ?? 0))
      * (s.rare ? rareMultiplier : 1)
    ),
  }))
  return Array.from({ length: rowCount }, () => weightedRandom(pool, rng))
}
