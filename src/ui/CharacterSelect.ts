import type { Character } from '../game/Characters.ts'
import { isCharacterPlayable, isInDemoRoster, DEBUG_CHARACTER_ID, isDebugEnvironment } from '../game/Characters.ts'
import { START_BALANCE, STAGE_QUOTA_K, STAGE_MIN_BETS } from '../game/RunState.ts'
import { souls } from '../utils/format.ts'

export class CharacterSelect {
  #onSelect: (char: Character) => void
  #characters: Character[] = []
  #unlocked: ReadonlySet<string> = new Set()
  #overlay: HTMLElement
  #selected: Character | null = null
  #cards = new Map<string, HTMLElement>()

  #barName: HTMLElement
  #barSin: HTMLElement
  #barStart: HTMLElement
  #barQuota: HTMLElement
  #confirmBtn: HTMLButtonElement

  constructor(characters: Character[], onSelect: (char: Character) => void, unlocked: ReadonlySet<string>) {
    this.#onSelect = onSelect
    // Le personnage de debug n'apparaît qu'en local : ailleurs, pas même une carte verrouillée.
    this.#characters = characters.filter(c =>
      !c.hidden && (c.id !== DEBUG_CHARACTER_ID || isDebugEnvironment()))
    this.#unlocked = unlocked
    this.#overlay  = document.getElementById('character-select-overlay')!

    this.#barName    = document.getElementById('cs-bar-name')!
    this.#barSin     = document.getElementById('cs-bar-sin')!
    this.#barStart   = document.getElementById('cs-bar-start')!
    this.#barQuota   = document.getElementById('cs-bar-quota')!
    this.#confirmBtn = document.getElementById('cs-confirm-btn') as HTMLButtonElement

    this.#confirmBtn.addEventListener('click', () => {
      if (this.#selected) this.#onSelect(this.#selected)
    })

    this.#renderGrid(this.#characters)
  }

  /** Re-rend la grille avec la liste de débloqués à jour (après une victoire). */
  refresh(unlocked: ReadonlySet<string>) {
    this.#unlocked = unlocked
    this.#selected = null
    this.#confirmBtn.disabled = true
    this.#renderGrid(this.#characters)
  }

  #renderGrid(characters: Character[]) {
    const grid = this.#overlay.querySelector('.cs-grid')!
    grid.innerHTML = ''
    this.#cards.clear()

    for (const char of characters) {
      const card = this.#buildCard(char)
      grid.appendChild(card)
      this.#cards.set(char.id, card)
    }
  }

  #buildCard(char: Character): HTMLElement {
    const felt     = char.color    ?? '#0a0f0b'
    const feltEdge = char.colorEdge ?? '#2f5136'

    const playable = isCharacterPlayable(char, this.#unlocked)

    const card = document.createElement('div')
    card.className = playable ? 'cs-card' : 'cs-card cs-card--locked'

    // ── Plate (top visual area) ──────────────────────
    const plate = document.createElement('div')
    plate.className = 'cs-plate'
    plate.style.background = `${felt} repeating-linear-gradient(135deg,transparent 0 7px,rgba(255,255,255,.035) 7px 8px)`

    // Sigil — positioned absolutely, Silkscreen, large
    const sigil = document.createElement('div')
    sigil.className = 'cs-sigil'
    sigil.textContent = char.sigil ?? char.emoji
    sigil.style.color   = feltEdge
    sigil.style.opacity = '0.6'

    // Badge — "SÉLECTIONNÉ" quand sélectionné, "VERROUILLÉ" si indisponible
    const badge = document.createElement('div')
    badge.className = playable ? 'cs-badge' : 'cs-badge cs-badge--locked'
    badge.style.display = playable ? 'none' : ''
    badge.textContent = playable ? 'SÉLECTIONNÉ' : 'VERROUILLÉ'

    plate.appendChild(sigil)
    plate.appendChild(badge)

    // ── Info section (bottom) ───────────────────────
    const info = document.createElement('div')
    info.className = 'cs-card-info'

    const nameEl = document.createElement('div')
    nameEl.className = 'cs-name'
    const nameLen = char.name.length
    nameEl.style.fontSize = nameLen > 10 ? '14px' : nameLen > 8 ? '17px' : '20px'
    nameEl.textContent = char.name

    const tagEl = document.createElement('div')
    tagEl.className = 'cs-tag'
    tagEl.textContent = char.tag ?? char.sin

    const mechEl = document.createElement('div')
    mechEl.className = 'cs-mech-title'
    mechEl.textContent = char.mechTitle ?? ''

    const descEl = document.createElement('div')
    descEl.className = 'cs-desc'
    descEl.textContent = playable
      ? char.description
      : isInDemoRoster(char)
        ? 'Verrouillé — termine une run avec le personnage précédent.'
        : 'Indisponible dans cette démo.'

    info.appendChild(nameEl)
    info.appendChild(tagEl)
    if (char.mechTitle) info.appendChild(mechEl)
    info.appendChild(descEl)

    card.appendChild(plate)
    card.appendChild(info)

    if (playable) {
      card.addEventListener('click', () => this.#selectCard(char, card, badge))
    }

    return card
  }

  #selectCard(char: Character, clickedCard: HTMLElement, clickedBadge: HTMLElement) {
    if (!isCharacterPlayable(char, this.#unlocked)) return
    this.#selected = char

    // Update card visual states
    this.#cards.forEach((card) => {
      const badge = card.querySelector<HTMLElement>('.cs-badge')
      card.classList.remove('selected')
      if (badge) badge.style.display = 'none'
    })
    clickedCard.classList.add('selected')
    clickedBadge.style.display = ''

    // Update bottom bar
    this.#barName.textContent  = char.name
    this.#barSin.textContent   = char.sin
    // Valeurs réelles du palier 1 : la barre affichait encore les chiffres d'avant
    // la refonte du quota (1 000 / 3 000).
    this.#barStart.textContent = souls(char.startBalance ?? START_BALANCE)
    this.#barQuota.textContent = souls(Math.round(STAGE_QUOTA_K[0] * STAGE_MIN_BETS[0]))
    this.#confirmBtn.disabled  = false
  }

  show() { this.#overlay.classList.remove('hidden') }
  hide() { this.#overlay.classList.add('hidden') }
}
