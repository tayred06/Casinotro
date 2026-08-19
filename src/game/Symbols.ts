import type { GameSymbol } from '../types/index.ts'
import { weightedRandom } from '../utils/Random.ts'

interface SymbolDef extends GameSymbol {
  rare?: boolean
}

/**
 * Bibliothèque complète. Une machine n'en utilise qu'un sous-ensemble (`symbolPool`).
 *
 * Répartition volontaire en trois étages, comme une vraie machine : des bas-payants
 * très fréquents (cartes), des moyens, des hauts très rares. Sans cet étalement,
 * un moteur "ways" paie un 6-of-a-kind un spin sur quatre.
 */
const SYMBOL_LIBRARY: SymbolDef[] = [
  // ── Bas-payants (cartes) ────────────────────────────
  { id: 'ten',     name: 'Dix',     emoji: '🔟', weight: 30, color: 0xC9D8C0 },
  { id: 'jack',    name: 'Valet',   emoji: '🇯',  weight: 28, color: 0xC9D8C0 },
  { id: 'queen',   name: 'Dame',    emoji: '🇶',  weight: 26, color: 0xC9D8C0 },
  { id: 'king',    name: 'Roi',     emoji: '🇰',  weight: 24, color: 0xC9D8C0 },
  { id: 'ace',     name: 'As',      emoji: '🇦',  weight: 22, color: 0xC9D8C0 },
  // ── Moyens (enseignes) ──────────────────────────────
  { id: 'lemon',   name: 'Pique',   emoji: '♠',  weight: 16, color: 0xDCF7C8 },
  { id: 'grape',   name: 'Trèfle',  emoji: '♣',  weight: 14, color: 0xDCF7C8 },
  { id: 'bell',    name: 'Cœur',    emoji: '♥',  weight: 11, color: 0xFF2D55 },
  { id: 'diamond', name: 'Carreau', emoji: '♦',  weight: 8,  color: 0xFF2D55 },
  // ── Hauts-payants ───────────────────────────────────
  { id: 'star',    name: 'Sept',    emoji: '7',  weight: 5,  color: 0xB6F36A, rare: true },
  { id: 'dog',     name: 'Étoile',  emoji: '★',  weight: 3,  color: 0xFFD700, rare: true },
  // ── Spéciaux ────────────────────────────────────────
  { id: 'wild',    name: 'Wild',    emoji: 'W',  weight: 3,  color: 0xFFFFFF, rare: true },
  { id: 'scatter', name: 'Scatter', emoji: '⛧',  weight: 2,  color: 0xFF69B4, rare: true },
]

export const SYMBOLS: GameSymbol[] = SYMBOL_LIBRARY
export const WILD_ID = 'wild'
export const SCATTER_ID = 'scatter'
export const WILD = SYMBOL_LIBRARY.find(s => s.id === WILD_ID)!
export const SCATTER = SYMBOL_LIBRARY.find(s => s.id === SCATTER_ID)!

/** Symboles payants : tout sauf le wild (qui substitue) et le scatter (qui se compte à part). */
export const WIN_SYMBOLS: GameSymbol[] =
  SYMBOL_LIBRARY.filter(s => s.id !== WILD_ID && s.id !== SCATTER_ID)

export function getSymbolById(id: string): GameSymbol | undefined {
  return SYMBOL_LIBRARY.find(s => s.id === id)
}

/** Résout les ids d'une machine en définitions. Lève si un id est inconnu. */
export function resolvePool(ids: string[]): SymbolDef[] {
  return ids.map(id => {
    const s = SYMBOL_LIBRARY.find(x => x.id === id)
    if (!s) throw new Error(`Symbole inconnu dans le pool : ${id}`)
    return s
  })
}

/** Symboles payants d'un pool donné, du plus rare au plus fréquent. */
export function winSymbolsOf(ids: string[]): GameSymbol[] {
  return resolvePool(ids)
    .filter(s => s.id !== WILD_ID && s.id !== SCATTER_ID)
    .sort((a, b) => a.weight - b.weight)
}

