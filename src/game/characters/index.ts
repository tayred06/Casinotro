import type { CharacterPlugin } from '../../types/index.ts'
import { luxuriaPlugin } from './luxuria.ts'
import { createGulaPlugin } from './gula.ts'
import { createAvaritiaPlugin } from './avaritia.ts'
import { createIraPlugin } from './ira.ts'
import { invidiaPlugin } from './invidia.ts'
import { acediaPlugin } from './acedia.ts'
import { superbiaPlugin } from './superbia.ts'
import { joueurPlugin } from './joueur.ts'
import { createDebugPlugin } from './debug.ts'

const STATELESS: Record<string, CharacterPlugin> = {
  luxuria: luxuriaPlugin,
  invidia: invidiaPlugin,
  acedia: acediaPlugin,
  superbia: superbiaPlugin,
  character_8: joueurPlugin,
}

const FACTORIES: Record<string, () => CharacterPlugin> = {
  gula: createGulaPlugin,
  avaritia: createAvaritiaPlugin,
  ira: createIraPlugin,
  debug: createDebugPlugin,
}

export function getCharacterPlugin(id: string): CharacterPlugin {
  if (FACTORIES[id]) return FACTORIES[id]()
  const plugin = STATELESS[id]
  if (!plugin) throw new Error(`Personnage inconnu : ${id}`)
  return plugin
}

export const CHARACTER_IDS = [
  'luxuria', 'gula', 'avaritia', 'ira', 'invidia', 'acedia', 'superbia', 'character_8', 'debug'
]
