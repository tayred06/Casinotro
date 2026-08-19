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

/**
 * Barème par nombre de symboles alignés.
 *
 * Calibré par simulation (40 000 spins, RNG graine fixe) pour un RTP de base
 * de 0,91 à chance nulle, jackpot 28 — voir SlotMachine.rtp.test.ts.
 * Ne pas retoucher ces valeurs sans relancer ces tests : elles ne sont pas
 * arbitraires, elles sortent d'un calibrage.
 */
export const WIN_MULTIPLIERS: Record<number, number> = { 3: 0.85, 4: 3.4, 5: 11.8, 6: 35 }

/**
 * Valeur d'un symbole, croissante avec sa rareté. Multiplie le barème ci-dessus.
 *
 * Avant, le paiement ne dépendait que du nombre de symboles alignés : une ligne
 * de chiens (poids 4) rapportait autant qu'une ligne de citrons (poids 30).
 */
export const SYMBOL_VALUE: Record<string, number> = {
  lemon: 1, grape: 1.1, bell: 1.3, diamond: 1.6, star: 2, dog: 2.75,
}

export function symbolValue(id: string): number {
  return SYMBOL_VALUE[id] ?? 1
}

/**
 * Symboles premium : ils comptent dès UNE case par rouleau, là où les symboles
 * courants doivent occuper 40 % de la colonne.
 *
 * Sans cette règle, un symbole rare ne formait presque jamais de chaîne — le
 * chien apparaissait dans 1 chaîne sur 30 000 spins — et augmenter la chance
 * faisait donc BAISSER le RTP en raréfiant les symboles qui, eux, s'alignaient.
 */
export const PREMIUM_SYMBOLS = new Set(['star', 'dog'])

export function isPremium(id: string): boolean {
  return PREMIUM_SYMBOLS.has(id)
}

/**
 * Palier maximum d'une chaîne premium.
 *
 * Comme un premium compte dès une case, la probabilité qu'il tienne les 6
 * rouleaux est P(≥1 par colonne)^6 — donc extrêmement sensible au poids. Le
 * palier jackpot rendait tout bonus de rareté explosif : Luxuria multipliait le
 * RTP par 7. Les premium plafonnent donc au palier 5.
 */
export const PREMIUM_MAX_TIER = 5

export function getSymbolById(id: string): GameSymbol | undefined {
  return ALL_SYMBOLS.find(s => s.id === id)
}

/** Comme getSymbolById, mais lève sur un id inconnu. Pour les fixtures et les tests. */
export function requireSymbol(id: string): GameSymbol {
  const symbol = getSymbolById(id)
  if (!symbol) throw new Error(`Symbole inconnu : ${id}`)
  return symbol
}

/**
 * Effet de la chance sur le poids de chaque symbole : positif = plus fréquent.
 *
 * Amplitudes réduites par rapport à la version d'origine : combinées à la règle
 * premium, elles donnent une pente mesurée de +48 % de RTP au maximum de chance
 * atteignable en jeu (~0,95), au lieu d'une courbe qui s'effondrait.
 */
const LUCK_BIAS: Record<string, number> = {
  lemon:   -0.15,
  grape:   -0.10,
  bell:    -0.05,
  diamond:  0.10,
  star:     0.20,
  dog:      0.30,
  wild:     0.20,
  scatter:  0.20,
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
      // Uniquement les rares qui paient. Le wild se substitue à TOUS les
      // symboles : le booster faisait chaîner toutes les lignes à la fois et
      // multipliait le RTP par près de 3 à lui seul.
      * (isPremium(s.id) ? rareMultiplier : 1)
    ),
  }))
  return Array.from({ length: rowCount }, () => weightedRandom(pool, rng))
}
