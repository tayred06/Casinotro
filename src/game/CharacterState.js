export class CharacterState {
  #char

  constructor(character) {
    this.#char = character
  }

  get id()        { return this.#char.id }
  get name()      { return this.#char.name }
  get emoji()     { return this.#char.emoji }
  get sin()       { return this.#char.sin }
  get color()     { return this.#char.color ?? null }
  get goal()      { return this.#char.goal ?? null }
  get effectKey()    { return this.#char.effect?.key ?? null }
  get params()       { return this.#char.effect?.params ?? {} }
  get description()  { return this.#char.description ?? '' }

  getStartBalance() {
    const e = this.#char.effect
    if (e?.type === 'start_balance') return e.value
    return null
  }

  getLuckBonus() {
    const e = this.#char.effect
    if (e?.type === 'luck_bonus') return e.value
    return 0
  }
}
