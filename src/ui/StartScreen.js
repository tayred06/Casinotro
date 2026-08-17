const MACHINES = [
  {
    id:    'trefle',
    name:  'Trèfle',
    emoji: '♠',
    sub:   '6 rouleaux · lignes · variable',
    color: '#c9a24a',
  },
  {
    id:    'litcity',
    name:  'Lit City',
    emoji: '🏙️',
    sub:   '5×5 · clusters · tumble',
    color: '#E91E8C',
  },
]

export class StartScreen {
  #overlay
  #onStart
  #selectedMachine = 'trefle'
  #machineCards    = new Map()

  constructor(characters, onStart) {
    this.#onStart = onStart
    this.#overlay = document.getElementById('start-overlay')
    this.#renderMachines()
    this.#renderCharacters(characters.filter(c => !c.hidden))
  }

  #renderMachines() {
    const row = this.#overlay.querySelector('.ss-machine-row')
    for (const m of MACHINES) {
      const card = document.createElement('button')
      card.className = 'ss-mcard'
      card.style.setProperty('--mc-color', m.color)
      if (m.id === this.#selectedMachine) card.classList.add('ss-mcard-active')

      const makeSpan = (cls, txt) => {
        const s = document.createElement('span'); s.className = cls; s.textContent = txt; return s
      }
      card.appendChild(makeSpan('ss-mc-emoji', m.emoji))
      card.appendChild(makeSpan('ss-mc-name',  m.name))
      card.appendChild(makeSpan('ss-mc-sub',   m.sub))

      card.addEventListener('click', () => this.#selectMachine(m.id))
      this.#machineCards.set(m.id, card)
      row.appendChild(card)
    }
  }

  #selectMachine(id) {
    this.#selectedMachine = id
    for (const [mid, card] of this.#machineCards) {
      card.classList.toggle('ss-mcard-active', mid === id)
    }
  }

  #renderCharacters(characters) {
    const grid = this.#overlay.querySelector('.ss-char-grid')
    for (const char of characters) {
      const card = document.createElement('button')
      card.className = 'ss-ccard'

      const makeSpan = (cls, txt) => {
        const s = document.createElement('span'); s.className = cls; s.textContent = txt; return s
      }
      card.appendChild(makeSpan('ss-cc-emoji', char.emoji))
      card.appendChild(makeSpan('ss-cc-name',  char.name))
      card.appendChild(makeSpan('ss-cc-sin',   char.sin))
      card.appendChild(makeSpan('ss-cc-desc',  char.description))

      card.addEventListener('click', () => this.#onStart(this.#selectedMachine, char))
      grid.appendChild(card)
    }
  }

  show() { this.#overlay.classList.remove('hidden') }
  hide() { this.#overlay.classList.add('hidden') }
}