// Biais par symbole : positif = favorisé par la convoitise, négatif = raréfié.
const RARITY_BIAS: Record<string, number> = {
  ten:     -0.35,
  jack:    -0.32,
  queen:   -0.30,
  king:    -0.28,
  ace:     -0.25,
  lemon:   -0.15,
  grape:   -0.10,
  bell:     0.10,
  diamond:  0.20,
  star:     0.40,
  dog:      0.60,
  wild:     0.50,
  scatter:  0.50,
}

/**
 * Deux axes de chance, volontairement séparés — ils tirent dans des directions opposées :
 *
 * - `rarity` (convoitise) : pousse les hauts-payants, écrase les cartes. Gains plus gros,
 *   mais MOINS fréquents, puisque ce sont les bas-payants qui remplissent les lignes.
 * - `cohesion` (régularité) : tire un symbole d'ancrage par spin et le surpondère sur
 *   toute la grille. Ne change pas QUEL symbole paie, seulement la probabilité qu'il
 *   s'aligne — donc monte le taux de gain sur les deux évaluateurs (`ways` et `lines`).
 */
export interface LuckProfile {
  rarity: number
  cohesion: number
  /** Correction RTP invisible (`Economy.rtpNudge`), non amplifiée. */
  nudge?: number
}

export const NEUTRAL_LUCK: LuckProfile = { rarity: 0, cohesion: 0 }

const MAX_RARITY = 1
const MAX_COHESION = 0.5

/** Un nombre nu reste interprété comme de la convoitise (ancienne signature). */
export function toLuckProfile(luck: number | LuckProfile = 0): LuckProfile {
  const p = typeof luck === 'number' ? { rarity: luck, cohesion: 0 } : luck
  return {
    rarity:   Math.max(0, Math.min(MAX_RARITY, p.rarity)),
    cohesion: Math.max(0, Math.min(MAX_COHESION, p.cohesion)),
    nudge:    p.nudge ?? 0,
  }
}

/**
 * Gains asymétriques, mesurés par Monte-Carlo : le côté positif doit être bien plus fort
 * que le négatif, sinon la convoitise détruit plus de petits gains qu'elle n'en crée de
 * gros — et fait BAISSER le RTP au lieu de le monter (c'était le bug d'origine).
 */
const RARITY_POS_GAIN = 3
const RARITY_NEG_GAIN = 0.4

/** Poids de l'ancre : ×(1 + cohesion × COHESION_GAIN). */
const COHESION_GAIN = 3

/**
 * Ancre d'un spin, tirée sur les poids de base : les symboles fréquents ancrent plus
 * souvent, ce qui garde la régularité "bon marché" en RTP. Wild et scatter sont exclus —
 * les surpondérer ferait exploser les gains au lieu d'augmenter leur fréquence.
 */
export function pickAnchor(poolIds: string[], cohesion: number): GameSymbol | null {
  if (cohesion <= 0) return null
  const candidates = resolvePool(poolIds)
    .filter(s => s.id !== WILD_ID && s.id !== SCATTER_ID)
    .map(s => ({ value: s as GameSymbol, weight: s.weight }))
  return candidates.length ? weightedRandom(candidates) : null
}

function rarityFactor(id: string, rarity: number, nudge: number): number {
  const bias = RARITY_BIAS[id] ?? 0
  const gain = bias > 0 ? RARITY_POS_GAIN : RARITY_NEG_GAIN
  return 1 + bias * (rarity * gain + nudge)
}

export function generateReelColumn(
  poolIds: string[],
  rowCount: number,
  luck: number | LuckProfile = 0,
  rareMultiplier = 1,
  anchor: GameSymbol | null = null
): GameSymbol[] {
  const { rarity, cohesion, nudge } = toLuckProfile(luck)
  const pool = resolvePool(poolIds).map(s => ({
    value:  s as GameSymbol,
    weight: Math.max(0.5,
      s.weight
      * rarityFactor(s.id, rarity, nudge ?? 0)
      * (s.rare ? rareMultiplier : 1)
      * (anchor && s.id === anchor.id ? 1 + cohesion * COHESION_GAIN : 1)
    ),
  }))
  return Array.from({ length: rowCount }, () => weightedRandom(pool))
}
