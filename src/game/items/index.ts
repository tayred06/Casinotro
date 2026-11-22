import type { ItemDef, ItemRarity, ItemTier, Souls } from '../../types/index.ts'

/** Ordre des paliers. Une fusion fait monter d'un cran. */
export const RARITY_ORDER: ItemRarity[] = ['commun', 'rare', 'epique']

/**
 * Ratios de prix. En dessous de 2,2×, acheter un rare devient meilleur que fusionner
 * deux communs et la fusion meurt — c'est le garde-fou économique du système.
 */
export const RARE_PRICE_RATIO = 2.2
export const EPIQUE_PRICE_RATIO = 4.5

export const RARITY_LABEL: Record<ItemRarity, string> = {
  commun: 'COMMUN',
  rare: 'RARE',
  epique: 'ÉPIQUE',
}

export function nextRarity(rarity: ItemRarity): ItemRarity | null {
  const i = RARITY_ORDER.indexOf(rarity)
  return i >= 0 && i < RARITY_ORDER.length - 1 ? RARITY_ORDER[i + 1] : null
}

interface TierSpec {
  description: string
  params?: Record<string, number>
  charges?: number
}

/** Construit les trois paliers d'un item à partir du prix commun et des ratios. */
function tiers(base: Souls, spec: Record<ItemRarity, TierSpec>): Record<ItemRarity, ItemTier> {
  const price: Record<ItemRarity, Souls> = {
    commun: base,
    rare: Math.round(base * RARE_PRICE_RATIO),
    epique: Math.round(base * EPIQUE_PRICE_RATIO),
  }
  return Object.fromEntries(
    RARITY_ORDER.map(r => [r, {
      price: price[r],
      description: spec[r].description,
      params: spec[r].params ?? {},
      ...(spec[r].charges !== undefined ? { charges: spec[r].charges } : {}),
    }])
  ) as Record<ItemRarity, ItemTier>
}

