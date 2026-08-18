import type { MachineConfig } from '../../types/index.ts'
import { megaways } from './megaways.ts'

export const MACHINES: Record<string, MachineConfig> = {
  megaways,
}

export function getMachine(id: string): MachineConfig {
  const m = MACHINES[id]
  if (!m) throw new Error(`Machine inconnue : ${id}`)
  return m
}
