import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import { SYMBOLS } from '../game/Symbols.js'

const REEL_WIDTH   = 110
const REEL_GAP     = 14
const SLOT_TOP     = 20
const SLOT_HEIGHT  = 600   // 750 - 130 (HUD) - 20 (top pad)

// Center 6 reels in the left 900px (right 300px reserved for shop)
const TOTAL_W = 6 * REEL_WIDTH + 5 * REEL_GAP  // 730
const START_X = Math.round((900 - TOTAL_W) / 2) // ~85

const SYMBOL_STYLE = new TextStyle({ fontSize: 42, align: 'center' })

export class ReelRenderer {
  #app
  #container
  #reelContainers = []
  #reelCellHeights = []   // cell height per reel (varies with row count)
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
    this.#reelCellHeights = []

    grid.forEach((col, reelIdx) => {
      // All reels share the same height — cells scale to fill it
      const cellH = Math.floor(SLOT_HEIGHT / col.length)
      this.#reelCellHeights.push(cellH)

      const reelX = START_X + reelIdx * (REEL_WIDTH + REEL_GAP)
      const rc = new Container()
      rc.x = reelX
      rc.y = SLOT_TOP

      // Reel background (full slot height)
      const bg = new Graphics()
      bg.roundRect(0, 0, REEL_WIDTH, SLOT_HEIGHT, 10)
      bg.fill({ color: 0x12122e, alpha: 0.92 })
      rc.addChild(bg)

      col.forEach((symbol, rowIdx) => {
        const cellY = rowIdx * cellH

        // Cell background — offset by cellY
        const cellBg = new Graphics()
        cellBg.roundRect(3, cellY + 3, REEL_WIDTH - 6, cellH - 6, 8)
        cellBg.fill({ color: 0x1e1e50, alpha: 0.95 })
        rc.addChild(cellBg)

        // Subtle divider between cells
        if (rowIdx > 0) {
          const div = new Graphics()
          div.moveTo(6, cellY).lineTo(REEL_WIDTH - 6, cellY)
          div.stroke({ color: 0x2a2a60, width: 1, alpha: 0.4 })
          rc.addChild(div)
        }

        // Emoji — anchored to center of cell
        const emoji = new Text({ text: symbol.emoji, style: SYMBOL_STYLE })
        emoji.anchor.set(0.5)
        emoji.x = REEL_WIDTH / 2
        emoji.y = cellY + cellH / 2
        rc.addChild(emoji)
      })

      this.#reelContainers.push(rc)
      this.#container.addChild(rc)
    })

    // Keep overlay layers on top
    this.#container.removeChild(this.#highlightLayer)
    this.#container.removeChild(this.#winLineLayer)
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

        // Highlight the winning cell
        this.#highlightLayer.roundRect(x + 2, y + 2, REEL_WIDTH - 4, cellH - 4, 8)
        this.#highlightLayer.fill({ color, alpha: 0.25 })
        this.#highlightLayer.roundRect(x + 2, y + 2, REEL_WIDTH - 4, cellH - 4, 8)
        this.#highlightLayer.stroke({ color, width: 3, alpha: 1 })

        points.push({ x: x + REEL_WIDTH / 2, y: y + cellH / 2 })
      }

      // Connecting line through cell centers
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

// Visual testing: see npm run dev
