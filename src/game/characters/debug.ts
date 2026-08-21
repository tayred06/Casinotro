import type { CharacterPlugin, DebugState, GameContext, SpinResult } from '../../types/index.ts'

export const DEFAULT_DEBUG_STATE: DebugState = {
  godMode: true,
  winMultiplier: 1,
  rarityOverride: null,
  cohesionOverride: null,
}

/**
 * Personnage bac à sable : aucune mécanique de jeu, uniquement des leviers de test.
 * Tout le reste (solde imposé, items illimités, saut de palier) passe par le
 * panneau de debug, qui écrit dans `debugState`.
 */
export function createDebugPlugin(): CharacterPlugin {
  const state: DebugState = { ...DEFAULT_DEBUG_STATE }

  return {
    id: 'debug',
    debugState: state,

    onSetup(ctx: GameContext): void {
      ctx.addLog('🛠 Mode test — panneau de debug en bas à droite (F9).')
    },

    onAfterSpin(_ctx: GameContext, result: SpinResult): void {
      if (state.winMultiplier !== 1) result.totalWin *= state.winMultiplier
    },

    // Le bac à sable ne meurt jamais tant que le mode dieu est actif.
    onLossCheck(_ctx: GameContext): boolean {
      return false
    },

    serialize(): any { return { ...state } },

    restore(data: any): void {
      if (!data) return
      Object.assign(state, DEFAULT_DEBUG_STATE, data)
    },
  }
}
