// Maps existing symbol IDs → V2 card-suit visuals
const VISUAL = {
  lemon:   { text: '♠', cls: 'cell-suit black' },
  grape:   { text: '♣', cls: 'cell-suit black' },
  bell:    { text: '♥', cls: 'cell-suit red'   },
  diamond: { text: '♦', cls: 'cell-suit red'   },
  star:    { text: '7',  cls: 'cell-seven'       },
  dog:     { text: '★',  cls: 'cell-suit black'  },
  wild:    { text: 'W',  cls: 'cell-wild'        },
  scatter: { text: '$',  cls: 'cell-scatter'     },
}

// Base symbols shown during spin animation (no scatter/wild — they'd look odd mid-blur)
const SPIN_VISUALS = ['lemon', 'grape', 'bell', 'diamond', 'star', 'dog'].map(id => VISUAL[id])

// Human-readable label for each symbol (shown in badges)
const SYM_LABEL = {
  lemon: '♠', grape: '♣', bell: '♥', diamond: '♦', star: '7', dog: '★',
}

const WIN_COLOR = {
  lemon:   '#e7e5e0',
  grape:   '#e7e5e0',
  bell:    '#b7534f',
  diamond: '#b7534f',
  star:    '#c9a24a',
  dog:     '#e7e5e0',
  wild:    '#9a9f9c',
  scatter: '#c9a24a',
}

export class ReelRenderer {
  #container
  #colBadgesRow
  #symBadges
  #winOverlay
  #winLabel
  #winAmount
  #winDetail
  #gameOverOverlay
  #gameOverText
  #restartBtn
  #selectionHint
  #selectionCancel
  #currentGrid = null

