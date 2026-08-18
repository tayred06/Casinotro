import type { CharacterPlugin, DialogueLine, GameContext } from '../../types/index.ts'
export const joueurPlugin: CharacterPlugin = {
  id: 'joueur',
  onDialogueTrigger(_ctx: GameContext): DialogueLine[] {
    return [
      { speaker: 'Le Croupier', text: "Vous n'êtes pas un péché, vous êtes un client. Nous vous aimons beaucoup." },
      { speaker: 'Vous', text: "Encore un tour et j'arrête." },
    ]
  },
}
