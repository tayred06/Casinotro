export class CharacterSelect {
  #onSelect
  #overlay

  constructor(characters, onSelect) {
    this.#onSelect = onSelect
    this.#overlay  = document.getElementById('character-select-overlay')
    this.#renderGrid(characters.filter(c => !c.hidden))
  }

  #renderGrid(characters) {
    const grid = this.#overlay.querySelector('.cs-grid')
    for (const char of characters) {
      const card = document.createElement('button')
      card.className = 'cs-card'

      const emoji = document.createElement('span')
      emoji.className = 'cs-emoji'
      emoji.textContent = char.emoji

      const name = document.createElement('span')
      name.className = 'cs-name'
      name.textContent = char.name

      const sin = document.createElement('span')
      sin.className = 'cs-sin'
      sin.textContent = char.sin

      const desc = document.createElement('span')
      desc.className = 'cs-desc'
      desc.textContent = char.description

      card.append(emoji, name, sin, desc)
      card.addEventListener('click', () => this.#onSelect(char))
      grid.appendChild(card)
    }
  }

  show() { this.#overlay.classList.remove('hidden') }
  hide() { this.#overlay.classList.add('hidden') }
}
