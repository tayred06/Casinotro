import type { ItemDef } from '../../types/index.ts'

export const ITEM_POOL: ItemDef[] = [
  // ── Niveau 1 ─────────────────────────────────────────
  {
    id: 'golden_column', name: 'Colonne Dorée', kind: 'bonus',
    description: 'Un rouleau choisi vaut ×2', level: 1, price: 20,
    effect: 'column_multiplier', needsTarget: 'column',
  },
  {
    id: 'safety_net', name: 'Filet de Sécurité', kind: 'bonus',
    description: 'Spin sans gain → récupère 50% de la mise', level: 1, price: 15,
    effect: 'safety_net', needsTarget: null,
  },
  {
    id: 'free_reroll', name: 'Reroll Gratuit', kind: 'consumable',
    description: '1 reroll de boutique gratuit', level: 1, price: 10,
    effect: 'free_reroll', needsTarget: null, charges: 1,
  },
  {
    id: 'symbol_multiplier', name: 'Symbole Béni', kind: 'bonus',
    description: 'Un symbole choisi rapporte ×2', level: 1, price: 25,
    effect: 'symbol_multiplier', needsTarget: 'symbol',
  },
  {
    id: 'luck_boost', name: 'Porte-Bonheur', kind: 'bonus',
    description: '+10 régularité et +10 convoitise', level: 1, price: 30,
    effect: 'luck_boost', needsTarget: null,
  },
  {
    id: 'regularity', name: 'Métronome', kind: 'bonus',
    description: '+20 régularité — tu gagnes plus souvent, pas plus gros', level: 1, price: 30,
    effect: 'regularity', needsTarget: null,
  },
  // ── Niveau 2 ─────────────────────────────────────────
  {
    id: 'wild_column', name: 'Colonne Wild', kind: 'bonus',
    description: 'Un rouleau entier devient Wild (permanent)', level: 2, price: 50,
    effect: 'wild_column', needsTarget: 'column',
  },
  {
    id: 'chain', name: 'Chaîne', kind: 'bonus',
    description: 'Un symbole qui gagne 3 spins consécutifs gagne +50% permanent', level: 2, price: 40,
    effect: 'chain', needsTarget: 'symbol',
  },
  {
    id: 'sticky', name: 'Symbole Collant', kind: 'bonus',
    description: 'Les symboles gagnants restent en place 1 spin', level: 2, price: 45,
    effect: 'sticky', needsTarget: null,
  },
  {
    id: 'greed_eye', name: 'Œil du Cupide', kind: 'bonus',
    description: '+25 convoitise — les hauts-payants sortent plus souvent', level: 2, price: 55,
    effect: 'greed_eye', needsTarget: null,
  },
  {
    id: 'lucky_streak', name: 'Coup de Chance', kind: 'consumable',
    description: '+30 convoitise pendant 10 spins', level: 2, price: 45,
    effect: 'lucky_streak', needsTarget: null, charges: 10,
  },
  // ── Niveau 3 ─────────────────────────────────────────
  {
    id: 'jackpot_boost', name: 'Jackpot Amplifié', kind: 'bonus',
    description: 'Les combinaisons pleines (6 rouleaux) paient ×2,5', level: 3, price: 80,
    effect: 'jackpot_boost', needsTarget: null,
  },
  {
    id: 'global_multiplier', name: 'Ligne Magique', kind: 'consumable',
    description: '×3 sur tous les gains pendant 5 spins', level: 3, price: 100,
    effect: 'global_multiplier', needsTarget: null, charges: 5,
  },
]

export function getItemsByLevel(maxLevel: 1 | 2 | 3): ItemDef[] {
  return ITEM_POOL.filter(i => i.level <= maxLevel)
}
