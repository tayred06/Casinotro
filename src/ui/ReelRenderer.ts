import type { WinLine, Modifiers, GameSymbol } from '../types/index.ts'
import { WinFX } from './WinFX.ts'

// Maps existing symbol IDs → V2 card-suit visuals
const VISUAL: Record<string, { text: string; cls: string }> = {
  ten:     { text: '10', cls: 'cell-card'        },
  jack:    { text: 'J',  cls: 'cell-card'        },
  queen:   { text: 'Q',  cls: 'cell-card'        },
  king:    { text: 'K',  cls: 'cell-card'        },
  ace:     { text: 'A',  cls: 'cell-card'        },
  lemon:   { text: '♠',  cls: 'cell-suit black'  },
  grape:   { text: '♣',  cls: 'cell-suit black'  },
  bell:    { text: '♥',  cls: 'cell-suit red'    },
  diamond: { text: '♦',  cls: 'cell-suit red'    },
  star:    { text: '7',  cls: 'cell-seven'       },
  dog:     { text: '★',  cls: 'cell-suit black'  },
  wild:    { text: 'W',  cls: 'cell-wild'        },
  scatter: { text: '⛧',  cls: 'cell-scatter'     },
  broken:  { text: '✖',  cls: 'cell-broken'      },
}

// Base symbols shown during spin animation (no scatter/wild — they'd look odd mid-blur)
const SPIN_VISUALS = ['ten', 'jack', 'queen', 'king', 'ace', 'lemon', 'grape', 'bell', 'diamond', 'star', 'dog']
  .map(id => VISUAL[id])

// Human-readable label for each symbol (shown in badges)
const SYM_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(VISUAL).map(([id, v]) => [id, v.text])
)

const WIN_COLOR: Record<string, string> = {
  ten:     '#c9d8c0',
  jack:    '#c9d8c0',
  queen:   '#c9d8c0',
  king:    '#c9d8c0',
  ace:     '#c9d8c0',
  lemon:   '#dcf7c8',
  grape:   '#dcf7c8',
  bell:    '#ff2d55',
  diamond: '#ff2d55',
  star:    '#b6f36a',
  dog:     '#ffd700',
  wild:    '#77a06a',
  scatter: '#b6f36a',
}

export class ReelRenderer {
  #winFX: WinFX
  #container: HTMLElement
  #colBadgesRow: HTMLElement
  #symBadges: HTMLElement
  #winOverlay: HTMLElement
  #winLabel: HTMLElement
  #winAmount: HTMLElement
  #winDetail: HTMLElement
  #gameOverOverlay: HTMLElement
  #gameOverText: HTMLElement
  #restartBtn: HTMLElement
  #selectionHint: HTMLElement
  #selectionCancel: HTMLElement
  #currentGrid: GameSymbol[][] | null = null
  #cellStates: number[][] | null = null
  #lastModifiers: Partial<Modifiers> = {}
  #spinTicker: ReturnType<typeof setInterval> | null = null
  #spinTimeouts: ReturnType<typeof setTimeout>[] = []

