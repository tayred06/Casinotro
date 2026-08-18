import type { CharacterPlugin, DialogueLine, GameContext } from '../../types/index.ts'
export const iraPlugin: CharacterPlugin = {
  id: 'ira',
  onDialogueTrigger(_ctx: GameContext): DialogueLine[] {
    return [{ speaker: 'Le Croupier', text: 'Monsieur, la machine ne vous a rien fait.' }]
  },
}
