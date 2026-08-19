import type { MachineConfig, Paytable } from '../../types/index.ts'

/**
 * Machine à lignes de paie fixes — 6 rouleaux × 5 lignes, 20 lignes tracées.
 * C'est la machine d'Ira : rigide, sans Megaways, chaque case a une position stable
 * d'un spin à l'autre (indispensable pour ancrer les dégâts de la mécanique Frappe).
 */

/** paylines[i][reel] = index de ligne traversée sur ce rouleau. */
const PAYLINES: number[][] = [
  [0, 0, 0, 0, 0, 0],
  [1, 1, 1, 1, 1, 1],
  [2, 2, 2, 2, 2, 2],
  [3, 3, 3, 3, 3, 3],
  [4, 4, 4, 4, 4, 4],
  [0, 1, 2, 3, 4, 4],
  [4, 3, 2, 1, 0, 0],
  [1, 0, 1, 2, 1, 0],
  [3, 4, 3, 2, 3, 4],
  [0, 1, 0, 1, 0, 1],
  [4, 3, 4, 3, 4, 3],
  [1, 2, 3, 2, 1, 0],
  [3, 2, 1, 2, 3, 4],
  [2, 1, 0, 1, 2, 3],
  [2, 3, 4, 3, 2, 1],
  [0, 0, 1, 2, 2, 3],
  [4, 4, 3, 2, 2, 1],
  [1, 1, 2, 3, 3, 4],
  [3, 3, 2, 1, 1, 0],
  [2, 2, 1, 1, 0, 0],
]

/**
 * Multiplicateurs PAR LIGNE — pas de multiplication par combinaisons ici, donc des
 * valeurs bien plus hautes que sur la machine ways. Même curseur SCALE.
 */
const SCALE = 4.79

const shape: Record<string, Record<number, number>> = {
  ten:     { 3: 0.20, 4: 0.8,  5: 3,  6: 10 },
  jack:    { 3: 0.20, 4: 0.8,  5: 3,  6: 10 },
  queen:   { 3: 0.25, 4: 1.0,  5: 4,  6: 14 },
  king:    { 3: 0.25, 4: 1.0,  5: 4,  6: 14 },
  ace:     { 3: 0.30, 4: 1.2,  5: 5,  6: 18 },
  lemon:   { 3: 0.40, 4: 1.5,  5: 6,  6: 20 },
  grape:   { 3: 0.50, 4: 2.0,  5: 8,  6: 26 },
  bell:    { 3: 0.60, 4: 2.5,  5: 10, 6: 35 },
  diamond: { 3: 0.80, 4: 3.5,  5: 14, 6: 50 },
  star:    { 3: 1.20, 4: 5.0,  5: 20, 6: 75 },
  dog:     { 3: 2.50, 4: 10.0, 5: 40, 6: 150 },
}

const paytable: Paytable = Object.fromEntries(
  Object.entries(shape).map(([id, rows]) => [
    id,
    Object.fromEntries(Object.entries(rows).map(([n, v]) => [n, v * SCALE])),
  ])
)

export const rigide: MachineConfig = {
  id: 'rigide',
  name: 'La Machine Figée',
  reelCount: 6,
  rows: { kind: 'fixed', count: 5 },
  evaluator: 'lines',
  paylines: PAYLINES,
  symbolPool: [
    'ten', 'jack', 'queen', 'king', 'ace',
    'lemon', 'grape', 'bell', 'diamond',
    'star', 'dog', 'wild', 'scatter',
  ],
  paytable,
  minMatch: 3,
  scatterMin: 3,
  rtpTarget: 0.92,
}
