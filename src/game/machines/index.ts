import type { MachineConfig } from '../../types/index.ts'
import { megaways } from './megaways.ts'
import { rigide } from './rigide.ts'

export const MACHINES: Record<string, MachineConfig> = {
  megaways,
  rigide,
}

export const DEFAULT_MACHINE_ID = 'rigide'

/** Machines réellement jouables — `playable: false` sort du pool sans supprimer la config. */
export function playableMachines(): MachineConfig[] {
  return Object.values(MACHINES).filter(m => m.playable !== false)
}

export const isPlayable = (id: string): boolean => MACHINES[id]?.playable !== false

export function getMachine(id: string): MachineConfig {
  const m = MACHINES[id]
  if (!m) throw new Error(`Machine inconnue : ${id}`)
  return m
}
