import type { Character } from './Characters.ts'

export class CharacterState {
  #char: Character

  constructor(character: Character) {
    this.#char = character
  }

  get id(): string        { return this.#char.id }
  get name(): string      { return this.#char.name }
  get emoji(): string     { return this.#char.emoji }
  get sin(): string       { return this.#char.sin }
  get color(): string | null  { return this.#char.color ?? null }
  get goal(): number | null   { return this.#char.goal ?? null }
  get effectKey(): string | null    { return this.#char.effect?.key ?? null }
  get params(): Record<string, any> { return this.#char.effect?.params ?? {} }
  get description(): string         { return this.#char.description ?? '' }

  getStartBalance(): number | null {
    const e = this.#char.effect
    if (e?.type === 'start_balance') return e.value
    return null
  }

  getLuckBonus(): number {
    const e = this.#char.effect
    if (e?.type === 'luck_bonus') return e.value
    return 0
  }
}
