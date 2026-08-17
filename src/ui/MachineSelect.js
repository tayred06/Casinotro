const MACHINES = [
  {
    id:       'trefle',
    name:     'Trèfle',
    emoji:    '♠',
    subtitle: 'Machine classique',
    desc:     '6 rouleaux · hauteur variable · lignes gagnantes · boutique & personnages',
    color:    '#c9a24a',
  },
  {
    id:       'litcity',
    name:     'Lit City',
    emoji:    '🏙️',
    subtitle: 'Cluster · Tumble',
    desc:     'Grille 5×5 fixe · clusters de 5+ symboles · cascades illimitées · multiplicateur progressif',
    color:    '#E91E8C',
  },
]

export class MachineSelect {
  #overlay
  #onSelect

  constructor(onSelect) {
    this.#onSelect = onSelect
    this.#overlay  = document.getElementById('machine-select-overlay')
    this.#render()
  }

  #render() {
    const grid = this.#overlay.querySelector('.ms-grid')
    grid.textContent = ''

    for (const machine of MACHINES) {
      const card = document.createElement('button')
      card.className = 'ms-card'
      card.style.setProperty('--ms-color', machine.color)
      const makeSpan = (cls, text) => { const s = document.createElement('span'); s.className = cls; s.textContent = text; return s }
      card.appendChild(makeSpan('ms-emoji', machine.emoji))
      card.appendChild(makeSpan('ms-name',  machine.name))
      card.appendChild(makeSpan('ms-sub',   machine.subtitle))
      card.appendChild(makeSpan('ms-desc',  machine.desc))
      card.addEventListener('click', () => this.#onSelect(machine.id))
      grid.appendChild(card)
    }
  }

  show() { this.#overlay.classList.remove('hidden') }
  hide() { this.#overlay.classList.add('hidden') }
}
