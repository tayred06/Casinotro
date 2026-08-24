import type { MachineConfig, Paytable } from '../../types/index.ts'

/**
 * Multiplicateurs PAR COMBINAISON. Un gain "ways" est payé autant de fois qu'il existe
 * de chemins distincts, d'où des valeurs unitaires faibles : 5 pique sur 3 rouleaux
 * peut représenter 30 combinaisons.
 *
 * SCALE est le seul curseur d'équilibrage — il déplace le RTP sans toucher à la forme
 * de la table. Voir `SlotMachine.rtp.test.ts` pour la mesure.
 */
const SCALE = 0.664

const shape: Record<string, Record<number, number>> = {
  ten:     { 3: 0.04, 4: 0.12, 5: 0.40, 6: 1.5 },
  jack:    { 3: 0.04, 4: 0.12, 5: 0.40, 6: 1.5 },
  queen:   { 3: 0.05, 4: 0.15, 5: 0.50, 6: 2.0 },
  king:    { 3: 0.05, 4: 0.15, 5: 0.50, 6: 2.0 },
  ace:     { 3: 0.06, 4: 0.18, 5: 0.60, 6: 2.5 },
  lemon:   { 3: 0.08, 4: 0.25, 5: 0.80, 6: 3.0 },
  grape:   { 3: 0.10, 4: 0.30, 5: 1.00, 6: 4.0 },
  bell:    { 3: 0.12, 4: 0.40, 5: 1.20, 6: 5.0 },
  diamond: { 3: 0.16, 4: 0.55, 5: 1.80, 6: 7.0 },
  star:    { 3: 0.25, 4: 0.80, 5: 2.50, 6: 10.0 },
  dog:     { 3: 0.50, 4: 1.60, 5: 5.00, 6: 20.0 },
}

const paytable: Paytable = Object.fromEntries(
  Object.entries(shape).map(([id, rows]) => [
    id,
    Object.fromEntries(Object.entries(rows).map(([n, v]) => [n, v * SCALE])),
  ])
)

export const megaways: MachineConfig = {
  id: 'megaways',
  name: 'La Machine Ordinaire',
  reelCount: 6,
  rows: { kind: 'variable', min: 2, max: 7 },
  evaluator: 'ways',
  symbolPool: [
    'ten', 'jack', 'queen', 'king', 'ace',
    'lemon', 'grape', 'bell', 'diamond',
    'star', 'dog', 'wild', 'scatter',
  ],
  paytable,
  minMatch: 3,
  scatterMin: 3,
  rtpTarget: 0.92,
  // Megaways est mis de côté : toutes les machines jouables tournent sur l'évaluateur
  // `lines`. La config reste validée par machines.test.ts pour ne pas pourrir en silence.
  playable: false,
}
