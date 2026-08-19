import type { Souls } from '../types/index.ts'
import { STARTING_CHARACTER_ID } from '../game/Characters.ts'

const KEY = 'casinotro_meta_v2'

export class Progression {
  highscore: Souls = 0
  unlockedMachines: Set<string> = new Set(['megaways'])
  /** Personnages débloqués. Seul le premier l'est à la première partie. */
  unlockedCharacters: Set<string> = new Set([STARTING_CHARACTER_ID])

  constructor() { this.load() }

  updateHighscore(value: Souls): void {
    if (value > this.highscore) {
      this.highscore = value
      this.save()
    }
  }

  /** Débloque un personnage. Retourne true s'il ne l'était pas déjà. */
  unlockCharacter(id: string): boolean {
    if (this.unlockedCharacters.has(id)) return false
    this.unlockedCharacters.add(id)
    this.save()
    return true
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
        unlockedCharacters: [...this.unlockedCharacters],
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
      this.unlockedCharacters = new Set(data.unlockedCharacters ?? [STARTING_CHARACTER_ID])
    } catch {}
  }
}
