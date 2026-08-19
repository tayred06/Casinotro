import type { Souls } from '../types/index.ts'

const KEY = 'casinotro_meta_v2'
/** Ancienne clé, écrite par Economy avant que Progression devienne propriétaire. */
const LEGACY_HIGHSCORE_KEY = 'casinotro_highscore'

export class Progression {
  highscore: Souls = 0
  unlockedMachines: Set<string> = new Set(['megaways'])

  constructor() { this.load() }

  updateHighscore(value: Souls): void {
    if (value > this.highscore) {
      this.highscore = value
      this.save()
    }
  }

  unlockMachine(id: string): void {
    this.unlockedMachines.add(id)
    this.save()
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        highscore: this.highscore,
        unlockedMachines: [...this.unlockedMachines],
      }))
    } catch {}
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) {
        const data = JSON.parse(raw)
        this.highscore = data.highscore ?? 0
        this.unlockedMachines = new Set(data.unlockedMachines ?? ['megaways'])
      }
      this.#absorbLegacyHighscore()
    } catch {}
  }

  /** Récupère le record écrit sous l'ancienne clé, puis la retire. */
  #absorbLegacyHighscore(): void {
    try {
      const legacy = Number(localStorage.getItem(LEGACY_HIGHSCORE_KEY))
      if (!legacy) return
      if (legacy > this.highscore) {
        this.highscore = legacy
        this.save()
      }
      localStorage.removeItem(LEGACY_HIGHSCORE_KEY)
    } catch {}
  }
}
