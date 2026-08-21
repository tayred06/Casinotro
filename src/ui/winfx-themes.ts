import type { WinTierId } from '../game/WinTier.ts'

/**
 * Thèmes d'effets de gain. Le palier (WinTier) décide de l'intensité — combien
 * de particules, quelle secousse, combien de temps —, le thème décide de quoi
 * ça a l'air : forme des particules, palette, présence des rayons/sigil.
 *
 * Ajouter un thème = une entrée ici + un bloc `[data-fx-theme='…']` dans
 * `src/styles/_winfx-themes.scss`.
 */

export type WinFXThemeId = 'occulte' | 'neon' | 'glitch' | 'sobre'

/** Forme des particules projetées à l'apparition de la bannière. */
export type ParticleKind = 'ember' | 'coin' | 'shard' | 'none'

export interface WinFXTheme {
  id: WinFXThemeId
  label: string
  description: string
  particle: ParticleKind
  /** Caractère affiché dans la particule (`coin` et `shard` uniquement). */
  particleGlyph?: string
  /** Multiplie le nombre de particules du palier. */
  particleScale: number
  /** Pluie de symboles en fond sur les hauts paliers. `null` = pas de pluie. */
  rainGlyph: string | null
  /** Rayons tournants derrière la bannière. */
  rays: boolean
  /** Anneau qui se dilate au centre. */
  sigil: boolean
  /** Multiplie l'amplitude de la secousse (0 = aucune). */
  shake: number
  /** Multiplie l'opacité du flash (0 = aucun). */
  flash: number
  /** Couleur dominante par palier. */
  colors: Record<WinTierId, string>
}

export const WINFX_THEMES: Readonly<Record<WinFXThemeId, WinFXTheme>> = Object.freeze({
  occulte: {
    id: 'occulte',
    label: 'Occulte',
    description: 'Braises, sigil, rayons — l’écran saigne aux hauts paliers.',
    particle: 'ember',
    particleScale: 1,
    rainGlyph: '⛧',
    rays: true,
    sigil: true,
    shake: 1,
    flash: 1,
    colors: {
      none: '#b6f36a', nice: '#d9f36a', big: '#f2c14b',
      mega: '#ff8a3c', epic: '#ff5a2d', legendary: '#ff2d55',
    },
  },

  neon: {
    id: 'neon',
    label: 'Néon',
    description: 'Jetons qui pleuvent, halo de tube néon, palette arcade.',
    particle: 'coin',
    particleGlyph: '⛧',
    particleScale: .8,
    rainGlyph: '⛧',
    rays: true,
    sigil: true,
    shake: .55,
    flash: 1.15,
    colors: {
      none: '#7ef0ff', nice: '#7ef0ff', big: '#ffd76a',
      mega: '#ff9ae6', epic: '#b06bff', legendary: '#fff45a',
    },
  },

  glitch: {
    id: 'glitch',
    label: 'Glitch',
    description: 'La machine déraille : blocs, scanlines, décalage RVB.',
    particle: 'shard',
    particleScale: .9,
    rainGlyph: '█',
    rays: false,
    sigil: false,
    shake: 1.2,
    flash: .7,
    colors: {
      none: '#35ffd0', nice: '#35ffd0', big: '#35ffd0',
      mega: '#ff3ea5', epic: '#ff3ea5', legendary: '#ffffff',
    },
  },

  sobre: {
    id: 'sobre',
    label: 'Sobre',
    description: 'Aucune particule : couleur, échelle, liseré. Ne coupe pas le rythme.',
    particle: 'none',
    particleScale: 0,
    rainGlyph: null,
    rays: false,
    sigil: false,
    shake: .35,
    flash: .3,
    colors: {
      none: '#b6f36a', nice: '#b6f36a', big: '#cfe6a0',
      mega: '#e6d98a', epic: '#f0b070', legendary: '#ff6f8a',
    },
  },
})

/** Thème utilisé tant que le joueur n'en a pas choisi un autre dans /fx.html. */
export const DEFAULT_THEME: WinFXThemeId = 'neon'

const STORAGE_KEY = 'casinotro_winfx_theme'

/** Thème choisi par le joueur (labo `/fx.html`), sinon le défaut. */
export function loadThemeId(): WinFXThemeId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw && raw in WINFX_THEMES) return raw as WinFXThemeId
  } catch { /* localStorage indisponible : on retombe sur le défaut */ }
  return DEFAULT_THEME
}

export function saveThemeId(id: WinFXThemeId): void {
  try { localStorage.setItem(STORAGE_KEY, id) } catch { /* ignoré */ }
}
