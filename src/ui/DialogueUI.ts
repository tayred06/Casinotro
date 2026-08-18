import type { DialogueLine } from '../types/index.ts'

export class DialogueUI {
  #section: HTMLElement
  #box: HTMLElement
  #sigilEl: HTMLElement
  #speakerEl: HTMLElement
  #textEl: HTMLElement
  #countEl: HTMLElement
  #revealBtn: HTMLElement
  #lines: DialogueLine[] = []
  #index = 0
  #resolve: (() => void) | null = null

  constructor() {
    this.#section   = document.getElementById('dialogue-section')!
    this.#box       = document.getElementById('dlg-box')!
    this.#sigilEl   = document.getElementById('dlg-plate-sigil')!
    this.#speakerEl = document.getElementById('dlg-speaker')!
    this.#textEl    = document.getElementById('dlg-text')!
    this.#countEl   = document.getElementById('dlg-count')!
    this.#revealBtn = document.getElementById('dlg-reveal')!

    document.getElementById('dlg-next')?.addEventListener('click', () => this.#next())
    document.getElementById('dlg-hide')?.addEventListener('click', () => this.#collapse())
    this.#revealBtn.addEventListener('click', () => this.#expand())

    document.addEventListener('keydown', (e) => {
      if (this.#section.classList.contains('active') && !this.#box.classList.contains('hidden')
          && (e.key === 'Enter' || e.key === ' ')) {
        this.#next()
      }
    })
  }

  show(lines: DialogueLine[]): Promise<void> {
    this.#lines = lines
    this.#index = 0
    this.#expand()
    this.#render()
    return new Promise(resolve => { this.#resolve = resolve })
  }

  hide(): void {
    this.#section.classList.remove('active')
    this.#box.classList.add('hidden')
    this.#revealBtn.classList.add('hidden')
    this.#resolve?.()
    this.#resolve = null
  }

  setSigil(sigil: string): void {
    this.#sigilEl.textContent = sigil
  }

  #expand(): void {
    this.#section.classList.add('active')
    this.#box.classList.remove('hidden')
    this.#revealBtn.classList.add('hidden')
  }

  #collapse(): void {
    this.#box.classList.add('hidden')
    this.#revealBtn.classList.remove('hidden')
    // section reste active (visible) pour montrer le bouton reveal
  }

  #render(): void {
    const line = this.#lines[this.#index]
    if (!line) { this.hide(); return }
    this.#speakerEl.textContent = line.speaker
    this.#textEl.textContent    = line.text
    this.#countEl.textContent   = `${this.#index + 1} / ${this.#lines.length}`
  }

  #next(): void {
    this.#index++
    if (this.#index >= this.#lines.length) { this.hide(); return }
    this.#render()
  }
}
