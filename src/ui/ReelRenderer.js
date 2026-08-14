import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import { SYMBOLS } from '../game/Symbols.js'

const REEL_WIDTH   = 110
const SYMBOL_HEIGHT = 82
const REEL_GAP     = 14
const SLOT_TOP     = 25
const SLOT_HEIGHT  = 595   // 750 - 130 (HUD) - 25 (top pad)

// Center 6 reels in the left 900px (right 300px reserved for shop slide-in)
const TOTAL_W = 6 * REEL_WIDTH + 5 * REEL_GAP  // 730
const START_X = Math.round((900 - TOTAL_W) / 2) // ~85

const SYMBOL_STYLE = new TextStyle({
  fontSize: 46,
  align: 'center',
})

export class ReelRenderer {
  #app
  #container
  #reelContainers = []
  #reelYStarts = []
  #highlightLayer
  #winLineLayer

  constructor(app) {
    this.#app = app
    this.#container = new Container()
    this.#highlightLayer = new Graphics()
    this.#winLineLayer   = new Graphics()
    this.#container.addChild(this.#highlightLayer)
    this.#container.addChild(this.#winLineLayer)
  }

  get container() { return this.#container }

  displayGrid(grid) {
    this.#clearReels()
    this.#reelYStarts = []

    grid.forEach((col, reelIdx) => {
      const reelH = col.length * SYMBOL_HEIGHT
      const reelX = START_X + reelIdx * (REEL_WIDTH + REEL_GAP)
      // Vertically center each reel column in the slot area
      const reelY = SLOT_TOP + Math.round((SLOT_HEIGHT - reelH) / 2)

      const rc = new Container()
      rc.x = reelX
      rc.y = reelY
      this.#reelYStarts.push(reelY)

      // Reel background
      const bg = new Graphics()
      bg.roundRect(0, 0, REEL_WIDTH, reelH, 10)
      bg.fill({ color: 0x16163a, alpha: 0.9 })
      rc.addChild(bg)

      // Subtle column separator line on left edge (except first)
      if (reelIdx > 0) {
        const sep = new Graphics()
        sep.moveTo(-REEL_GAP / 2, 0).lineTo(-REEL_GAP / 2, reelH)
        sep.stroke({ color: 0x2a2a60, width: 1, alpha: 0.5 })
        rc.addChild(sep)
      }

      col.forEach((symbol, rowIdx) => {
        const cell = new Container()
        cell.y = rowIdx * SYMBOL_HEIGHT

        const cellBg = new Graphics()
        cellBg.roundRect(3, 3, REEL_WIDTH - 6, SYMBOL_HEIGHT - 6, 8)
        cellBg.fill({ color: 0x20205a, alpha: 0.95 })
        rc.addChild(cellBg)

        const emoji = new Text({ text: symbol.emoji, style: SYMBOL_STYLE })
        emoji.anchor.set(0.5)
        emoji.x = REEL_WIDTH / 2
        emoji.y = cell.y + SYMBOL_HEIGHT / 2
        rc.addChild(emoji)
      })

      this.#reelContainers.push(rc)
      this.#container.addChild(rc)
    })

    // Keep highlight/win layers on top
    this.#container.removeChild(this.#highlightLayer)
    this.#container.removeChild(this.#winLineLayer)
    this.#container.addChild(this.#highlightLayer)
    this.#container.addChild(this.#winLineLayer)
  }

  async animateSpin(finalGrid) {
    this.#container.alpha = 0.25
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
        const rc = this.#reelContainers[reel]
        const reelY = this.#reelYStarts[reel]
        if (!rc) continue

        const rowIdx = line.reelRows ? line.reelRows[reel] : 0
        const x = START_X + reel * (REEL_WIDTH + REEL_GAP)
        const y = reelY + rowIdx * SYMBOL_HEIGHT

        // Golden glow fill on winning cell
        this.#highlightLayer.roundRect(x + 3, y + 3, REEL_WIDTH - 6, SYMBOL_HEIGHT - 6, 8)
        this.#highlightLayer.fill({ color, alpha: 0.22 })

        // Bright border on winning cell
        this.#highlightLayer.roundRect(x + 2, y + 2, REEL_WIDTH - 4, SYMBOL_HEIGHT - 4, 9)
        this.#highlightLayer.stroke({ color, width: 3, alpha: 1 })

        // Center point for connecting line
        points.push({
          x: x + REEL_WIDTH / 2,
          y: reelY + rowIdx * SYMBOL_HEIGHT + SYMBOL_HEIGHT / 2,
        })
      }

      // Draw connecting line through winning cells
      if (points.length >= 2) {
        this.#winLineLayer.moveTo(points[0].x, points[0].y)
        for (let i = 1; i < points.length; i++) {
          this.#winLineLayer.lineTo(points[i].x, points[i].y)
        }
        this.#winLineLayer.stroke({ color, width: 3, alpha: 0.75 })

        // Dot at each cell center
        for (const pt of points) {
          this.#winLineLayer.circle(pt.x, pt.y, 7)
          this.#winLineLayer.fill({ color, alpha: 0.95 })
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
    this.#highlightLayer.clear()
    this.#winLineLayer.clear()
  }
}

// Visual testing: see npm run dev