  get currentGrid() { return this.#currentGrid }

  constructor(onRestart) {
    this.#container       = document.getElementById('reels-container')
    this.#colBadgesRow    = document.getElementById('col-badges-row')
    this.#symBadges       = document.getElementById('sym-badges')
    this.#winOverlay      = document.getElementById('win-overlay')
    this.#winLabel        = document.getElementById('win-label')
    this.#winAmount       = document.getElementById('win-amount')
    this.#winDetail       = document.getElementById('win-detail')
    this.#gameOverOverlay = document.getElementById('game-over-overlay')
    this.#gameOverText    = document.getElementById('game-over-text')
    this.#restartBtn      = document.getElementById('restart-btn')
    this.#selectionHint   = document.getElementById('selection-hint')
    this.#selectionCancel = document.getElementById('selection-cancel')
    this.#restartBtn.addEventListener('click', onRestart)
  }

  displayGrid(grid, modifiers = {}) {
    this.#currentGrid = grid
    this.#buildCells(grid, modifiers)
    this.#scaleFonts()
  }

  #buildCells(grid, modifiers = {}) {
    this.#container.textContent = ''
    const { wildColumns = [] } = modifiers

    grid.forEach((col, reelIdx) => {
      const reel = document.createElement('div')
      reel.className = 'reel'

      col.forEach(symbol => {
        const cell = document.createElement('div')
        cell.className = 'cell'
        if (wildColumns[reelIdx]) cell.classList.add('wild-col')
        cell.appendChild(this.#makeSymbol(symbol))
        reel.appendChild(cell)
      })

      this.#container.appendChild(reel)
    })
  }

  #makeSymbol(symbol) {
    const v = VISUAL[symbol.id] || { text: symbol.emoji, cls: 'cell-suit black' }

    if (symbol.id === 'scatter') {
      const wrap = document.createElement('span')
      wrap.className = 'cell-scatter'
      wrap.textContent = '$'
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
        const h = cell.offsetHeight
        if (!h) return
        const fs = Math.min(Math.round(h * 0.5), 64)
        const inner = cell.querySelector('[class^="cell-"]')
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

  async animateSpin(finalGrid) {
    this.#currentGrid = finalGrid
    this.#buildCells(finalGrid)
    this.#scaleFonts()

    const reelEls = Array.from(this.#container.querySelectorAll('.reel'))
    const COLS = reelEls.length
    const BASE  = 280
    const STEP  = 200
    const locked = new Set()

    reelEls.forEach(reel => {
      reel.querySelectorAll('.cell').forEach(cell => {
        cell.classList.add('spinning')
        const inner = cell.querySelector('[class^="cell-"]')
        if (inner) {
          const v = this.#randomVisual()
          inner.className   = v.cls
          inner.textContent = v.text
        }
      })
    })

    const ticker = setInterval(() => {
      reelEls.forEach((reel, i) => {
        if (locked.has(i)) return
        reel.querySelectorAll('.cell [class^="cell-"]').forEach(el => {
          const v = this.#randomVisual()
          el.className   = v.cls
          el.textContent = v.text
        })
      })
    }, 65)

    for (let c = 0; c < COLS; c++) {
      setTimeout(() => {
        locked.add(c)
        reelEls[c].querySelectorAll('.cell').forEach((cell, rowIdx) => {
          cell.classList.remove('spinning')
          const inner = cell.querySelector('[class^="cell-"]')
          const sym   = finalGrid[c]?.[rowIdx]
          if (inner && sym) inner.textContent = VISUAL[sym.id]?.text ?? sym.emoji
        })
      }, BASE + (c + 1) * STEP)
    }

    await new Promise(resolve => setTimeout(resolve, BASE + COLS * STEP + 80))
    clearInterval(ticker)
  }

  #randomVisual() {
    return SPIN_VISUALS[Math.floor(Math.random() * SPIN_VISUALS.length)]
  }

  highlightWins(winLines) {
    const reelEls = Array.from(this.#container.querySelectorAll('.reel'))

    winLines.forEach(line => {
      const color = WIN_COLOR[line.symbolId] ?? '#c9a24a'
      for (let r = 0; r < line.count; r++) {
        const cell = reelEls[r]?.querySelectorAll('.cell')[line.reelRows[r]]
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
      cell.style.removeProperty('--win-color')
      cell.style.removeProperty('border-color')
      cell.style.removeProperty('box-shadow')
    })
  }

  showWin(amount, winLines, label = null) {
    this.#winLabel.textContent  = label ?? (winLines?.some(l => l.count >= 5) ? 'GROS GAIN' : 'GAIN')
    this.#winAmount.textContent = `+$${amount.toFixed(2)}`

    if (winLines?.length) {
      const best = winLines.reduce((a, b) => b.count > a.count ? b : a)
      const v = VISUAL[best.symbolId]
      this.#winDetail.textContent = v ? `${best.count} × ${v.text}` : ''
    } else {
      this.#winDetail.textContent = ''
    }

    this.#winOverlay.classList.remove('hidden')
  }

  hideWin() { this.#winOverlay.classList.add('hidden') }

  showGameOver(text) {
    this.#gameOverText.textContent = text
    this.#gameOverOverlay.classList.remove('hidden')
  }

  hideGameOver() { this.#gameOverOverlay.classList.add('hidden') }

  // Update all modifier badges (column multipliers, wild columns, symbol multipliers)
  showModifiers(modifiers = {}) {
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
  selectColumn() {
    return new Promise((resolve, reject) => {
      const reelEls = Array.from(this.#container.querySelectorAll('.reel'))
      const spinBtn = document.getElementById('spin-btn')

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

      const handlers = []

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

      const onEsc = (e) => { if (e.key === 'Escape') cleanup(true) }
      document.addEventListener('keydown', onEsc, { once: true })

      const onCancel = () => cleanup(true)
      this.#selectionCancel.addEventListener('click', onCancel, { once: true })
    })
  }

  // Interactive symbol selection — returns Promise<string> (symbol id)
  selectSymbol() {
    return new Promise((resolve, reject) => {
      const cells = Array.from(this.#container.querySelectorAll('.cell'))
      const spinBtn = document.getElementById('spin-btn')

      this.#selectionHint.textContent = 'CLIQUER SUR UN SYMBOLE'
      this.#selectionHint.classList.remove('hidden')
      this.#selectionCancel.classList.remove('hidden')
      if (spinBtn) spinBtn.disabled = true

      // Build flat grid positions → symbol ids
      const flatSymbols = this.#currentGrid
        ? this.#currentGrid.flat().map(s => s.id)
        : []

      const handlers = []
      let resolved = false

      const cleanup = (cancelled = false) => {
        this.#selectionHint.classList.add('hidden')
        this.#selectionCancel.classList.add('hidden')
        cells.forEach((cell, i) => {
          cell.classList.remove('sym-selectable')
          cell.removeEventListener('click', handlers[i])
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

      const onEsc = (e) => { if (e.key === 'Escape') cleanup(true) }
      document.addEventListener('keydown', onEsc, { once: true })

      const onCancel = () => cleanup(true)
      this.#selectionCancel.addEventListener('click', onCancel, { once: true })
    })
  }
}
