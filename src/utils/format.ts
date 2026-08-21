import type { Souls } from '../types/index.ts'

/**
 * Suffixes courts par tranche de 1000. Au-delà de 10^18 on bascule en notation
 * scientifique : aucun suffixe n'est lisible à ce niveau et le mode infini y arrive.
 */
const UNITS = ['', 'K', 'M', 'Md', 'B', 'Bd', 'T'] as const
const COMPACT_FROM = 100_000

const GROUPED = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 })

/**
 * Affichage d'un montant d'âmes. En dessous de 100 000 : chiffres exacts, séparateurs de
 * milliers, 2 décimales au plus. Au-dessus : 3 chiffres significatifs + suffixe (12,4 M),
 * sinon un gain de 10^13 devient une bouillie de zéros illisible.
 */
export function formatSouls(value: Souls): string {
  if (!isFinite(value)) return '∞'
  const sign = value < 0 ? '-' : ''
  const n = Math.abs(value)

  if (n < COMPACT_FROM) return sign + GROUPED.format(round2(n))

  const tier = Math.min(UNITS.length - 1, Math.floor(Math.log10(n) / 3))
  const scaled = n / 1000 ** tier
  if (tier === UNITS.length - 1 && scaled >= 1000) {
    return sign + n.toExponential(2).replace('.', ',').replace('e+', '×10^')
  }
  const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2
  return sign + scaled.toFixed(digits).replace('.', ',') + ' ' + UNITS[tier]
}

/** Même échelle, préfixée du symbole d'âme. */
export function souls(value: Souls): string {
  return `⛧${formatSouls(value)}`
}

/** Gain : toujours signé, pour les logs et les compteurs de gain. */
export function soulsGain(value: Souls): string {
  return `${value < 0 ? '-' : '+'}⛧${formatSouls(Math.abs(value))}`
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}
