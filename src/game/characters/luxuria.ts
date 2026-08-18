import type { CharacterPlugin, GameContext, SpinOptions, DialogueLine } from '../../types/index.ts'

const PARAMS = {
  rareSymbolWeightMultiplier: 2.5,
  upkeepPercent: 0.05,
  upkeepLabel: 'Entretien',
}

export const luxuriaPlugin: CharacterPlugin = {
  id: 'luxuria',

  getSpinOptions(_ctx: GameContext): SpinOptions {
    return { rareMultiplier: PARAMS.rareSymbolWeightMultiplier }
  },

  onBeforeSpin(ctx: GameContext): void {
    const upkeep = Math.round(ctx.economy.balance * PARAMS.upkeepPercent * 100) / 100
    if (upkeep > 0 && ctx.economy.spend(upkeep)) {
      ctx.addLog(`${PARAMS.upkeepLabel} — -${upkeep.toFixed(2)}⛧`, true)
    }
  },

  onDialogueTrigger(_ctx: GameContext): DialogueLine[] {
    return [
      { speaker: 'Le Croupier', text: "Vous saignez sur le feutre, madame. Ce n'est pas grave : il est déjà rouge." },
      { speaker: 'Luxuria', text: "Je n'ai jamais gardé un sou. Ni un amant. Ici on appelle ça un supplice ; moi j'appelle ça une carrière." },
    ]
  },
}
