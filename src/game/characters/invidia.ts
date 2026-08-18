import type { CharacterPlugin, DialogueLine, GameContext } from '../../types/index.ts'
export const invidiaPlugin: CharacterPlugin = {
  id: 'invidia',
  onDialogueTrigger(_ctx: GameContext): DialogueLine[] {
    return [{ speaker: 'Le Croupier', text: "Vous regardez la table des autres depuis une heure, madame." }]
  },
}