export const ITEM_POOL: ItemDef[] = [
  // ── Niveau 1 ─────────────────────────────────────────
  {
    id: 'golden_column', name: 'Colonne Dorée', kind: 'bonus',
    level: 1, effect: 'column_multiplier', needsTarget: 'column',
    tiers: tiers(20, {
      commun: { description: 'Un rouleau choisi vaut ×2', params: { mult: 2 } },
      rare:   { description: 'Un rouleau choisi vaut ×2,8', params: { mult: 2.8 } },
      epique: {
        description: 'Un rouleau choisi vaut ×4, son voisin ×1,5',
        params: { mult: 4, adjacentMult: 1.5 },
      },
    }),
  },
  {
    id: 'safety_net', name: 'Filet de Sécurité', kind: 'bonus',
    level: 1, effect: 'safety_net', needsTarget: null,
    tiers: tiers(15, {
      commun: { description: 'Spin sans gain → récupère 15% de la mise', params: { rate: 0.15 } },
      rare:   { description: 'Spin sans gain → récupère 20% de la mise', params: { rate: 0.20 } },
      epique: {
        description: 'Spin sans gain → récupère 25% de la mise, et la chaîne ne se casse pas',
        params: { rate: 0.25, keepChain: 1 },
      },
    }),
  },
  {
    id: 'free_reroll', name: 'Reroll Gratuit', kind: 'consumable',
    level: 1, effect: 'free_reroll', needsTarget: null,
    tiers: tiers(10, {
      commun: { description: '1 reroll de boutique gratuit', charges: 1 },
      rare:   { description: '3 rerolls de boutique gratuits', charges: 3 },
      epique: {
        description: '7 rerolls gratuits — chaque reroll garantit une offre rare',
        charges: 7, params: { guaranteeRare: 1 },
      },
    }),
  },
  {
    id: 'symbol_multiplier', name: 'Symbole Béni', kind: 'bonus',
    level: 1, effect: 'symbol_multiplier', needsTarget: 'symbol',
    tiers: tiers(25, {
      commun: { description: 'Un symbole choisi rapporte ×2', params: { mult: 2 } },
      rare:   { description: 'Un symbole choisi rapporte ×2,8', params: { mult: 2.8 } },
      epique: {
        description: 'Un symbole choisi rapporte ×4 et sert d\'ancre de régularité',
        params: { mult: 4, anchorPriority: 1 },
      },
    }),
  },
  {
    id: 'luck_boost', name: 'Porte-Bonheur', kind: 'bonus',
    level: 1, effect: 'luck_boost', needsTarget: null,
    tiers: tiers(30, {
      commun: { description: '+10 régularité et +10 convoitise', params: { rarity: 10, cohesion: 10 } },
      rare:   { description: '+16 régularité et +16 convoitise', params: { rarity: 16, cohesion: 16 } },
      epique: {
        description: '+25 des deux, +10 régularité cumulée par spin perdant (remise à zéro au gain)',
        params: { rarity: 25, cohesion: 25, pityCohesion: 10 },
      },
    }),
  },
  {
    id: 'regularity', name: 'Métronome', kind: 'bonus',
    level: 1, effect: 'regularity', needsTarget: null,
    tiers: tiers(30, {
      commun: { description: '+20 régularité — tu gagnes plus souvent, pas plus gros', params: { cohesion: 20 } },
      rare:   { description: '+32 régularité', params: { cohesion: 32 } },
      epique: {
        description: '+50 régularité — la machine garde la même ancre 3 spins',
        params: { cohesion: 50, anchorHold: 3 },
      },
    }),
  },
  // ── Niveau 2 ─────────────────────────────────────────
  {
    id: 'wild_column', name: 'Colonne Wild', kind: 'bonus',
    level: 2, effect: 'wild_column', needsTarget: 'column',
    // Une seule par run : deux colonnes wild consécutives font gagner toutes les
    // lignes à chaque spin (invariant wild, cf. plan §2.1).
    maxOwned: 1,
    tiers: tiers(50, {
      commun: { description: 'Un rouleau choisi devient Wild sur 8% des spins', params: { chance: 0.08, mult: 1 } },
      rare:   { description: 'Un rouleau choisi devient Wild sur 11% des spins', params: { chance: 0.11, mult: 1 } },
      epique: {
        description: 'Un rouleau choisi devient Wild sur 15% des spins, et ces combinaisons paient ×1,5',
        params: { chance: 0.15, mult: 1.5 },
      },
    }),
  },
  {
    id: 'chain', name: 'Chaîne', kind: 'bonus',
    level: 2, effect: 'chain', needsTarget: 'symbol',
    tiers: tiers(40, {
      commun: {
        description: '3 spins gagnants d\'affilée → +50% permanent (plafond +200%)',
        params: { spins: 3, gain: 1.5, cap: 3 },
      },
      rare: {
        description: '3 spins gagnants d\'affilée → +80% permanent (plafond +250%)',
        params: { spins: 3, gain: 1.8, cap: 3.5 },
      },
      epique: {
        description: '2 spins gagnants d\'affilée → +100% permanent (plafond +300%)',
        params: { spins: 2, gain: 2, cap: 4 },
      },
    }),
  },
  {
    id: 'sticky', name: 'Symbole Collant', kind: 'bonus',
    level: 2, effect: 'sticky', needsTarget: null,
    tiers: tiers(45, {
      commun: { description: '35% de chance qu\'un symbole gagnant reste en place 1 spin', params: { chance: 0.35, duration: 1 } },
      rare:   { description: '50% de chance qu\'un symbole gagnant reste en place 1 spin', params: { chance: 0.50, duration: 1 } },
      epique: { description: '60% de chance qu\'un symbole gagnant reste en place 2 spins', params: { chance: 0.60, duration: 2 } },
    }),
  },
  {
    id: 'greed_eye', name: 'Œil du Cupide', kind: 'bonus',
    level: 2, effect: 'greed_eye', needsTarget: null,
    tiers: tiers(55, {
      commun: { description: '+25 convoitise — les hauts-payants sortent plus souvent', params: { rarity: 25 } },
      rare:   { description: '+40 convoitise', params: { rarity: 40 } },
      epique: { description: '+60 convoitise — le scatter profite aussi du biais', params: { rarity: 60, scatterBoost: 0.5 } },
    }),
  },
  {
    id: 'lucky_streak', name: 'Coup de Chance', kind: 'consumable',
    level: 2, effect: 'lucky_streak', needsTarget: null,
    tiers: tiers(45, {
      commun: { description: '+30 convoitise pendant 10 spins', params: { rarity: 30 }, charges: 10 },
      rare:   { description: '+30 convoitise pendant 20 spins', params: { rarity: 30 }, charges: 20 },
      epique: {
        description: '+30 convoitise pendant 40 spins — décompte en pause en free spins',
        params: { rarity: 30, pauseInFreeSpins: 1 }, charges: 40,
      },
    }),
  },
  // ── Niveau 3 ─────────────────────────────────────────
  {
    id: 'jackpot_boost', name: 'Jackpot Amplifié', kind: 'bonus',
    level: 3, effect: 'jackpot_boost', needsTarget: null,
    tiers: tiers(80, {
      commun: { description: 'Les combinaisons pleines paient ×2,5', params: { mult: 2.5 } },
      rare:   { description: 'Les combinaisons pleines paient ×3,5', params: { mult: 3.5 } },
      epique: { description: 'Les combinaisons pleines paient ×5 et offrent 1 free spin', params: { mult: 5, freeSpins: 1 } },
    }),
  },
  {
    id: 'global_multiplier', name: 'Ligne Magique', kind: 'consumable',
    level: 3, effect: 'global_multiplier', needsTarget: null,
    tiers: tiers(100, {
      commun: { description: '×3 sur tous les gains pendant 5 spins', params: { mult: 3 }, charges: 5 },
      rare:   { description: '×3 sur tous les gains pendant 10 spins', params: { mult: 3 }, charges: 10 },
      epique: {
        description: '×3 sur tous les gains pendant 20 spins — décompte en pause en free spins',
        params: { mult: 3, pauseInFreeSpins: 1 }, charges: 20,
      },
    }),
  },
]

export const getItem = (id: string): ItemDef | undefined => ITEM_POOL.find(i => i.id === id)

/** Définition garantie — lève si l'id est inconnu (sauvegarde corrompue). */
export function requireItem(id: string): ItemDef {
  const def = getItem(id)
  if (!def) throw new Error(`Item inconnu : ${id}`)
  return def
}

export const tierOf = (def: ItemDef, rarity: ItemRarity): ItemTier => def.tiers[rarity]

/** Paramètre numérique d'un palier, avec valeur par défaut. */
export function paramOf(def: ItemDef, rarity: ItemRarity, key: string, fallback = 0): number {
  return def.tiers[rarity].params[key] ?? fallback
}

export function getItemsByLevel(maxLevel: 1 | 2 | 3): ItemDef[] {
  return ITEM_POOL.filter(i => i.level <= maxLevel)
}
