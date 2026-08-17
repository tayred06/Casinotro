import { LC_ROWS, LC_COLS } from '../game/LitCityMachine.js'

const EMOJI_SIZE = '32px'

// Neon palette per symbol id
const SYM_COLOR = {
  building: '#7B8FA1',
  car:      '#E07B54',
  light:    '#F0C040',
  cocktail: '#8BC34A',
  camera:   '#E91E8C',
  gem:      '#00E5FF',
  wild:     '#ffffff',
  scatter:  '#FFD700',
}

export class LitCityRenderer {
  #container
  #multDisplay
  #winOverlay
  #winLabel
  #winAmount
  #winDetail
  #gameOverOverlay
  #gameOverText
  #selectionHint
  #selectionCancel
  #currentGrid = null

  get currentGrid() { return this.#currentGrid }

  constructor(onRestart) {
    this.#container       = document.getElementById('lc-grid')
    this.#multDisplay     = document.getElementById('lc-multiplier')
    this.#winOverlay      = document.getElementById('win-overlay')
    this.#winLabel        = document.getElementById('win-label')
    this.#winAmount       = document.getElementById('win-amount')
    this.#winDetail       = document.getElementById('win-detail')
    this.#gameOverOverlay = document.getElementById('game-over-overlay')
    this.#gameOverText    = document.getElementById('game-over-text')
    this.#selectionHint   = document.getElementById('selection-hint')
    this.#selectionCancel = document.getElementById('selection-cancel')

    document.getElementById('restart-btn').addEventListener('click', onRestart)
  }

  displayGrid(grid) {
    this.#currentGrid = grid
    this.#buildCells(grid)
  }

  #buildCells(grid, highlightSet = null) {
    this.#container.textContent = ''
    for (let r = 0; r < LC_ROWS; r++) {
      for (let c = 0; c < LC_COLS; c++) {
        const sym  = grid[r]?.[c]
        const cell = document.createElement('div')
        cell.className = 'lc-cell'
        cell.dataset.r = r
        cell.dataset.c = c

        if (sym) {
          const icon      = document.createElement('span')
          icon.className  = 'lc-icon'
          icon.textContent = sym.emoji
          icon.style.fontSize = EMOJI_SIZE
          if (sym.id === 'scatter') icon.style.filter = 'drop-shadow(0 0 6px #FFD700)'
          if (sym.id === 'wild')    icon.style.filter = 'drop-shadow(0 0 6px #fff)'
          cell.appendChild(icon)

          if (highlightSet?.has(`${r}-${c}`)) {
            cell.classList.add('lc-win')
            cell.style.setProperty('--sym-color', SYM_COLOR[sym.id] ?? '#c9a24a')
          }
        } else {
          cell.classList.add('lc-empty')
        }

        this.#container.appendChild(cell)
      }
    }
  }

  highlightClusters(winLines) {
    const set = new Set(winLines.flatMap(l => l.cells.map(({ r, c }) => `${r}-${c}`)))
    this.#buildCells(this.#currentGrid, set)
  }

  // Animate fall: briefly show cells dropping (CSS transition handles the visuals)
  async animateTumble(gridBefore, gridAfter) {
    // Flash-out winning cells
    const cells = this.#container.querySelectorAll('.lc-win')
    cells.forEach(el => el.classList.add('lc-explode'))
    await delay(240)

    // Show post-tumble grid with new cells marked as "falling"
    this.#currentGrid = gridAfter
    this.#buildCells(gridAfter)

    // Mark fresh cells (top rows that were null before)
    for (let r = 0; r < LC_ROWS; r++) {
      for (let c = 0; c < LC_COLS; c++) {
        const wasFilled   = gridBefore[r]?.[c] !== null
        const nowFilled   = gridAfter[r]?.[c] !== null
        if (!wasFilled && nowFilled) {
          const idx  = r * LC_COLS + c
          const cell = this.#container.children[idx]
          if (cell) cell.classList.add('lc-fall')
        }
      }
    }
    await delay(320)
    // Remove transient classes
    this.#container.querySelectorAll('.lc-fall').forEach(el => el.classList.remove('lc-fall'))
  }

  async animateSpin() {
    // Brief random-symbol shuffle
    for (let i = 0; i < 6; i++) {
      this.#container.querySelectorAll('.lc-cell').forEach(cell => {
        cell.classList.toggle('lc-spinning', true)
      })
      await delay(60)
    }
    this.#container.querySelectorAll('.lc-spinning').forEach(el => el.classList.remove('lc-spinning'))
  }

  setMultiplier(value) {
    if (!this.#multDisplay) return
    this.#multDisplay.textContent = `×${value}`
    this.#multDisplay.classList.toggle('lc-mult-active', value > 1)
  }

  showWin(amount, winLines, label = null) {
    this.#winOverlay.classList.remove('hidden')
    this.#winLabel.textContent  = label ? '' : 'GAIN'
    this.#winAmount.textContent = label ?? `+$${amount.toFixed(2)}`
    if (winLines?.length) {
      const best = winLines.reduce((a, b) => b.count > a.count ? b : a)
      this.#winDetail.textContent = `Cluster ${best.count} × ${best.symbolId} — ×${best.cascadeMult}`
    } else {
      this.#winDetail.textContent = label ? '' : ''
    }
  }

  hideWin() { this.#winOverlay.classList.add('hidden') }

  showGameOver(text) {
    this.#gameOverText.textContent = text
    this.#gameOverOverlay.classList.remove('hidden')
  }

  hideGameOver() { this.#gameOverOverlay.classList.add('hidden') }
  clearHighlights() { if (this.#currentGrid) this.#buildCells(this.#currentGrid) }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }
