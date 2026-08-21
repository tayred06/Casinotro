/**
 * Paliers de gain — logique pure, aucun DOM.
 *
 * Le palier est décidé par le ratio gain / mise, la mesure standard des machines
 * réelles : elle reste valable à toutes les étapes du run, alors que les seuils
 * absolus se périment dès que `betOptions` est mis à l'échelle (voir RunState).
 */

export type WinTierId = 'none' | 'nice' | 'big' | 'mega' | 'epic' | 'legendary'

export interface WinTierDef {
  id: WinTierId
  /** Ratio gain/mise minimum pour atteindre ce palier. */
  minRatio: number
  /** Libellé affiché dans la bannière. */
  label: string
}

/** Ordonné du plus haut au plus bas — `getWinTier` prend le premier qui passe. */
export const WIN_TIERS: readonly WinTierDef[] = Object.freeze([
  { id: 'legendary', minRatio: 300, label: 'GAIN LÉGENDAIRE' },
  { id: 'epic',      minRatio: 100, label: 'GAIN ÉPIQUE'     },
  { id: 'mega',      minRatio: 40,  label: 'MÉGA GAIN'       },
  { id: 'big',       minRatio: 15,  label: 'GROS GAIN'       },
  { id: 'nice',      minRatio: 5,   label: 'BEAU GAIN'       },
  { id: 'none',      minRatio: 0,   label: 'GAIN'            },
] as const)

const BY_ID = new Map(WIN_TIERS.map(t => [t.id, t]))

/** Rang numérique du palier (0 = none … 5 = legendary), pratique pour comparer. */
export function tierRank(id: WinTierId): number {
  return WIN_TIERS.length - 1 - WIN_TIERS.findIndex(t => t.id === id)
}

export function getTierDef(id: WinTierId): WinTierDef {
  return BY_ID.get(id)!
}

/**
 * Palier d'un gain. Une mise nulle ou négative (spin gratuit sans mise de
 * référence) retombe sur `none` plutôt que de diviser par zéro.
 */
export function getWinTier(win: number, bet: number): WinTierId {
  if (!(win > 0) || !(bet > 0)) return 'none'
  const ratio = win / bet
  for (const tier of WIN_TIERS) {
    if (ratio >= tier.minRatio) return tier.id
  }
  return 'none'
}
