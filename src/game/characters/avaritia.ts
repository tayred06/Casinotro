import type { CharacterPlugin, GameContext, SpinResult, DialogueLine, ItemDef } from '../../types/index.ts'

const PARAMS = {
  winMultiplier: 2,
  shopGates: [
    { progress: 0.0, maxTier: 0, priceMultiplier: null },
    { progress: 0.25, maxTier: 1, priceMultiplier: 2 },
    { progress: 0.5, maxTier: 2, priceMultiplier: 1.5 },
    { progress: 0.75, maxTier: 3, priceMultiplier: 1 },
  ],
  goal: 10000,
}

export const avaritiaPlugin: CharacterPlugin = {
  id: 'avaritia',

  onAfterSpin(ctx: GameContext, result: SpinResult): void {
    if (result.totalWin > 0) {
      const bonus = result.totalWin * (PARAMS.winMultiplier - 1)
      ctx.economy.addWin(bonus)
      result.totalWin *= PARAMS.winMultiplier
      result.winLines = result.winLines.map(l => ({ ...l, win: l.win * PARAMS.winMultiplier }))
    }
  },

  offerModifier(offer: ItemDef): ItemDef | null {
    return offer
  },

  onDialogueTrigger(_ctx: GameContext): DialogueLine[] {
    return [
      { speaker: 'Le Croupier', text: "Vous ne dépensez rien, madame. Comment comptez-vous acheter le ticket ?" },
      { speaker: 'Avaritia', text: "En attendant. L'attente est gratuite et elle rapporte sept pour cent." },
    ]
  },
}
