import type { CharacterPlugin, DialogueLine, GameContext } from '../../types/index.ts'
export const superbiaPlugin: CharacterPlugin = {
  id: 'superbia',
  onDialogueTrigger(_ctx: GameContext): DialogueLine[] {
    return [{ speaker: 'Le Croupier', text: "Madame, ici personne ne vous reconnaît." }]
  },
}
