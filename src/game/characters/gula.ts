import type { CharacterPlugin, GameContext, SpinResult, DialogueLine, ItemInstance } from '../../types/index.ts'

const PARAMS = {
  betEscalationPercent: 0.12,
  betEscalationFloor: 1,
}

export function createGulaPlugin(): CharacterPlugin {
  let gulaBet = PARAMS.betEscalationFloor

  function getIncrement(ctx: GameContext): number {
    return ctx.economy.balance < 100
      ? PARAMS.betEscalationFloor
      : Math.round(ctx.economy.balance * PARAMS.betEscalationPercent * 100) / 100
  }

  return {
    id: 'gula',

    onSetup(ctx: GameContext): void {
      gulaBet = PARAMS.betEscalationFloor
      ctx.economy.forceSetBet(gulaBet)
    },

    onTeardown(_ctx: GameContext): void {
      gulaBet = PARAMS.betEscalationFloor
    },

    onAfterSpin(ctx: GameContext, _result: SpinResult): void {
      const increment = getIncrement(ctx)
      gulaBet = Math.round((gulaBet + increment) * 100) / 100
      ctx.economy.forceSetBet(gulaBet)
    },

    onShopSell(ctx: GameContext, item: ItemInstance): void {
      gulaBet = PARAMS.betEscalationFloor
      ctx.economy.forceSetBet(gulaBet)
      ctx.addLog(`Dévoré : ${item.name} — mise remise à ${gulaBet}⛧`, true)
    },

    onLossCheck(ctx: GameContext): boolean {
      return ctx.economy.balance < gulaBet
    },

    onDialogueTrigger(_ctx: GameContext): DialogueLine[] {
      return [
        { speaker: 'Le Croupier', text: 'Monsieur, votre mise a encore doublé.' },
        { speaker: 'Gula', text: "Je sais. C'est le prix de l'appétit." },
      ]
    },
  }
}
