import type { CharacterPlugin, DialogueLine, GameContext } from '../../types/index.ts'
export const acediaPlugin: CharacterPlugin = {
  id: 'acedia',
  onDialogueTrigger(_ctx: GameContext): DialogueLine[] {
    return [{ speaker: 'Le Croupier', text: "Monsieur, vous avez oublié d'appuyer sur le bouton." }]
  },
}
