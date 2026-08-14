import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import { SYMBOLS } from '../game/Symbols.js'

const REEL_WIDTH   = 110
const REEL_GAP     = 14
const SLOT_TOP     = 45   // 25px reserved above reels for column badge strip
const SLOT_HEIGHT  = 575  // 45+575=620, same bottom edge as before

// 6 reels in 800px wide area; 70px left margin for symbol-multiplier badges
const TOTAL_W = 6 * REEL_WIDTH + 5 * REEL_GAP  // 730
const START_X = 70

const SYMBOL_STYLE = new TextStyle({ fontSize: 42, align: 'center' })

export class ReelRenderer {
  #app
  #container
  #reelContainers = []
  #reelCellHeights = []
  #modifierContainer   // badge backgrounds + text — survives displayGrid clears
  #highlightLayer
  #winLineLayer

  constructor(app) {
    this.#app = app
    this.#container = new Container()
    this.#modifierContainer = new Container()
    this.#highlightLayer    = new Graphics()
    this.#winLineLayer      = new Graphics()
    // Added in correct order; displayGrid/showModifiers re-push to keep them on top
    this.#container.addChild(this.#modifierContainer)
    this.#container.addChild(this.#highlightLayer)
    this.#container.addChild(this.#winLineLayer)
  }

  get container() { return this.#container }

  displayGrid(grid) {
    this.#clearReels()
    this.#reelCellHeights = []

    grid.forEach((col, reelIdx) => {
      const cellH = Math.floor(SLOT_HEIGHT / col.length)
      this.#reelCellHeights.push(cellH)

      const reelX = START_X + reelIdx * (REEL_WIDTH + REEL_GAP)
      const rc = new Container()
      rc.x = reelX
      rc.y = SLOT_TOP

      const bg = new Graphics()
      bg.roundRect(0, 0, REEL_WIDTH, SLOT_HEIGHT, 10)
      bg.fill({ color: 0x12122e, alpha: 0.92 })
      rc.addChild(bg)

      col.forEach((symbol, rowIdx) => {
        const cellY = rowIdx * cellH

        const cellBg = new Graphics()
        cellBg.roundRect(3, cellY + 3, REEL_WIDTH - 6, cellH - 6, 8)
        cellBg.fill({ color: 0x1e1e50, alpha: 0.95 })
        rc.addChild(cellBg)

        if (rowIdx > 0) {
          const div = new Graphics()
          div.moveTo(6, cellY).lineTo(REEL_WIDTH - 6, cellY)
          div.stroke({ color: 0x2a2a60, width: 1, alpha: 0.4 })
          rc.addChild(div)
        }

        const emoji = new Text({ text: symbol.emoji, style: SYMBOL_STYLE })
        emoji.anchor.set(0.5)
        emoji.x = REEL_WIDTH / 2
        emoji.y = cellY + cellH / 2
        rc.addChild(emoji)
      })

      this.#reelContainers.push(rc)
      this.#container.addChild(rc)
    })

    // Keep overlay layers above the newly added reel containers
    this.#container.removeChild(this.#modifierContainer)
    this.#container.removeChild(this.#highlightLayer)
    this.#container.removeChild(this.#winLineLayer)
    this.#container.addChild(this.#modifierContainer)
    this.#container.addChild(this.#highlightLayer)
    this.#container.addChild(this.#winLineLayer)
  }

  showModifiers(modifiers) {
    // Destroy previous badges
    this.#modifierContainer.removeChildren().forEach(c => c.destroy())

    const { columnMultipliers, wildColumns, symbolMultipliers, globalMultiplier } = modifiers
    const g = new Graphics()
    this.#modifierContainer.addChild(g)

    // --- Column badges (above each reel) ---
    for (let reel = 0; reel < 6; reel++) {
      const isWild = wildColumns[reel]
      const mult   = columnMultipliers[reel]
      if (!isWild && mult <= 1) continue

      const bx    = START_X + reel * (REEL_WIDTH + REEL_GAP)
      const color = isWild ? 0xFFFFFF : 0xFFDD00
      const label = isWild ? '⚡WILD' : `×${mult}`

      g.roundRect(bx + 2, 7, REEL_WIDTH - 4, 30, 6)
      g.fill({ color, alpha: 0.18 })
      g.roundRect(bx + 2, 7, REEL_WIDTH - 4, 30, 6)
      g.stroke({ color, width: 1.5 })

      const t = new Text({ text: label, style: new TextStyle({
        fontSize: 14, fill: color, fontFamily: 'monospace', fontWeight: 'bold', align: 'center',
      })})
      t.anchor.set(0.5)
      t.x = bx + REEL_WIDTH / 2
      t.y = 22
      this.#modifierContainer.addChild(t)
    }

    // --- Symbol-multiplier badges (left of reels) ---
    let by = SLOT_TOP + 5
    for (const [symbolId, mult] of Object.entries(symbolMultipliers)) {
      if (mult <= 1) continue
      const sym = SYMBOLS.find(s => s.id === symbolId)
      if (!sym) continue
      const label = `${sym.emoji}×${Number.isInteger(mult) ? mult : mult.toFixed(1)}`
      const color = sym.color

      g.roundRect(3, by, 63, 26, 5)
      g.fill({ color, alpha: 0.18 })
      g.roundRect(3, by, 63, 26, 5)
      g.stroke({ color, width: 1.5 })

      const t = new Text({ text: label, style: new TextStyle({
        fontSize: 13, fill: color, fontFamily: 'monospace', fontWeight: 'bold',
      })})
      t.x = 6
      t.y = by + 5
      this.#modifierContainer.addChild(t)
      by += 32
    }

    if (globalMultiplier > 1) {
      const color = 0xFF8C00
      g.roundRect(3, by, 63, 26, 5)
      g.fill({ color, alpha: 0.22 })
      g.roundRect(3, by, 63, 26, 5)
      g.stroke({ color, width: 1.5 })

      const t = new Text({ text: `×${globalMultiplier} ALL`, style: new TextStyle({
        fontSize: 13, fill: color, fontFamily: 'monospace', fontWeight: 'bold',
      })})
      t.x = 6
      t.y = by + 5
      this.#modifierContainer.addChild(t)
    }

    // Keep modifier container above reels but below highlight/win layers
    this.#container.removeChild(this.#modifierContainer)
    this.#container.removeChild(this.#highlightLayer)
    this.#container.removeChild(this.#winLineLayer)
    this.#container.addChild(this.#modifierContainer)
    this.#container.addChild(this.#highlightLayer)
    this.#container.addChild(this.#winLineLayer)
  }

  async animateSpin(finalGrid) {
    this.#container.alpha = 0.2
    let elapsed = 0
    const interval = 80

    await new Promise(resolve => {
      const ticker = setInterval(() => {
        const fakeGrid = finalGrid.map(col =>
          col.map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)])
        )
        this.displayGrid(fakeGrid)
        this.#container.alpha = 0.9
        elapsed += interval
        if (elapsed >= 800) {
          clearInterval(ticker)
          this.#container.alpha = 1
          resolve()
        }
      }, interval)
    })

    this.displayGrid(finalGrid)
  }

  highlightWins(winLines) {
    this.#highlightLayer.clear()
    this.#winLineLayer.clear()

    const colors = [0xFFDD00, 0xFF6B6B, 0x00E5FF, 0xAA88FF]

    winLines.forEach((line, lineIdx) => {
      const color = colors[lineIdx % colors.length]
      const points = []

      for (let reel = 0; reel < line.count; reel++) {
        const cellH = this.#reelCellHeights[reel]
        if (!cellH) continue

        const rowIdx = line.reelRows ? line.reelRows[reel] : 0
        const x = START_X + reel * (REEL_WIDTH + REEL_GAP)
        const y = SLOT_TOP + rowIdx * cellH

        this.#highlightLayer.roundRect(x + 2, y + 2, REEL_WIDTH - 4, cellH - 4, 8)
        this.#highlightLayer.fill({ color, alpha: 0.25 })
        this.#highlightLayer.roundRect(x + 2, y + 2, REEL_WIDTH - 4, cellH - 4, 8)
        this.#highlightLayer.stroke({ color, width: 3, alpha: 1 })

        points.push({ x: x + REEL_WIDTH / 2, y: y + cellH / 2 })
      }

      if (points.length >= 2) {
        this.#winLineLayer.moveTo(points[0].x, points[0].y)
        for (let i = 1; i < points.length; i++) {
          this.#winLineLayer.lineTo(points[i].x, points[i].y)
        }
        this.#winLineLayer.stroke({ color, width: 3, alpha: 0.8 })

        for (const pt of points) {
          this.#winLineLayer.circle(pt.x, pt.y, 7)
          this.#winLineLayer.fill({ color, alpha: 1 })
        }
      }
    })
  }

  clearHighlights() {
    this.#highlightLayer.clear()
    this.#winLineLayer.clear()
  }

  #clearReels() {
    for (const rc of this.#reelContainers) {
      this.#container.removeChild(rc)
      rc.destroy({ children: true })
    }
    this.#reelContainers = []
    this.#reelCellHeights = []
    this.#highlightLayer.clear()
    this.#winLineLayer.clear()
  }
}
