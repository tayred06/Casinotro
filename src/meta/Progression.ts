import type { Souls } from '../types/index.ts'

const KEY = 'casinotro_meta_v2'

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
      if (!raw) return
      const data = JSON.parse(raw)
      this.highscore = data.highscore ?? 0
      this.unlockedMachines = new Set(data.unlockedMachines ?? ['megaways'])
    } catch {}
  }
}
