import type { CharacterPlugin, GameContext, SpinResult, DialogueLine, ItemInstance } from '../../types/index.ts'
import { souls } from '../../utils/format.ts'
import { requireItem } from '../items/index.ts'

/** Source unique des réglages de Gula — référencée par CHARACTERS. */
export const GULA_PARAMS = {
  betEscalationPercent: 0.05,
  betEscalationFloor: 1,
}

export function createGulaPlugin(): CharacterPlugin {
  let gulaBet = GULA_PARAMS.betEscalationFloor

  function getIncrement(ctx: GameContext): number {
    return ctx.economy.balance < 100
      ? GULA_PARAMS.betEscalationFloor
      : Math.round(ctx.economy.balance * GULA_PARAMS.betEscalationPercent * 100) / 100
  }

  return {
    id: 'gula',

    onSetup(ctx: GameContext): void {
      gulaBet = GULA_PARAMS.betEscalationFloor
      ctx.economy.forceSetBet(gulaBet)
    },

    onTeardown(_ctx: GameContext): void {
      gulaBet = GULA_PARAMS.betEscalationFloor
    },

    onAfterSpin(ctx: GameContext, _result: SpinResult): void {
      const increment = getIncrement(ctx)
      gulaBet = Math.round((gulaBet + increment) * 100) / 100
      ctx.economy.forceSetBet(gulaBet)
    },

    getForcedBet(ctx: GameContext) {
      return { amount: gulaBet, nextIncrement: getIncrement(ctx) }
    },

    onShopSell(ctx: GameContext, item: ItemInstance): void {
      gulaBet = GULA_PARAMS.betEscalationFloor
      ctx.economy.forceSetBet(gulaBet)
      ctx.addLog(`Dévoré : ${requireItem(item.defId).name} — mise remise à ${souls(gulaBet)}`, true)
    },

    onLossCheck(ctx: GameContext): boolean {
      return ctx.economy.balance < gulaBet
    },

    serialize() {
      return { gulaBet }
    },

    restore(data: any) {
      if (typeof data?.gulaBet === 'number' && data.gulaBet > 0) gulaBet = data.gulaBet
    },

    onDialogueTrigger(_ctx: GameContext): DialogueLine[] {
      return [
        { speaker: 'Le Croupier', text: 'Monsieur, votre mise a encore doublé.' },
        { speaker: 'Gula', text: "Je sais. C'est le prix de l'appétit." },
      ]
    },
  }
}
