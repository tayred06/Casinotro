import type { CharacterPlugin, GameContext, SpinResult, DialogueLine, ItemDef } from '../../types/index.ts'
import type { Economy } from '../Economy.ts'

/** Source unique des réglages d'Avaritia — référencée par CHARACTERS. */
export const AVARITIA_PARAMS = {
  winMultiplier: 2,
  weakLineThreshold: 2,      // count <= this = médiocre
  shopGates: [
    { minEarned: 0,    maxTier: 0, priceMultiplier: null },
    { minEarned: 500,  maxTier: 1, priceMultiplier: 2 },
    { minEarned: 2000, maxTier: 2, priceMultiplier: 1.5 },
    { minEarned: 6000, maxTier: 3, priceMultiplier: 1 },
  ],
}

export function createAvaritiaPlugin(): CharacterPlugin {
  let economy: Economy | null = null

  function currentGate() {
    const earned = economy?.totalEarned ?? 0
    let gate = AVARITIA_PARAMS.shopGates[0]
    for (const g of AVARITIA_PARAMS.shopGates) {
      if (earned >= g.minEarned) gate = g
    }
    return gate
  }

  return {
    id: 'avaritia',

    onSetup(ctx: GameContext): void {
      economy = ctx.economy
    },

    onTeardown(_ctx: GameContext): void {
      economy = null
    },

    onAfterSpin(ctx: GameContext, result: SpinResult): void {
      const strong = result.winLines.filter(l => l.count > AVARITIA_PARAMS.weakLineThreshold)
      const weak   = result.winLines.filter(l => l.count <= AVARITIA_PARAMS.weakLineThreshold)

      for (const line of weak) {
        ctx.economy.spend(line.win)
        ctx.addLog(`Combinaison médiocre — -${line.win.toFixed(2)}⛧`, true)
      }

      const strongTotal = strong.reduce((s, l) => s + l.win, 0)
      if (strongTotal > 0) {
        const amplified = strongTotal * AVARITIA_PARAMS.winMultiplier
        result.totalWin = amplified
        result.winLines = strong.map(l => ({ ...l, win: l.win * AVARITIA_PARAMS.winMultiplier }))
      } else {
        result.totalWin = 0
        result.winLines = []
      }
    },

    offerModifier(offer: ItemDef): ItemDef | null {
      const gate = currentGate()
      if (gate.maxTier === 0) return null
      if (offer.level > gate.maxTier) return null
      if (gate.priceMultiplier && gate.priceMultiplier > 1) {
        return { ...offer, price: Math.round(offer.price * gate.priceMultiplier) }
      }
      return offer
    },

    onDialogueTrigger(_ctx: GameContext): DialogueLine[] {
      return [
        { speaker: 'Le Croupier', text: "Vous ne dépensez rien, madame. Comment comptez-vous acheter le ticket ?" },
        { speaker: 'Avaritia', text: "En attendant. L'attente est gratuite et elle rapporte sept pour cent." },
      ]
    },
  }
}
