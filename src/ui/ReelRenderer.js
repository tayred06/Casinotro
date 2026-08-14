import { Container, Graphics, Text, TextStyle } from 'pixi.js'

const REEL_WIDTH = 120
const SYMBOL_HEIGHT = 90
const REEL_GAP = 10
const START_X = 60
const START_Y = 80

const SYMBOL_STYLE = new TextStyle({
  fontSize: 48,
  fill: 0xFFFFFF,
  align: 'center',
})

export class ReelRenderer {
  #app
  #container
  #reelContainers = []
  #highlightGraphics

  constructor(app) {
    this.#app = app
    this.#container = new Container()
    this.#highlightGraphics = new Graphics()
    this.#container.addChild(this.#highlightGraphics)
  }

  get container() { return this.#container }

  displayGrid(grid, rowCounts) {
    this.#clearReels()
    grid.forEach((col, reelIdx) => {
      const reelContainer = new Container()
      reelContainer.x = START_X + reelIdx * (REEL_WIDTH + REEL_GAP)
      reelContainer.y = START_Y

      const bg = new Graphics()
      bg.roundRect(0, 0, REEL_WIDTH, col.length * SYMBOL_HEIGHT, 8)
      bg.fill({ color: 0x1a1a3e, alpha: 0.8 })
      reelContainer.addChild(bg)

      col.forEach((symbol, rowIdx) => {
        const cell = new Container()
        cell.y = rowIdx * SYMBOL_HEIGHT

        const cellBg = new Graphics()
        cellBg.roundRect(2, 2, REEL_WIDTH - 4, SYMBOL_HEIGHT - 4, 6)
        cellBg.fill({ color: 0x2a2a5e, alpha: 0.9 })
        cell.addChild(cellBg)

        const emoji = new Text({ text: symbol.emoji, style: SYMBOL_STYLE })
        emoji.anchor.set(0.5)
        emoji.x = REEL_WIDTH / 2
        emoji.y = SYMBOL_HEIGHT / 2
        cell.addChild(emoji)

        reelContainer.addChild(cell)
      })

      this.#container.addChild(reelContainer)
      this.#reelContainers.push(reelContainer)
    })
  }

  async animateSpin(finalGrid, rowCounts) {
    // Phase 1 : masquer les reels (fondu)
    for (const rc of this.#reelContainers) rc.alpha = 0.3

    // Phase 2 : afficher symboles intermédiaires aléatoires pendant 800ms
    let elapsed = 0
    const interval = 80
    await new Promise(resolve => {
      const ticker = setInterval(() => {
        const fakeGrid = finalGrid.map((col, reel) =>
          col.map(() => {
            const symbols = ['🍋','🍇','🔔','💎','⭐','🐕','🃏']
            return { emoji: symbols[Math.floor(Math.random() * symbols.length)], id: 'spin' }
          })
        )
        this.displayGrid(fakeGrid, rowCounts)
        elapsed += interval
        if (elapsed >= 800) {
          clearInterval(ticker)
          resolve()
        }
      }, interval)
    })

    // Phase 3 : afficher le résultat final
    this.displayGrid(finalGrid, rowCounts)
    for (const rc of this.#reelContainers) rc.alpha = 1
  }

  highlightWins(winLines) {
    this.#highlightGraphics.clear()
    for (const line of winLines) {
      for (let reel = 0; reel < line.count; reel++) {
        const x = START_X + reel * (REEL_WIDTH + REEL_GAP) - 3
        const reelContainer = this.#reelContainers[reel]
        if (!reelContainer) continue
        const h = reelContainer.children.length > 1
          ? (reelContainer.children.length - 1) * SYMBOL_HEIGHT
          : SYMBOL_HEIGHT
        this.#highlightGraphics.roundRect(x, START_Y - 3, REEL_WIDTH + 6, h + 6, 10)
        this.#highlightGraphics.stroke({ color: 0xFFDD00, width: 3, alpha: 0.9 })
      }
    }
  }

  clearHighlights() {
    this.#highlightGraphics.clear()
  }

  #clearReels() {
    for (const rc of this.#reelContainers) {
      this.#container.removeChild(rc)
      rc.destroy({ children: true })
    }
    this.#reelContainers = []
    this.#highlightGraphics.clear()
  }
}

// Visual testing: see npm run dev