  get currentGrid() { return this.#currentGrid }

  constructor(onRestart: () => void) {
    this.#container       = document.getElementById('reels-container')!
    this.#colBadgesRow    = document.getElementById('col-badges-row')!
    this.#symBadges       = document.getElementById('sym-badges')!
    this.#winOverlay      = document.getElementById('win-overlay')!
    this.#winLabel        = document.getElementById('win-label')!
    this.#winAmount       = document.getElementById('win-amount')!
    this.#winDetail       = document.getElementById('win-detail')!
    this.#gameOverOverlay = document.getElementById('game-over-overlay')!
    this.#gameOverText    = document.getElementById('game-over-text')!
    this.#restartBtn      = document.getElementById('restart-btn')!
    this.#selectionHint   = document.getElementById('selection-hint')!
    this.#selectionCancel = document.getElementById('selection-cancel')!
    this.#restartBtn.addEventListener('click', onRestart)

    this.#winFX = new WinFX({
      root:    document.getElementById('machine-area')!,
      overlay: this.#winOverlay,
      banner:  this.#winOverlay.querySelector('.win-banner'),
      label:   this.#winLabel,
      amount:  this.#winAmount,
      detail:  this.#winDetail,
    })
  }

  /**
   * Coup de poing : secousse de la machine + impact sur la case touchée.
   * Doit être appelé après le re-rendu de la grille (les cellules sont recréées).
   */
  playImpact(col: number, row: number, broken: boolean) {
    const area = document.getElementById('machine-area')
    if (area) {
      area.classList.remove('shake', 'shake-hard')
      void area.offsetWidth   // relance l'animation même sur deux frappes d'affilée
      area.classList.add(broken ? 'shake-hard' : 'shake')
      setTimeout(() => area.classList.remove('shake', 'shake-hard'), 620)
    }

    const cell = this.#container.children[col]?.children[row] as HTMLElement | undefined
    if (!cell) return
    cell.classList.remove('hit', 'shattered')
    void cell.offsetWidth
    cell.classList.add(broken ? 'shattered' : 'hit')
    setTimeout(() => cell.classList.remove('hit', 'shattered'), 620)
  }

  /** Usure par case (Ira) : 0 intacte → 1 morte. */
  setCellStates(states: number[][] | null) {
    this.#cellStates = states
    if (this.#currentGrid) this.#buildCells(this.#currentGrid, this.#lastModifiers)
  }

  displayGrid(grid: GameSymbol[][], modifiers: Partial<Modifiers> = {}) {
    this.#lastModifiers = modifiers
    this.#currentGrid = grid
    this.#buildCells(grid, modifiers)
    this.#scaleFonts()
  }

  #buildCells(grid: GameSymbol[][], modifiers: Partial<Modifiers> = {}) {
    this.#container.textContent = ''
    const { wildColumns = [] } = modifiers

    grid.forEach((col, reelIdx) => {
      const reel = document.createElement('div')
      reel.className = 'reel'

      col.forEach((symbol, rowIdx) => {
        const cell = document.createElement('div')
        cell.className = 'cell'
        if (wildColumns[reelIdx]) cell.classList.add('wild-col')
        const wear = this.#cellStates?.[reelIdx]?.[rowIdx] ?? 0
        if (symbol.id === 'broken' || wear >= 1) cell.classList.add('dead')
        else if (wear > 0) cell.classList.add(wear >= 0.6 ? 'cracked-hard' : 'cracked')
        cell.appendChild(this.#makeSymbol(symbol))
        reel.appendChild(cell)
      })

      this.#container.appendChild(reel)
    })
  }

  #makeSymbol(symbol: GameSymbol) {
    const v = VISUAL[symbol.id] || { text: symbol.emoji, cls: 'cell-suit black' }

    if (symbol.id === 'scatter') {
      const wrap = document.createElement('span')
      wrap.className = 'cell-scatter'
      wrap.textContent = '⛧'
      return wrap
    }

    const el = document.createElement('span')
    el.className = v.cls
    el.textContent = v.text
    return el
  }

  #scaleFonts() {
    requestAnimationFrame(() => {
      this.#container.querySelectorAll('.cell').forEach(cell => {
        const h = (cell as HTMLElement).offsetHeight
        if (!h) return
        const fs = Math.min(Math.round(h * 0.5), 64)
        const inner = cell.querySelector('[class^="cell-"]') as HTMLElement | null
        if (!inner) return
        inner.style.fontSize = fs + 'px'
        if (inner.classList.contains('cell-scatter')) {
          const size = Math.round(h * 0.4)
          inner.style.width  = size + 'px'
          inner.style.height = size + 'px'
          inner.style.fontSize = Math.round(size * 0.42) + 'px'
        }
      })
    })
  }

  #cancelAnimation() {
    if (this.#spinTicker !== null) {
      clearInterval(this.#spinTicker)
      this.#spinTicker = null
    }
    for (const id of this.#spinTimeouts) clearTimeout(id)
    this.#spinTimeouts = []
    this.#container.querySelectorAll('.cell.spinning').forEach(cell =>
      cell.classList.remove('spinning')
    )
  }

  async animateSpin(finalGrid: GameSymbol[][]) {
    this.#cancelAnimation()

    this.#currentGrid = finalGrid
    this.#buildCells(finalGrid)
    this.#scaleFonts()

    const reelEls = Array.from(this.#container.querySelectorAll('.reel'))
    const COLS = reelEls.length
    const BASE  = 280
    const STEP  = 200
    const locked = new Set<number>()

    reelEls.forEach(reel => {
      reel.querySelectorAll('.cell').forEach(cell => {
        cell.classList.add('spinning')
        const inner = cell.querySelector('[class^="cell-"]') as HTMLElement | null
        if (inner) {
          const v = this.#randomVisual()
          inner.className   = v.cls
          inner.textContent = v.text
        }
      })
    })

    this.#spinTicker = setInterval(() => {
      reelEls.forEach((reel, i) => {
        if (locked.has(i)) return
        reel.querySelectorAll('.cell [class^="cell-"]').forEach(el => {
          const v = this.#randomVisual()
          ;(el as HTMLElement).className   = v.cls
          ;(el as HTMLElement).textContent = v.text
        })
      })
    }, 65)

    for (let c = 0; c < COLS; c++) {
      const id = setTimeout(() => {
        locked.add(c)
        reelEls[c]?.querySelectorAll('.cell').forEach((cell, rowIdx) => {
          cell.classList.remove('spinning')
          const inner = cell.querySelector('[class^="cell-"]') as HTMLElement | null
          const sym   = finalGrid[c]?.[rowIdx]
          if (inner && sym) {
            const v = VISUAL[sym.id]
            if (v) {
              inner.className   = v.cls
              inner.textContent = v.text
            } else {
              inner.textContent = sym.emoji
            }
          }
        })
      }, BASE + (c + 1) * STEP)
      this.#spinTimeouts.push(id)
    }

    await new Promise(resolve => setTimeout(resolve, BASE + COLS * STEP + 80))
    this.#cancelAnimation()
  }

  #randomVisual() {
    return SPIN_VISUALS[Math.floor(Math.random() * SPIN_VISUALS.length)]
  }

  highlightWins(winLines: WinLine[]) {
    const reelEls = Array.from(this.#container.querySelectorAll('.reel'))

    winLines.forEach(line => {
      const color = WIN_COLOR[line.symbolId] ?? '#b6f36a'
      // `cells` liste toutes les cases payées, pas seulement la première par rouleau.
      for (const [reel, row] of line.cells) {
        const cell = reelEls[reel]?.querySelectorAll('.cell')[row] as HTMLElement | undefined
        if (!cell) continue
        cell.classList.add('win')
        cell.style.setProperty('--win-color', color)
        cell.style.borderColor = color
        cell.style.boxShadow   = `inset 0 0 16px ${color}22, 0 0 12px ${color}33`
      }
    })
  }

  clearHighlights() {
    this.#container.querySelectorAll('.cell.win').forEach(cell => {
      cell.classList.remove('win')
      ;(cell as HTMLElement).style.removeProperty('--win-color')
      ;(cell as HTMLElement).style.removeProperty('border-color')
      ;(cell as HTMLElement).style.removeProperty('box-shadow')
    })
  }

  /**
   * Séquence de gain complète : bannière + effets du palier (ratio gain/mise).
   * Résout quand la bannière peut être masquée — immédiatement pour les petits
   * gains, après le hold du palier (ou un skip du joueur) pour les gros.
   */
  playWin(amount: number, bet: number, winLines: WinLine[] | null, label: string | null = null): Promise<void> {
    this.#winDetail.textContent = this.#winDetailText(winLines)
    return this.#winFX.play(amount, bet, label ?? undefined)
  }

  #winDetailText(winLines: WinLine[] | null): string {
    if (!winLines?.length) return ''
    const best = winLines.reduce((a, b) => b.count > a.count ? b : a)
    const v = VISUAL[best.symbolId]
    return v ? `${best.count} × ${v.text}` : ''
  }

  showWin(amount: number, winLines: WinLine[] | null, label: string | null = null) {
    this.#winLabel.textContent  = label ?? (winLines?.some(l => l.count >= 5) ? 'GROS GAIN' : 'GAIN')
    this.#winAmount.textContent = `+⛧${amount.toFixed(2)}`

    this.#winDetail.textContent = this.#winDetailText(winLines)
    this.#winFX.stop()
    this.#winOverlay.classList.remove('hidden')
  }

  hideWin() {
    this.#winFX.stop()
    this.#winOverlay.classList.add('hidden')
  }

  showGameOver(text: string) {
    this.#gameOverText.textContent = text
    this.#gameOverOverlay.classList.remove('hidden')
  }

  hideGameOver() { this.#gameOverOverlay.classList.add('hidden') }

  // Update all modifier badges (column multipliers, wild columns, symbol multipliers)
  showModifiers(modifiers: Partial<Modifiers> = {}) {
    const { columnMultipliers = [], wildColumns = [], symbolMultipliers = {} } = modifiers
    const reelEls = Array.from(this.#container.querySelectorAll('.reel'))

    // Wild column cell tinting
    reelEls.forEach((reel, i) => {
      reel.querySelectorAll('.cell').forEach(cell => {
        cell.classList.toggle('wild-col', !!wildColumns[i])
      })
    })

    // Column badges row (top)
    this.#colBadgesRow.textContent = ''
    const COLS = Math.max(reelEls.length, columnMultipliers.length, wildColumns.length, 1)
    let anyColBadge = false

    for (let i = 0; i < COLS; i++) {
      const badge = document.createElement('div')
      badge.className = 'col-badge-top'

      if (wildColumns[i]) {
        badge.textContent = 'WILD'
        badge.classList.add('wild')
        anyColBadge = true
      } else if (columnMultipliers[i] && columnMultipliers[i] > 1) {
        badge.textContent = `×${columnMultipliers[i]}`
        anyColBadge = true
      } else {
        badge.classList.add('empty')
      }

      this.#colBadgesRow.appendChild(badge)
    }

    this.#colBadgesRow.classList.toggle('visible', anyColBadge)

    // Symbol multiplier badges (left side)
    this.#symBadges.textContent = ''
    Object.entries(symbolMultipliers).forEach(([symId, mult]) => {
      if (!mult || mult <= 1) return
      const label = SYM_LABEL[symId] ?? symId
      const badge = document.createElement('div')
      badge.className = 'sym-badge'
      badge.textContent = `${label} ×${typeof mult === 'number' ? mult.toFixed(mult % 1 ? 1 : 0) : mult}`
      this.#symBadges.appendChild(badge)
    })
  }

  // Interactive column selection — returns Promise<number> (0-indexed column)
  selectColumn(): Promise<number> {
    return new Promise((resolve, reject) => {
      const reelEls = Array.from(this.#container.querySelectorAll('.reel'))
      const spinBtn = document.getElementById('spin-btn') as HTMLButtonElement | null

      this.#selectionHint.textContent = 'CLIQUER SUR UN ROULEAU'
      this.#selectionHint.classList.remove('hidden')
      this.#selectionCancel.classList.remove('hidden')
      if (spinBtn) spinBtn.disabled = true

      const cleanup = (cancelled = false) => {
        this.#selectionHint.classList.add('hidden')
        this.#selectionCancel.classList.add('hidden')
        reelEls.forEach((reel, i) => {
          reel.classList.remove('selectable', 'selected')
          reel.removeEventListener('click', handlers[i])
        })
        document.removeEventListener('keydown', onEsc)
        this.#selectionCancel.removeEventListener('click', onCancel)
        if (spinBtn) spinBtn.disabled = false
        if (cancelled) reject(new Error('cancelled'))
      }

      const handlers: Array<() => void> = []

      reelEls.forEach((reel, i) => {
        reel.classList.add('selectable')
        const handler = () => {
          reel.classList.add('selected')
          // Brief visual feedback before resolving
          setTimeout(() => reel.classList.remove('selected'), 400)
          cleanup()
          resolve(i)
        }
        handlers.push(handler)
        reel.addEventListener('click', handler, { once: true })
      })

      const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') cleanup(true) }
      document.addEventListener('keydown', onEsc, { once: true })

      const onCancel = () => cleanup(true)
      this.#selectionCancel.addEventListener('click', onCancel, { once: true })
    })
  }

  // Interactive symbol selection — returns Promise<string> (symbol id)
  selectSymbol(): Promise<string> {
    return new Promise((resolve, reject) => {
      const cells = Array.from(this.#container.querySelectorAll('.cell'))
      const spinBtn = document.getElementById('spin-btn') as HTMLButtonElement | null

      this.#selectionHint.textContent = 'CLIQUER SUR UN SYMBOLE'
      this.#selectionHint.classList.remove('hidden')
      this.#selectionCancel.classList.remove('hidden')
      if (spinBtn) spinBtn.disabled = true

      // Build flat grid positions → symbol ids
      const flatSymbols = this.#currentGrid
        ? this.#currentGrid.flat().map(s => s.id)
        : []

      const handlers: Array<(() => void) | null> = []
      let resolved = false

      const cleanup = (cancelled = false) => {
        this.#selectionHint.classList.add('hidden')
        this.#selectionCancel.classList.add('hidden')
        cells.forEach((cell, i) => {
          cell.classList.remove('sym-selectable')
          const h = handlers[i]
          if (h) cell.removeEventListener('click', h)
        })
        document.removeEventListener('keydown', onEsc)
        this.#selectionCancel.removeEventListener('click', onCancel)
        if (spinBtn) spinBtn.disabled = false
        if (cancelled && !resolved) reject(new Error('cancelled'))
      }

      cells.forEach((cell, i) => {
        const symId = flatSymbols[i]
        // Skip special symbols — can't be selected as targets
        if (!symId || symId === 'wild' || symId === 'scatter') {
          handlers.push(null)
          return
        }

        cell.classList.add('sym-selectable')
        const handler = () => {
          if (resolved) return
          resolved = true
          cleanup()
          resolve(symId)
        }
        handlers.push(handler)
        cell.addEventListener('click', handler, { once: true })
      })

      const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') cleanup(true) }
      document.addEventListener('keydown', onEsc, { once: true })

      const onCancel = () => cleanup(true)
      this.#selectionCancel.addEventListener('click', onCancel, { once: true })
    })
  }
}
