import type { DialogueLine } from '../types/index.ts'

export class DialogueUI {
  #overlay: HTMLElement
  #speakerEl: HTMLElement
  #textEl: HTMLElement
  #lines: DialogueLine[] = []
  #index = 0
  #resolve: (() => void) | null = null

  constructor() {
    this.#overlay = document.createElement('div')
    this.#overlay.className = 'dialogue-overlay hidden'
    this.#overlay.innerHTML = `
      <div class="dialogue-box">
        <div class="dialogue-speaker"></div>
        <p class="dialogue-text"></p>
        <div class="dialogue-hint">Appuyer pour continuer</div>
      </div>
    `
    this.#speakerEl = this.#overlay.querySelector('.dialogue-speaker')!
    this.#textEl    = this.#overlay.querySelector('.dialogue-text')!
    document.body.appendChild(this.#overlay)
    this.#overlay.addEventListener('click', () => this.#next())
    document.addEventListener('keydown', (e) => {
      if (!this.#overlay.classList.contains('hidden') && (e.key === 'Enter' || e.key === ' ')) {
        this.#next()
      }
    })
  }

  show(lines: DialogueLine[]): Promise<void> {
    this.#lines = lines
    this.#index = 0
    this.#overlay.classList.remove('hidden')
    this.#render()
    return new Promise(resolve => { this.#resolve = resolve })
  }

  hide(): void {
    this.#overlay.classList.add('hidden')
    this.#resolve?.()
    this.#resolve = null
  }

  #render(): void {
    const line = this.#lines[this.#index]
    if (!line) { this.hide(); return }
    this.#speakerEl.textContent = line.speaker
    this.#textEl.textContent    = line.text
  }

  #next(): void {
    this.#index++
    if (this.#index >= this.#lines.length) { this.hide(); return }
    this.#render()
  }
}
