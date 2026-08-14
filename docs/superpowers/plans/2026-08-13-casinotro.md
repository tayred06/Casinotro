# Casinotro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire un jeu de machine à sous roguelike jouable dans le navigateur, avec 6 rouleaux style Megaways, un système de bonus stratégiques achetables, et une économie mono-monnaie.

**Architecture:** La logique du jeu (`src/game/`) est entièrement découplée du rendu PixiJS (`src/ui/`). Les modules game exposent des données pures; les modules ui les consomment pour afficher. Le point d'entrée `src/main.js` instancie tout et orchestre la boucle de jeu.

**Tech Stack:** PixiJS v8 (rendu canvas), Vite (bundler + dev server), Vitest (tests unitaires), JS ESModules vanilla

## Global Constraints

- Node.js >= 18
- PixiJS v8 uniquement (API différente de v7 — utiliser `app.init()` async, `app.canvas` au lieu de `app.view`)
- Vitest pour les tests des modules `game/` uniquement — les modules `ui/` sont testés manuellement
- Pas de framework CSS — styles inline dans le HTML ou via PixiJS Graphics
- Symboles représentés par des emojis en `Text` PixiJS pour l'instant (assets visuels hors scope)
- Pas de backend — persistance via `localStorage` uniquement
- Devise unique : `$` (dollars)

---

## Fichiers à créer

```
casinotro/
├── index.html                        — point d'entrée HTML, monte le canvas
├── package.json                      — dépendances: pixi.js, vite, vitest
├── vite.config.js                    — config Vite + Vitest
├── src/
│   ├── main.js                       — init PixiJS, orchestration boucle de jeu
│   ├── utils/
│   │   ├── Random.js                 — weightedRandom, randomInt, shuffleArray
│   │   └── Random.test.js
│   ├── game/
│   │   ├── Symbols.js                — définitions symboles, poids, multiplicateurs
│   │   ├── Symbols.test.js
│   │   ├── SlotMachine.js            — spin(), calculateWins()
│   │   ├── SlotMachine.test.js
│   │   ├── Economy.js                — balance, mises, boutique, highscore
│   │   ├── Economy.test.js
│   │   ├── BonusSystem.js            — pool bonus, actifs, modificateurs
│   │   └── BonusSystem.test.js
│   └── ui/
│       ├── ReelRenderer.js           — rendu PixiJS des 6 rouleaux + animation
│       ├── HUD.js                    — balance, sélecteur mise, bouton spin
│       └── ShopUI.js                 — panneau boutique, achat/vente bonus
```

---

## Task 1: Project Setup

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `index.html`
- Create: `src/main.js`

**Interfaces:**
- Produces: `npm run dev` démarre un serveur sur http://localhost:5173 avec une page noire

- [ ] **Step 1: Créer `package.json`**

```json
{
  "name": "casinotro",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "pixi.js": "^8.0.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

- [ ] **Step 2: Créer `vite.config.js`**

```js
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    environment: 'node',
  },
})
```

- [ ] **Step 3: Créer `index.html`**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Casinotro</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0a0a1a; display: flex; justify-content: center; align-items: center; height: 100vh; overflow: hidden; }
    canvas { display: block; }
  </style>
</head>
<body>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 4: Créer `src/main.js` (placeholder)**

```js
import { Application } from 'pixi.js'

const app = new Application()
await app.init({
  width: 1200,
  height: 750,
  backgroundColor: 0x0a0a1a,
  antialias: true,
})
document.body.appendChild(app.canvas)
```

- [ ] **Step 5: Installer les dépendances et vérifier**

```bash
npm install
npm run dev
```

Expected: navigateur affiche une page noire sans erreur console.

- [ ] **Step 6: Commit**

```bash
git init
git add .
git commit -m "feat: project setup — vite + pixi.js + vitest"
```

---

## Task 2: Random Utilities

**Files:**
- Create: `src/utils/Random.js`
- Create: `src/utils/Random.test.js`

**Interfaces:**
- Produces:
  - `weightedRandom(items: Array<{value: any, weight: number}>): any`
  - `randomInt(min: number, max: number): number` (inclusive)
  - `shuffleArray(arr: any[]): any[]` (retourne une copie)

- [ ] **Step 1: Écrire les tests**

```js
// src/utils/Random.test.js
import { describe, it, expect } from 'vitest'
import { weightedRandom, randomInt, shuffleArray } from './Random.js'

describe('weightedRandom', () => {
  it('retourne toujours une valeur de la liste', () => {
    const items = [
      { value: 'a', weight: 10 },
      { value: 'b', weight: 5 },
    ]
    for (let i = 0; i < 100; i++) {
      const result = weightedRandom(items)
      expect(['a', 'b']).toContain(result)
    }
  })

  it('retourne la seule valeur si weight = 0 pour les autres', () => {
    const items = [
      { value: 'a', weight: 100 },
      { value: 'b', weight: 0 },
    ]
    for (let i = 0; i < 20; i++) {
      expect(weightedRandom(items)).toBe('a')
    }
  })
})

describe('randomInt', () => {
  it('retourne un entier dans [min, max]', () => {
    for (let i = 0; i < 200; i++) {
      const n = randomInt(3, 7)
      expect(n).toBeGreaterThanOrEqual(3)
      expect(n).toBeLessThanOrEqual(7)
      expect(Number.isInteger(n)).toBe(true)
    }
  })

  it('retourne min quand min === max', () => {
    expect(randomInt(5, 5)).toBe(5)
  })
})

describe('shuffleArray', () => {
  it('retourne un tableau de même longueur avec les mêmes éléments', () => {
    const arr = [1, 2, 3, 4, 5]
    const result = shuffleArray(arr)
    expect(result).toHaveLength(arr.length)
    expect(result.sort()).toEqual([...arr].sort())
  })

  it('ne modifie pas le tableau original', () => {
    const arr = [1, 2, 3]
    shuffleArray(arr)
    expect(arr).toEqual([1, 2, 3])
  })
})
```

- [ ] **Step 2: Vérifier que les tests échouent**

```bash
npm test
```

Expected: `Cannot find module './Random.js'`

- [ ] **Step 3: Implémenter `src/utils/Random.js`**

```js
export function weightedRandom(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0)
  let rand = Math.random() * total
  for (const item of items) {
    rand -= item.weight
    if (rand <= 0) return item.value
  }
  return items[items.length - 1].value
}

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function shuffleArray(arr) {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
```

- [ ] **Step 4: Vérifier que les tests passent**

```bash
npm test
```

Expected: `3 tests passed`

- [ ] **Step 5: Commit**

```bash
git add src/utils/
git commit -m "feat: random utilities — weightedRandom, randomInt, shuffleArray"
```

---

## Task 3: Symbol Definitions

**Files:**
- Create: `src/game/Symbols.js`
- Create: `src/game/Symbols.test.js`

**Interfaces:**
- Produces:
  - `SYMBOLS: Symbol[]` — tableau complet de tous les symboles
  - `WIN_SYMBOLS: Symbol[]` — SYMBOLS sans wild et scatter
  - `WILD: Symbol` — le symbole wild
  - `SCATTER: Symbol` — le symbole scatter
  - `WIN_MULTIPLIERS: {3: 0.5, 4: 2, 5: 5, 6: 20}`
  - `getSymbolById(id: string): Symbol | undefined`
  - `generateReelColumn(rowCount: number): Symbol[]` — colonne aléatoire pondérée

  Où `Symbol = { id: string, name: string, emoji: string, weight: number, color: number }`

- [ ] **Step 1: Écrire les tests**

```js
// src/game/Symbols.test.js
import { describe, it, expect } from 'vitest'
import { SYMBOLS, WIN_SYMBOLS, WILD, SCATTER, WIN_MULTIPLIERS, getSymbolById, generateReelColumn } from './Symbols.js'

describe('SYMBOLS', () => {
  it('contient 8 symboles', () => {
    expect(SYMBOLS).toHaveLength(8)
  })

  it('chaque symbole a les champs requis', () => {
    for (const s of SYMBOLS) {
      expect(s).toHaveProperty('id')
      expect(s).toHaveProperty('name')
      expect(s).toHaveProperty('emoji')
      expect(typeof s.weight).toBe('number')
      expect(s.weight).toBeGreaterThan(0)
      expect(typeof s.color).toBe('number')
    }
  })
})

describe('WIN_SYMBOLS', () => {
  it('exclut wild et scatter', () => {
    const ids = WIN_SYMBOLS.map(s => s.id)
    expect(ids).not.toContain('wild')
    expect(ids).not.toContain('scatter')
    expect(WIN_SYMBOLS).toHaveLength(6)
  })
})

describe('WIN_MULTIPLIERS', () => {
  it('a les 4 paliers définis', () => {
    expect(WIN_MULTIPLIERS[3]).toBe(0.5)
    expect(WIN_MULTIPLIERS[4]).toBe(2)
    expect(WIN_MULTIPLIERS[5]).toBe(5)
    expect(WIN_MULTIPLIERS[6]).toBe(20)
  })
})

describe('getSymbolById', () => {
  it('retrouve un symbole existant', () => {
    expect(getSymbolById('lemon').name).toBe('Citron')
  })

  it('retourne undefined pour un id inconnu', () => {
    expect(getSymbolById('xyz')).toBeUndefined()
  })
})

describe('generateReelColumn', () => {
  it('retourne le bon nombre de symboles', () => {
    expect(generateReelColumn(4)).toHaveLength(4)
    expect(generateReelColumn(7)).toHaveLength(7)
  })

  it('retourne uniquement des Symbol valides', () => {
    const col = generateReelColumn(5)
    const validIds = SYMBOLS.map(s => s.id)
    for (const sym of col) {
      expect(validIds).toContain(sym.id)
    }
  })
})
```

- [ ] **Step 2: Vérifier que les tests échouent**

```bash
npm test
```

Expected: `Cannot find module './Symbols.js'`

- [ ] **Step 3: Implémenter `src/game/Symbols.js`**

```js
import { weightedRandom } from '../utils/Random.js'

export const SYMBOLS = [
  { id: 'lemon',   name: 'Citron',  emoji: '🍋', weight: 30, color: 0xFFDD00 },
  { id: 'grape',   name: 'Raisin',  emoji: '🍇', weight: 25, color: 0x9B30FF },
  { id: 'bell',    name: 'Cloche',  emoji: '🔔', weight: 18, color: 0xFF8C00 },
  { id: 'diamond', name: 'Diamant', emoji: '💎', weight: 12, color: 0x00E5FF },
  { id: 'star',    name: 'Étoile',  emoji: '⭐', weight: 8,  color: 0xFFD700 },
  { id: 'dog',     name: 'Chien',   emoji: '🐕', weight: 4,  color: 0xFF6B6B },
  { id: 'wild',    name: 'Wild',    emoji: '🃏', weight: 3,  color: 0xFFFFFF },
  { id: 'scatter', name: 'Scatter', emoji: '💫', weight: 2,  color: 0xFF69B4 },
]

export const WIN_SYMBOLS = SYMBOLS.filter(s => s.id !== 'wild' && s.id !== 'scatter')
export const WILD = SYMBOLS.find(s => s.id === 'wild')
export const SCATTER = SYMBOLS.find(s => s.id === 'scatter')

export const WIN_MULTIPLIERS = { 3: 0.5, 4: 2, 5: 5, 6: 20 }

export function getSymbolById(id) {
  return SYMBOLS.find(s => s.id === id)
}

export function generateReelColumn(rowCount) {
  const pool = SYMBOLS.map(s => ({ value: s, weight: s.weight }))
  return Array.from({ length: rowCount }, () => weightedRandom(pool))
}
```

- [ ] **Step 4: Vérifier que les tests passent**

```bash
npm test
```

Expected: tous les tests `Symbols` passent.

- [ ] **Step 5: Commit**

```bash
git add src/game/Symbols.js src/game/Symbols.test.js
git commit -m "feat: symbol definitions — 8 symbols, weights, win multipliers"
```

---

## Task 4: SlotMachine Logic

**Files:**
- Create: `src/game/SlotMachine.js`
- Create: `src/game/SlotMachine.test.js`

**Interfaces:**
- Consumes: `generateReelColumn` de Symbols.js, `randomInt` de Random.js
- Produces:
  - `spin(stickyPositions?: {[key: string]: Symbol}): SpinResult`
  - `calculateWins(grid: Symbol[][], bet: number, modifiers?: BonusModifiers): WinResult`

  Où :
  ```
  SpinResult = { grid: Symbol[][], rowCounts: number[] }
  // grid[reel][row] = Symbol, 6 reels, 2-7 rows each

  WinLine = {
    symbolId: string,
    count: number,       // nombre de reels consécutifs (3-6)
    multiplier: number,  // multiplicateur final appliqué (bonus inclus)
    win: number,         // gain en $
  }

  WinResult = {
    totalWin: number,
    winLines: WinLine[],
    scatterTriggered: boolean,
    dropBonus: boolean,
  }

  BonusModifiers = {
    columnMultipliers?: number[],   // longueur 6, défaut 1.0
    wildColumns?: boolean[],        // longueur 6, défaut false
    symbolMultipliers?: {[id: string]: number},
    jackpotMultiplier?: number,     // défaut 20
    safetyNet?: boolean,            // défaut false
    globalMultiplier?: number,      // défaut 1.0
  }
  ```

- [ ] **Step 1: Écrire les tests**

```js
// src/game/SlotMachine.test.js
import { describe, it, expect, vi } from 'vitest'
import { spin, calculateWins } from './SlotMachine.js'
import { getSymbolById } from './Symbols.js'

const lemon = getSymbolById('lemon')
const bell  = getSymbolById('bell')
const wild  = getSymbolById('wild')
const scatter = getSymbolById('scatter')

describe('spin', () => {
  it('retourne 6 reels', () => {
    const { grid, rowCounts } = spin()
    expect(grid).toHaveLength(6)
    expect(rowCounts).toHaveLength(6)
  })

  it('chaque reel a entre 2 et 7 symboles', () => {
    const { rowCounts } = spin()
    for (const count of rowCounts) {
      expect(count).toBeGreaterThanOrEqual(2)
      expect(count).toBeLessThanOrEqual(7)
    }
  })

  it('applique les sticky positions', () => {
    const stickyPositions = { '0-0': bell }
    const { grid } = spin(stickyPositions)
    expect(grid[0][0].id).toBe('bell')
  })
})

describe('calculateWins', () => {
  it('détecte 3 symboles identiques consécutifs', () => {
    const grid = [
      [lemon, bell],
      [lemon, bell],
      [lemon, bell],
      [bell, bell],
      [bell, bell],
      [bell, bell],
    ]
    const result = calculateWins(grid, 10)
    expect(result.winLines).toHaveLength(1)
    expect(result.winLines[0].symbolId).toBe('lemon')
    expect(result.winLines[0].count).toBe(3)
    expect(result.totalWin).toBe(10 * 0.5)
  })

  it('détecte 6 symboles identiques (jackpot)', () => {
    const grid = Array(6).fill([lemon, bell])
    const result = calculateWins(grid, 5)
    expect(result.winLines[0].count).toBe(6)
    expect(result.totalWin).toBe(5 * 20)
  })

  it('le Wild complète une combinaison', () => {
    const grid = [
      [lemon],
      [lemon],
      [wild],   // Wild compte comme lemon
      [bell],
      [bell],
      [bell],
    ]
    const result = calculateWins(grid, 10)
    const lemonLine = result.winLines.find(l => l.symbolId === 'lemon')
    expect(lemonLine).toBeDefined()
    expect(lemonLine.count).toBe(3)
  })

  it('pas de gain si moins de 3 reels', () => {
    const grid = [
      [lemon],
      [lemon],
      [bell],
      [bell],
      [bell],
      [bell],
    ]
    const result = calculateWins(grid, 10)
    const lemonLine = result.winLines.find(l => l.symbolId === 'lemon')
    expect(lemonLine).toBeUndefined()
  })

  it('applique le jackpotMultiplier personnalisé', () => {
    const grid = Array(6).fill([lemon])
    const result = calculateWins(grid, 10, { jackpotMultiplier: 50 })
    expect(result.totalWin).toBe(10 * 50)
  })

  it('applique le safetyNet si gain = 0', () => {
    const grid = [
      [lemon],
      [bell],
      [lemon],
      [bell],
      [lemon],
      [bell],
    ]
    const result = calculateWins(grid, 10, { safetyNet: true })
    expect(result.totalWin).toBe(5) // 50% de la mise
  })

  it('détecte le scatter (3+ partout)', () => {
    const grid = [
      [scatter, bell],
      [scatter, bell],
      [scatter, bell],
      [bell, bell],
      [bell, bell],
      [bell, bell],
    ]
    const result = calculateWins(grid, 10)
    expect(result.scatterTriggered).toBe(true)
  })

  it('applique columnMultipliers', () => {
    const grid = [
      [lemon],
      [lemon],
      [lemon],
      [bell],
      [bell],
      [bell],
    ]
    const result = calculateWins(grid, 10, { columnMultipliers: [2, 1, 1, 1, 1, 1] })
    // lemon sur 3 reels (0,1,2) → base 0.5 × bet × colMultiplier[0]=2
    expect(result.totalWin).toBe(10 * 0.5 * 2)
  })

  it('applique symbolMultipliers', () => {
    const grid = [
      [lemon],
      [lemon],
      [lemon],
      [bell],
      [bell],
      [bell],
    ]
    const result = calculateWins(grid, 10, { symbolMultipliers: { lemon: 3 } })
    expect(result.totalWin).toBe(10 * 0.5 * 3)
  })

  it('applique globalMultiplier', () => {
    const grid = [
      [lemon],
      [lemon],
      [lemon],
      [bell],
      [bell],
      [bell],
    ]
    const result = calculateWins(grid, 10, { globalMultiplier: 2 })
    expect(result.totalWin).toBe(10 * 0.5 * 2)
  })
})
```

- [ ] **Step 2: Vérifier que les tests échouent**

```bash
npm test
```

Expected: `Cannot find module './SlotMachine.js'`

- [ ] **Step 3: Implémenter `src/game/SlotMachine.js`**

```js
import { randomInt } from '../utils/Random.js'
import { generateReelColumn, WIN_SYMBOLS, WIN_MULTIPLIERS } from './Symbols.js'

const REEL_COUNT = 6
const MIN_ROWS = 2
const MAX_ROWS = 7

export function spin(stickyPositions = {}) {
  const rowCounts = Array.from({ length: REEL_COUNT }, () => randomInt(MIN_ROWS, MAX_ROWS))
  const grid = rowCounts.map((rowCount, reel) => {
    const col = generateReelColumn(rowCount)
    for (let row = 0; row < rowCount; row++) {
      const key = `${reel}-${row}`
      if (stickyPositions[key]) col[row] = stickyPositions[key]
    }
    return col
  })
  return { grid, rowCounts }
}

export function calculateWins(grid, bet, modifiers = {}) {
  const {
    columnMultipliers = Array(REEL_COUNT).fill(1),
    wildColumns = Array(REEL_COUNT).fill(false),
    symbolMultipliers = {},
    jackpotMultiplier = 20,
    safetyNet = false,
    globalMultiplier = 1,
  } = modifiers

  // Build effective grid with wild columns applied
  const effectiveGrid = grid.map((col, reel) =>
    wildColumns[reel]
      ? col.map(() => ({ id: 'wild', name: 'Wild', emoji: '🃏', weight: 0, color: 0xFFFFFF }))
      : col
  )

  const winLines = []

  for (const symbol of WIN_SYMBOLS) {
    let count = 0
    for (let reel = 0; reel < REEL_COUNT; reel++) {
      const hasMatch = effectiveGrid[reel].some(s => s.id === symbol.id || s.id === 'wild')
      if (!hasMatch) break
      count++
    }

    if (count < 3) continue

    const baseMultiplier = count === 6 ? jackpotMultiplier : WIN_MULTIPLIERS[count]

    // Apply highest column multiplier among winning reels
    let colMult = 1
    for (let reel = 0; reel < count; reel++) {
      if (columnMultipliers[reel] > colMult) colMult = columnMultipliers[reel]
    }

    const symMult = symbolMultipliers[symbol.id] ?? 1
    const totalMultiplier = baseMultiplier * colMult * symMult * globalMultiplier
    const lineWin = bet * totalMultiplier

    winLines.push({ symbolId: symbol.id, count, multiplier: totalMultiplier, win: lineWin })
  }

  // Scatter check
  const scatterCount = grid.flat().filter(s => s.id === 'scatter').length
  const scatterTriggered = scatterCount >= 3

  let totalWin = winLines.reduce((sum, l) => sum + l.win, 0)

  if (totalWin === 0 && safetyNet) {
    totalWin = bet * 0.5
  }

  const hasLargeWin = winLines.some(l => l.count >= 4)
  const dropBonus = hasLargeWin && Math.random() < 0.15

  return { totalWin, winLines, scatterTriggered, dropBonus }
}
```

- [ ] **Step 4: Vérifier que les tests passent**

```bash
npm test
```

Expected: tous les tests `SlotMachine` passent.

- [ ] **Step 5: Commit**

```bash
git add src/game/SlotMachine.js src/game/SlotMachine.test.js
git commit -m "feat: slot machine logic — spin, win calculation, wild/scatter/bonus modifiers"
```

---

## Task 5: Economy

**Files:**
- Create: `src/game/Economy.js`
- Create: `src/game/Economy.test.js`

**Interfaces:**
- Produces: `class Economy` avec :
  - `constructor(startBalance?: number)` — défaut 100
  - `balance: number` (getter)
  - `currentBet: number` (getter)
  - `totalEarned: number` (getter)
  - `highscore: number` (getter)
  - `setBet(amount: number): void`
  - `placeBet(): boolean` — déduit la mise, retourne `false` si solde insuffisant
  - `addWin(amount: number): void` — ajoute au solde, met à jour totalEarned et highscore
  - `getShopLevel(): 1 | 2 | 3`
  - `canAfford(price: number): boolean`
  - `spend(amount: number): boolean` — retourne `false` si solde insuffisant
  - `isGameOver(): boolean`
  - `saveHighscore(): void`
  - `loadHighscore(): void`
  - `BET_OPTIONS: number[]` exporté en constante

- [ ] **Step 1: Écrire les tests**

```js
// src/game/Economy.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { Economy, BET_OPTIONS } from './Economy.js'

describe('BET_OPTIONS', () => {
  it('contient les 5 mises attendues', () => {
    expect(BET_OPTIONS).toEqual([1, 2, 5, 10, 25])
  })
})

describe('Economy', () => {
  let eco

  beforeEach(() => {
    eco = new Economy(100)
    eco.highscore // charger highscore (simulé)
  })

  it('initialise avec le solde de départ', () => {
    expect(eco.balance).toBe(100)
  })

  it('setBet change la mise si elle est dans BET_OPTIONS', () => {
    eco.setBet(5)
    expect(eco.currentBet).toBe(5)
  })

  it('setBet ignore une mise non valide', () => {
    eco.setBet(1)
    eco.setBet(99)
    expect(eco.currentBet).toBe(1)
  })

  it('placeBet déduit la mise', () => {
    eco.setBet(10)
    const result = eco.placeBet()
    expect(result).toBe(true)
    expect(eco.balance).toBe(90)
  })

  it('placeBet retourne false si solde insuffisant', () => {
    const eco2 = new Economy(3)
    eco2.setBet(5)
    expect(eco2.placeBet()).toBe(false)
    expect(eco2.balance).toBe(3)
  })

  it('addWin ajoute au solde', () => {
    eco.addWin(50)
    expect(eco.balance).toBe(150)
  })

  it('addWin met à jour totalEarned', () => {
    eco.addWin(30)
    eco.addWin(20)
    expect(eco.totalEarned).toBe(50)
  })

  it('addWin met à jour highscore si balance dépasse le précédent', () => {
    eco.addWin(500)
    expect(eco.highscore).toBe(600)
  })

  describe('getShopLevel', () => {
    it('niveau 1 si totalEarned < 500', () => {
      expect(eco.getShopLevel()).toBe(1)
    })

    it('niveau 2 si totalEarned entre 500 et 2000', () => {
      eco.addWin(600)
      expect(eco.getShopLevel()).toBe(2)
    })

    it('niveau 3 si totalEarned >= 2000', () => {
      eco.addWin(2500)
      expect(eco.getShopLevel()).toBe(3)
    })
  })

  it('spend déduit le montant et retourne true', () => {
    expect(eco.spend(30)).toBe(true)
    expect(eco.balance).toBe(70)
  })

  it('spend retourne false si solde insuffisant', () => {
    expect(eco.spend(200)).toBe(false)
    expect(eco.balance).toBe(100)
  })

  it('isGameOver retourne true si balance = 0', () => {
    const eco2 = new Economy(0)
    expect(eco2.isGameOver()).toBe(true)
  })

  it('isGameOver retourne false si balance > 0', () => {
    expect(eco.isGameOver()).toBe(false)
  })
})
```

- [ ] **Step 2: Vérifier que les tests échouent**

```bash
npm test
```

Expected: `Cannot find module './Economy.js'`

- [ ] **Step 3: Implémenter `src/game/Economy.js`**

```js
export const BET_OPTIONS = [1, 2, 5, 10, 25]

const HIGHSCORE_KEY = 'casinotro_highscore'

export class Economy {
  #balance
  #currentBet
  #totalEarned
  #highscore

  constructor(startBalance = 100) {
    this.#balance = startBalance
    this.#currentBet = BET_OPTIONS[0]
    this.#totalEarned = 0
    this.#highscore = this.#loadHighscore()
  }

  get balance() { return this.#balance }
  get currentBet() { return this.#currentBet }
  get totalEarned() { return this.#totalEarned }
  get highscore() { return this.#highscore }

  setBet(amount) {
    if (BET_OPTIONS.includes(amount)) this.#currentBet = amount
  }

  placeBet() {
    if (this.#balance < this.#currentBet) return false
    this.#balance -= this.#currentBet
    return true
  }

  addWin(amount) {
    this.#balance += amount
    this.#totalEarned += amount
    if (this.#balance > this.#highscore) {
      this.#highscore = this.#balance
      this.#saveHighscore()
    }
  }

  getShopLevel() {
    if (this.#totalEarned >= 2000) return 3
    if (this.#totalEarned >= 500) return 2
    return 1
  }

  canAfford(price) {
    return this.#balance >= price
  }

  spend(amount) {
    if (this.#balance < amount) return false
    this.#balance -= amount
    return true
  }

  isGameOver() {
    return this.#balance <= 0
  }

  #saveHighscore() {
    try { localStorage.setItem(HIGHSCORE_KEY, String(this.#highscore)) } catch {}
  }

  #loadHighscore() {
    try { return Number(localStorage.getItem(HIGHSCORE_KEY)) || 0 } catch { return 0 }
  }

  saveHighscore() { this.#saveHighscore() }
  loadHighscore() { this.#highscore = this.#loadHighscore() }
}
```

- [ ] **Step 4: Vérifier que les tests passent**

```bash
npm test
```

Expected: tous les tests `Economy` passent.

- [ ] **Step 5: Commit**

```bash
git add src/game/Economy.js src/game/Economy.test.js
git commit -m "feat: economy — balance, bets, shop levels, highscore persistence"
```

---

## Task 6: BonusSystem

**Files:**
- Create: `src/game/BonusSystem.js`
- Create: `src/game/BonusSystem.test.js`

**Interfaces:**
- Consumes: `shuffleArray` de Random.js
- Produces: `class BonusSystem` avec :
  - `get activeBonus(): BonusInstance[]`
  - `get isFull(): boolean` (max 5)
  - `addBonus(bonusDef: BonusDef, target?: number | string): BonusInstance`
  - `removeBonus(instanceId: string): number` (retourne le prix de revente)
  - `getShopOffers(level: 1|2|3): BonusDef[]` (retourne 3 offres aléatoires)
  - `getModifiers(): BonusModifiers`
  - `processPostSpin(winResult: WinResult, grid: Symbol[][]): {stickyPositions: object}`
  - `resetWildColumns(): void` (appelé après chaque spin — Colonne Wild est one-shot)

  `BONUS_POOL: BonusDef[]` exporté

  Types:
  ```
  BonusDef = {
    id: string, name: string, description: string,
    level: 1|2|3, price: number,
    effect: 'column_multiplier'|'wild_column'|'symbol_multiplier'|
            'chain'|'sticky'|'safety_net'|'jackpot_boost'|
            'free_reroll'|'global_multiplier',
    needsTarget: 'column'|'symbol'|null,
  }

  BonusInstance = BonusDef & {
    instanceId: string,   // unique id pour vendre
    target: number | string | null,  // colonne (0-5) ou symbolId
    remainingUses: number | null,    // null = permanent
  }

  BonusModifiers = {
    columnMultipliers: number[],
    wildColumns: boolean[],
    symbolMultipliers: {[id: string]: number},
    jackpotMultiplier: number,
    safetyNet: boolean,
    globalMultiplier: number,
    freeRerolls: number,
    stickyEnabled: boolean,
    chainEnabled: boolean,
  }
  ```

- [ ] **Step 1: Écrire les tests**

```js
// src/game/BonusSystem.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { BonusSystem, BONUS_POOL } from './BonusSystem.js'

const goldenColumn = BONUS_POOL.find(b => b.effect === 'column_multiplier')
const jackpotBoost = BONUS_POOL.find(b => b.effect === 'jackpot_boost')
const safetyNet    = BONUS_POOL.find(b => b.effect === 'safety_net')
const freeReroll   = BONUS_POOL.find(b => b.effect === 'free_reroll')
const symbolBonus  = BONUS_POOL.find(b => b.effect === 'symbol_multiplier')

describe('BONUS_POOL', () => {
  it('contient au moins 9 bonus', () => {
    expect(BONUS_POOL.length).toBeGreaterThanOrEqual(9)
  })

  it('chaque bonus a les champs requis', () => {
    for (const b of BONUS_POOL) {
      expect(b).toHaveProperty('id')
      expect(b).toHaveProperty('name')
      expect(b).toHaveProperty('price')
      expect(b).toHaveProperty('level')
      expect(b).toHaveProperty('effect')
    }
  })
})

describe('BonusSystem', () => {
  let bs

  beforeEach(() => { bs = new BonusSystem() })

  it('commence avec 0 bonus actifs', () => {
    expect(bs.activeBonus).toHaveLength(0)
    expect(bs.isFull).toBe(false)
  })

  it('addBonus ajoute un bonus', () => {
    bs.addBonus(safetyNet)
    expect(bs.activeBonus).toHaveLength(1)
  })

  it('isFull à 5 bonus', () => {
    for (let i = 0; i < 5; i++) bs.addBonus(safetyNet)
    expect(bs.isFull).toBe(true)
  })

  it('removeBonus supprime et retourne 50% du prix', () => {
    const inst = bs.addBonus(safetyNet)
    const refund = bs.removeBonus(inst.instanceId)
    expect(refund).toBe(Math.floor(safetyNet.price * 0.5))
    expect(bs.activeBonus).toHaveLength(0)
  })

  it('getShopOffers retourne 3 offres', () => {
    const offers = bs.getShopOffers(1)
    expect(offers).toHaveLength(3)
  })

  it('getShopOffers retourne des bonus du bon niveau ou inférieur', () => {
    const offers = bs.getShopOffers(1)
    for (const o of offers) {
      expect(o.level).toBe(1)
    }
  })

  describe('getModifiers', () => {
    it('safetyNet actif → modifiers.safetyNet = true', () => {
      bs.addBonus(safetyNet)
      expect(bs.getModifiers().safetyNet).toBe(true)
    })

    it('jackpot_boost actif → jackpotMultiplier = 50', () => {
      bs.addBonus(jackpotBoost)
      expect(bs.getModifiers().jackpotMultiplier).toBe(50)
    })

    it('column_multiplier avec target=2 → columnMultipliers[2] = 2', () => {
      bs.addBonus(goldenColumn, 2)
      expect(bs.getModifiers().columnMultipliers[2]).toBe(2)
    })

    it('symbol_multiplier avec target="lemon" → symbolMultipliers.lemon = 2', () => {
      bs.addBonus(symbolBonus, 'lemon')
      expect(bs.getModifiers().symbolMultipliers['lemon']).toBe(2)
    })

    it('free_reroll actif → freeRerolls = 1', () => {
      bs.addBonus(freeReroll)
      expect(bs.getModifiers().freeRerolls).toBe(1)
    })
  })
})
```

- [ ] **Step 2: Vérifier que les tests échouent**

```bash
npm test
```

Expected: `Cannot find module './BonusSystem.js'`

- [ ] **Step 3: Implémenter `src/game/BonusSystem.js`**

```js
import { shuffleArray } from '../utils/Random.js'

export const BONUS_POOL = [
  // Niveau 1
  {
    id: 'golden_column', name: 'Colonne Dorée',
    description: 'Un rouleau choisi vaut x2',
    level: 1, price: 20, effect: 'column_multiplier', needsTarget: 'column',
  },
  {
    id: 'safety_net', name: 'Filet de Sécurité',
    description: 'Spin sans gain → récupère 50% de la mise',
    level: 1, price: 15, effect: 'safety_net', needsTarget: null,
  },
  {
    id: 'free_reroll', name: 'Reroll Gratuit',
    description: '1 reroll de boutique gratuit',
    level: 1, price: 10, effect: 'free_reroll', needsTarget: null,
  },
  {
    id: 'symbol_multiplier', name: 'Symbole Béni',
    description: 'Un symbole choisi rapporte x2',
    level: 1, price: 25, effect: 'symbol_multiplier', needsTarget: 'symbol',
  },
  // Niveau 2
  {
    id: 'wild_column', name: 'Colonne Wild',
    description: 'Un rouleau entier devient Wild (permanent)',
    level: 2, price: 50, effect: 'wild_column', needsTarget: 'column',
  },
  {
    id: 'chain', name: 'Chaîne',
    description: 'Un symbole qui gagne 3 spins consécutifs gagne +50% permanent',
    level: 2, price: 40, effect: 'chain', needsTarget: 'symbol',
  },
  {
    id: 'sticky', name: 'Symbole Collant',
    description: 'Les symboles gagnants restent en place 1 spin',
    level: 2, price: 45, effect: 'sticky', needsTarget: null,
  },
  // Niveau 3
  {
    id: 'jackpot_boost', name: 'Jackpot Amplifié',
    description: 'Le multiplicateur x6 passe de x20 à x50',
    level: 3, price: 80, effect: 'jackpot_boost', needsTarget: null,
  },
  {
    id: 'global_multiplier', name: 'Ligne Magique',
    description: 'x3 sur tous les gains pendant 5 spins',
    level: 3, price: 100, effect: 'global_multiplier', needsTarget: null,
  },
]

let _instanceCounter = 0

export class BonusSystem {
  #active = []
  #chainCounts = {}     // { [symbolId]: number } — spins consécutifs gagnants
  #chainBonuses = {}    // { [symbolId]: number } — bonus permanents acquis
  #stickyPositions = {} // { [`${reel}-${row}`]: Symbol }
  #globalMultiplierUses = 0

  get activeBonus() { return [...this.#active] }
  get isFull() { return this.#active.length >= 5 }

  addBonus(bonusDef, target = null) {
    const instance = {
      ...bonusDef,
      instanceId: String(++_instanceCounter),
      target,
      remainingUses: bonusDef.effect === 'global_multiplier' ? 5 : null,
    }
    this.#active.push(instance)
    return instance
  }

  removeBonus(instanceId) {
    const idx = this.#active.findIndex(b => b.instanceId === instanceId)
    if (idx === -1) return 0
    const [removed] = this.#active.splice(idx, 1)
    return Math.floor(removed.price * 0.5)
  }

  getShopOffers(level) {
    const eligible = BONUS_POOL.filter(b => b.level <= level)
    return shuffleArray(eligible).slice(0, 3)
  }

  getModifiers() {
    const modifiers = {
      columnMultipliers: Array(6).fill(1),
      wildColumns: Array(6).fill(false),
      symbolMultipliers: { ...this.#chainBonuses },
      jackpotMultiplier: 20,
      safetyNet: false,
      globalMultiplier: 1,
      freeRerolls: 0,
      stickyEnabled: false,
      chainEnabled: false,
      stickyPositions: this.#stickyPositions,
    }

    for (const bonus of this.#active) {
      switch (bonus.effect) {
        case 'column_multiplier':
          if (bonus.target !== null) modifiers.columnMultipliers[bonus.target] = 2
          break
        case 'wild_column':
          if (bonus.target !== null) modifiers.wildColumns[bonus.target] = true
          break
        case 'symbol_multiplier':
          if (bonus.target) {
            modifiers.symbolMultipliers[bonus.target] =
              (modifiers.symbolMultipliers[bonus.target] ?? 1) * 2
          }
          break
        case 'jackpot_boost':
          modifiers.jackpotMultiplier = 50
          break
        case 'safety_net':
          modifiers.safetyNet = true
          break
        case 'free_reroll':
          modifiers.freeRerolls += 1
          break
        case 'sticky':
          modifiers.stickyEnabled = true
          break
        case 'chain':
          modifiers.chainEnabled = true
          break
        case 'global_multiplier':
          if (bonus.remainingUses > 0) modifiers.globalMultiplier = 3
          break
      }
    }

    return modifiers
  }

  processPostSpin(winResult, grid) {
    const mods = this.getModifiers()
    const { winLines, totalWin } = winResult

    // Chain tracking
    if (mods.chainEnabled) {
      const winningSymbols = new Set(winLines.map(l => l.symbolId))
      const chainBonus = this.#active.find(b => b.effect === 'chain')
      const tracked = chainBonus?.target

      if (tracked) {
        if (winningSymbols.has(tracked)) {
          this.#chainCounts[tracked] = (this.#chainCounts[tracked] ?? 0) + 1
          if (this.#chainCounts[tracked] >= 3) {
            this.#chainBonuses[tracked] = (this.#chainBonuses[tracked] ?? 1) * 1.5
            this.#chainCounts[tracked] = 0 // reset après activation
          }
        } else {
          this.#chainCounts[tracked] = 0
        }
      }
    }

    // Sticky positions
    const newSticky = {}
    if (mods.stickyEnabled && totalWin > 0) {
      for (const line of winLines) {
        for (let reel = 0; reel < line.count; reel++) {
          const col = grid[reel]
          const matchRow = col.findIndex(s => s.id === line.symbolId || s.id === 'wild')
          if (matchRow !== -1) {
            newSticky[`${reel}-${matchRow}`] = col[matchRow]
          }
        }
      }
    }
    this.#stickyPositions = newSticky

    // Décrémenter global_multiplier
    const globalBonus = this.#active.find(b => b.effect === 'global_multiplier')
    if (globalBonus && globalBonus.remainingUses > 0) {
      globalBonus.remainingUses -= 1
      if (globalBonus.remainingUses === 0) {
        this.removeBonus(globalBonus.instanceId)
      }
    }

    return { stickyPositions: this.#stickyPositions }
  }

  useFreeReroll() {
    const bonus = this.#active.find(b => b.effect === 'free_reroll')
    if (!bonus) return false
    this.removeBonus(bonus.instanceId)
    return true
  }
}
```

- [ ] **Step 4: Vérifier que les tests passent**

```bash
npm test
```

Expected: tous les tests `BonusSystem` passent.

- [ ] **Step 5: Commit**

```bash
git add src/game/BonusSystem.js src/game/BonusSystem.test.js
git commit -m "feat: bonus system — pool, active bonuses, modifiers, chain/sticky tracking"
```

---

## Task 7: ReelRenderer (PixiJS)

**Files:**
- Create: `src/ui/ReelRenderer.js`

**Interfaces:**
- Consumes: PixiJS `Application`, `SpinResult` de SlotMachine.js, `WinLine[]` de SlotMachine.js
- Produces: `class ReelRenderer` avec :
  - `constructor(app: Application)`
  - `get container(): Container`
  - `displayGrid(grid: Symbol[][], rowCounts: number[]): void` — affiche la grille immédiatement
  - `animateSpin(finalGrid: Symbol[][], rowCounts: number[]): Promise<void>` — anime puis affiche
  - `highlightWins(winLines: WinLine[]): void` — illumine les reels gagnants
  - `clearHighlights(): void`

Test: visuel uniquement — démarrer `npm run dev` et vérifier l'affichage.

- [ ] **Step 1: Implémenter `src/ui/ReelRenderer.js`**

```js
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

const LABEL_STYLE = new TextStyle({
  fontSize: 13,
  fill: 0xAAAAAA,
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
```

- [ ] **Step 2: Vérifier visuellement**

Dans `src/main.js`, ajouter temporairement :

```js
import { Application } from 'pixi.js'
import { ReelRenderer } from './ui/ReelRenderer.js'
import { spin } from './game/SlotMachine.js'

const app = new Application()
await app.init({ width: 1200, height: 750, backgroundColor: 0x0a0a1a, antialias: true })
document.body.appendChild(app.canvas)

const renderer = new ReelRenderer(app)
app.stage.addChild(renderer.container)

const { grid, rowCounts } = spin()
renderer.displayGrid(grid, rowCounts)
```

```bash
npm run dev
```

Expected: navigateur affiche 6 colonnes de symboles emoji sur fond sombre.

- [ ] **Step 3: Commit**

```bash
git add src/ui/ReelRenderer.js
git commit -m "feat: reel renderer — PixiJS grid display, spin animation, win highlights"
```

---

## Task 8: HUD

**Files:**
- Create: `src/ui/HUD.js`

**Interfaces:**
- Consumes: `Economy` (balance, currentBet, highscore), `BET_OPTIONS`
- Produces: `class HUD` avec :
  - `constructor(app: Application, economy: Economy, onSpin: () => void, onBetChange: (amount: number) => void, onShopToggle: () => void)`
  - `get container(): Container`
  - `update(): void` — rafraîchit tous les textes depuis economy
  - `setSpinEnabled(enabled: boolean): void`
  - `showGameOver(): void`
  - `showWin(amount: number): void`
  - `hideWin(): void`

- [ ] **Step 1: Implémenter `src/ui/HUD.js`**

```js
import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import { BET_OPTIONS } from '../game/Economy.js'

const W = 1200
const H = 750

const STYLE_LABEL = new TextStyle({ fontSize: 14, fill: 0x888888, fontFamily: 'monospace' })
const STYLE_VALUE = new TextStyle({ fontSize: 22, fill: 0xFFFFFF, fontFamily: 'monospace', fontWeight: 'bold' })
const STYLE_WIN   = new TextStyle({ fontSize: 36, fill: 0xFFDD00, fontFamily: 'monospace', fontWeight: 'bold' })
const STYLE_BTN   = new TextStyle({ fontSize: 18, fill: 0xFFFFFF, fontFamily: 'monospace', fontWeight: 'bold' })
const STYLE_OVER  = new TextStyle({ fontSize: 48, fill: 0xFF4444, fontFamily: 'monospace', fontWeight: 'bold' })

function makeButton(label, x, y, w, h, color, onClick) {
  const btn = new Container()
  btn.x = x; btn.y = y
  btn.eventMode = 'static'
  btn.cursor = 'pointer'

  const bg = new Graphics()
  bg.roundRect(0, 0, w, h, 8)
  bg.fill({ color })
  btn.addChild(bg)

  const txt = new Text({ text: label, style: STYLE_BTN })
  txt.anchor.set(0.5)
  txt.x = w / 2; txt.y = h / 2
  btn.addChild(txt)

  btn.on('pointerdown', onClick)
  btn.on('pointerover', () => { bg.tint = 0xCCCCCC })
  btn.on('pointerout',  () => { bg.tint = 0xFFFFFF })

  btn._bg = bg
  return btn
}

export class HUD {
  #economy
  #container
  #balanceText
  #highscoreText
  #winText
  #spinBtn
  #betButtons = []
  #gameOverOverlay

  constructor(app, economy, onSpin, onBetChange, onShopToggle) {
    this.#economy = economy
    this.#container = new Container()

    // Bottom bar background
    const bar = new Graphics()
    bar.rect(0, H - 120, W, 120)
    bar.fill({ color: 0x111128, alpha: 0.95 })
    this.#container.addChild(bar)

    // Balance
    const balLabel = new Text({ text: 'SOLDE', style: STYLE_LABEL })
    balLabel.x = 30; balLabel.y = H - 110
    this.#container.addChild(balLabel)

    this.#balanceText = new Text({ text: '$100', style: STYLE_VALUE })
    this.#balanceText.x = 30; this.#balanceText.y = H - 90
    this.#container.addChild(this.#balanceText)

    // Highscore
    const hsLabel = new Text({ text: 'MEILLEUR', style: STYLE_LABEL })
    hsLabel.x = 160; hsLabel.y = H - 110
    this.#container.addChild(hsLabel)

    this.#highscoreText = new Text({ text: '$0', style: STYLE_VALUE })
    this.#highscoreText.x = 160; this.#highscoreText.y = H - 90
    this.#container.addChild(this.#highscoreText)

    // Bet selector
    const betLabel = new Text({ text: 'MISE', style: STYLE_LABEL })
    betLabel.x = 320; betLabel.y = H - 110
    this.#container.addChild(betLabel)

    BET_OPTIONS.forEach((amount, i) => {
      const isSelected = amount === economy.currentBet
      const btn = makeButton(`$${amount}`, 320 + i * 70, H - 90, 60, 36,
        isSelected ? 0x4444aa : 0x2a2a5e,
        () => onBetChange(amount)
      )
      this.#betButtons.push({ btn, amount })
      this.#container.addChild(btn)
    })

    // Shop button
    const shopBtn = makeButton('🛒 BOUTIQUE', W - 320, H - 95, 140, 46, 0x225522, onShopToggle)
    this.#container.addChild(shopBtn)

    // Spin button
    this.#spinBtn = makeButton('▶ SPIN', W - 160, H - 95, 130, 46, 0x22aa44, onSpin)
    this.#container.addChild(this.#spinBtn)

    // Win text (hidden by default)
    this.#winText = new Text({ text: '', style: STYLE_WIN })
    this.#winText.anchor.set(0.5)
    this.#winText.x = W / 2; this.#winText.y = H - 145
    this.#winText.visible = false
    this.#container.addChild(this.#winText)

    // Game over overlay (hidden)
    this.#gameOverOverlay = new Container()
    this.#gameOverOverlay.visible = false
    const overBg = new Graphics()
    overBg.rect(0, 0, W, H)
    overBg.fill({ color: 0x000000, alpha: 0.75 })
    this.#gameOverOverlay.addChild(overBg)
    const overText = new Text({ text: 'GAME OVER', style: STYLE_OVER })
    overText.anchor.set(0.5); overText.x = W / 2; overText.y = H / 2 - 30
    const restartText = new Text({ text: 'Rechargez la page pour rejouer', style: STYLE_LABEL })
    restartText.anchor.set(0.5); restartText.x = W / 2; restartText.y = H / 2 + 30
    this.#gameOverOverlay.addChild(overText, restartText)
    this.#container.addChild(this.#gameOverOverlay)
  }

  get container() { return this.#container }

  update() {
    this.#balanceText.text = `$${this.#economy.balance.toFixed(2)}`
    this.#highscoreText.text = `$${this.#economy.highscore.toFixed(2)}`

    for (const { btn, amount } of this.#betButtons) {
      btn._bg.tint = amount === this.#economy.currentBet ? 0x6666ff : 0xFFFFFF
    }
  }

  setSpinEnabled(enabled) {
    this.#spinBtn.eventMode = enabled ? 'static' : 'none'
    this.#spinBtn._bg.alpha = enabled ? 1 : 0.4
  }

  showWin(amount) {
    if (amount <= 0) { this.#winText.visible = false; return }
    this.#winText.text = `+$${amount.toFixed(2)}`
    this.#winText.visible = true
  }

  hideWin() {
    this.#winText.visible = false
  }

  showGameOver() {
    this.#gameOverOverlay.visible = true
  }
}
```

- [ ] **Step 2: Vérifier visuellement**

Mettre à jour le `src/main.js` temporaire pour monter le HUD :

```js
import { Application } from 'pixi.js'
import { ReelRenderer } from './ui/ReelRenderer.js'
import { HUD } from './ui/HUD.js'
import { Economy } from './game/Economy.js'
import { spin } from './game/SlotMachine.js'

const app = new Application()
await app.init({ width: 1200, height: 750, backgroundColor: 0x0a0a1a, antialias: true })
document.body.appendChild(app.canvas)

const economy = new Economy(100)
const renderer = new ReelRenderer(app)
const hud = new HUD(app, economy, () => {}, (b) => { economy.setBet(b); hud.update() }, () => {})

app.stage.addChild(renderer.container)
app.stage.addChild(hud.container)

const { grid, rowCounts } = spin()
renderer.displayGrid(grid, rowCounts)
hud.update()
```

```bash
npm run dev
```

Expected: barre de contrôle en bas avec solde, boutons de mise, bouton SPIN et BOUTIQUE.

- [ ] **Step 3: Commit**

```bash
git add src/ui/HUD.js
git commit -m "feat: HUD — balance, bet selector, spin button, win display, game over overlay"
```

---

## Task 9: ShopUI

**Files:**
- Create: `src/ui/ShopUI.js`

**Interfaces:**
- Consumes: `BonusSystem`, `Economy`, `BONUS_POOL`
- Produces: `class ShopUI` avec :
  - `constructor(app: Application, bonusSystem: BonusSystem, economy: Economy, onUpdate: () => void)`
  - `get container(): Container`
  - `toggle(): void` — ouvre/ferme le panneau
  - `refresh(): void` — recharge les offres et bonus actifs affichés

- [ ] **Step 1: Implémenter `src/ui/ShopUI.js`**

```js
import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import { BONUS_POOL } from '../game/BonusSystem.js'
import { SYMBOLS } from '../game/Symbols.js'

const W = 400
const H = 750

const S_TITLE  = new TextStyle({ fontSize: 20, fill: 0xFFFFFF, fontFamily: 'monospace', fontWeight: 'bold' })
const S_NAME   = new TextStyle({ fontSize: 15, fill: 0xFFFFFF, fontFamily: 'monospace', fontWeight: 'bold' })
const S_DESC   = new TextStyle({ fontSize: 12, fill: 0xAAAAAA, fontFamily: 'monospace', wordWrap: true, wordWrapWidth: 260 })
const S_PRICE  = new TextStyle({ fontSize: 14, fill: 0x88FF88, fontFamily: 'monospace', fontWeight: 'bold' })
const S_BTN    = new TextStyle({ fontSize: 13, fill: 0xFFFFFF, fontFamily: 'monospace' })
const S_HEADER = new TextStyle({ fontSize: 14, fill: 0x8888FF, fontFamily: 'monospace', fontWeight: 'bold' })

function smallBtn(label, x, y, w, color, onClick) {
  const btn = new Container()
  btn.x = x; btn.y = y
  btn.eventMode = 'static'; btn.cursor = 'pointer'
  const bg = new Graphics()
  bg.roundRect(0, 0, w, 28, 6)
  bg.fill({ color })
  btn.addChild(bg)
  const t = new Text({ text: label, style: S_BTN })
  t.anchor.set(0.5); t.x = w / 2; t.y = 14
  btn.addChild(t)
  btn.on('pointerdown', onClick)
  return btn
}

export class ShopUI {
  #bonusSystem
  #economy
  #onUpdate
  #container
  #panel
  #content
  #isOpen = false
  #currentOffers = []

  constructor(app, bonusSystem, economy, onUpdate) {
    this.#bonusSystem = bonusSystem
    this.#economy = economy
    this.#onUpdate = onUpdate

    this.#container = new Container()
    this.#container.x = 1200 // hors écran par défaut

    this.#panel = new Graphics()
    this.#panel.rect(0, 0, W, H)
    this.#panel.fill({ color: 0x0d0d28, alpha: 0.97 })
    this.#container.addChild(this.#panel)

    // Titre
    const title = new Text({ text: '🛒 BOUTIQUE', style: S_TITLE })
    title.x = 20; title.y = 15
    this.#container.addChild(title)

    this.#content = new Container()
    this.#content.y = 50
    this.#container.addChild(this.#content)
  }

  get container() { return this.#container }

  toggle() {
    this.#isOpen = !this.#isOpen
    this.#container.x = this.#isOpen ? 1200 - W : 1200
    if (this.#isOpen) this.refresh()
  }

  refresh() {
    this.#content.removeChildren()
    const level = this.#economy.getShopLevel()
    this.#currentOffers = this.#bonusSystem.getShopOffers(level)

    let y = 0

    // Offres
    const offerHeader = new Text({ text: `── OFFRES (Niveau ${level}) ──`, style: S_HEADER })
    offerHeader.x = 20; offerHeader.y = y
    this.#content.addChild(offerHeader)
    y += 30

    for (const offer of this.#currentOffers) {
      y = this.#renderOffer(offer, y)
    }

    // Reroll
    const rerollCost = this.#bonusSystem.getModifiers().freeRerolls > 0 ? 'GRATUIT' : '$5'
    const rerollBtn = smallBtn(`🔄 Reroll (${rerollCost})`, 20, y, 180, 0x333388, () => {
      if (this.#bonusSystem.getModifiers().freeRerolls > 0) {
        this.#bonusSystem.useFreeReroll()
      } else if (!this.#economy.spend(5)) return
      this.refresh()
      this.#onUpdate()
    })
    this.#content.addChild(rerollBtn)
    y += 50

    // Bonus actifs
    const activeHeader = new Text({ text: '── BONUS ACTIFS ──', style: S_HEADER })
    activeHeader.x = 20; activeHeader.y = y
    this.#content.addChild(activeHeader)
    y += 30

    for (const bonus of this.#bonusSystem.activeBonus) {
      y = this.#renderActiveBonus(bonus, y)
    }

    if (this.#bonusSystem.activeBonus.length === 0) {
      const none = new Text({ text: 'Aucun bonus actif', style: S_DESC })
      none.x = 20; none.y = y
      this.#content.addChild(none)
    }
  }

  #renderOffer(offer, y) {
    const card = new Graphics()
    card.roundRect(10, y, W - 20, 90, 8)
    card.fill({ color: 0x1a1a40 })
    card.stroke({ color: 0x3333aa, width: 1 })
    this.#content.addChild(card)

    const name = new Text({ text: offer.name, style: S_NAME })
    name.x = 20; name.y = y + 10
    this.#content.addChild(name)

    const desc = new Text({ text: offer.description, style: S_DESC })
    desc.x = 20; desc.y = y + 32
    this.#content.addChild(desc)

    const price = new Text({ text: `$${offer.price}`, style: S_PRICE })
    price.x = 20; price.y = y + 60
    this.#content.addChild(price)

    const canBuy = this.#economy.canAfford(offer.price) && !this.#bonusSystem.isFull
    const buyBtn = smallBtn('Acheter', W - 110, y + 30, 90, canBuy ? 0x226622 : 0x443333, () => {
      if (!canBuy) return
      let target = null
      if (offer.needsTarget === 'column') {
        const col = parseInt(prompt(`Choisir le rouleau (0-5) pour "${offer.name}" :`) ?? '', 10)
        if (isNaN(col) || col < 0 || col > 5) return
        target = col
      } else if (offer.needsTarget === 'symbol') {
        const symbolIds = SYMBOLS.filter(s => s.id !== 'wild' && s.id !== 'scatter').map(s => s.id)
        const sym = prompt(`Choisir un symbole pour "${offer.name}" :\n${symbolIds.join(', ')}`)
        if (!symbolIds.includes(sym)) return
        target = sym
      }
      if (!this.#economy.spend(offer.price)) return
      this.#bonusSystem.addBonus(offer, target)
      this.refresh()
      this.#onUpdate()
    })
    this.#content.addChild(buyBtn)

    return y + 100
  }

  #renderActiveBonus(bonus, y) {
    const card = new Graphics()
    card.roundRect(10, y, W - 20, 60, 8)
    card.fill({ color: 0x111130 })
    card.stroke({ color: 0x4444cc, width: 1 })
    this.#content.addChild(card)

    const label = bonus.target !== null
      ? `${bonus.name} [${bonus.target}]`
      : bonus.name
    const name = new Text({ text: label, style: S_NAME })
    name.x = 20; name.y = y + 8
    this.#content.addChild(name)

    const usesText = bonus.remainingUses !== null ? ` (${bonus.remainingUses} spins)` : ''
    const desc = new Text({ text: bonus.description + usesText, style: S_DESC })
    desc.x = 20; desc.y = y + 30
    this.#content.addChild(desc)

    const sellPrice = Math.floor(bonus.price * 0.5)
    const sellBtn = smallBtn(`Vendre $${sellPrice}`, W - 130, y + 16, 110, 0x662222, () => {
      const refund = this.#bonusSystem.removeBonus(bonus.instanceId)
      this.#economy.addMoney(refund)
      this.refresh()
      this.#onUpdate()
    })
    this.#content.addChild(sellBtn)

    return y + 70
  }
}
```

- [ ] **Step 2: Vérifier visuellement**

Tester en cliquant le bouton BOUTIQUE dans le jeu.

Expected: panneau latéral s'ouvre avec 3 offres et un bouton de reroll.

- [ ] **Step 3: Corriger `Economy` — ajouter la méthode `addMoney`**

La méthode `spend` existe mais il faut aussi `addMoney` pour les remboursements de vente. Ajouter dans `src/game/Economy.js` :

```js
addMoney(amount) {
  this.#balance += amount
}
```

Et son test dans `Economy.test.js` :

```js
it('addMoney augmente le solde', () => {
  eco.addMoney(50)
  expect(eco.balance).toBe(150)
})
```

```bash
npm test
```

Expected: tous les tests passent.

- [ ] **Step 4: Commit**

```bash
git add src/ui/ShopUI.js src/game/Economy.js src/game/Economy.test.js
git commit -m "feat: shop UI — offers, buy/sell bonuses, reroll, active bonus display"
```

---

## Task 10: Integration — Main Game Loop

**Files:**
- Modify: `src/main.js`

**Interfaces:**
- Consumes: tous les modules créés précédemment
- Produces: jeu complet fonctionnel

- [ ] **Step 1: Écrire `src/main.js` complet**

```js
import { Application } from 'pixi.js'
import { Economy } from './game/Economy.js'
import { BonusSystem } from './game/BonusSystem.js'
import { spin, calculateWins } from './game/SlotMachine.js'
import { ReelRenderer } from './ui/ReelRenderer.js'
import { HUD } from './ui/HUD.js'
import { ShopUI } from './ui/ShopUI.js'

const app = new Application()
await app.init({
  width: 1200,
  height: 750,
  backgroundColor: 0x0a0a1a,
  antialias: true,
  resolution: window.devicePixelRatio || 1,
})
document.body.appendChild(app.canvas)

const economy = new Economy(100)
const bonusSystem = new BonusSystem()

const renderer = new ReelRenderer(app)
const hud = new HUD(
  app, economy,
  handleSpin,
  (amount) => { economy.setBet(amount); hud.update() },
  () => shop.toggle()
)
const shop = new ShopUI(app, bonusSystem, economy, () => hud.update())

app.stage.addChild(renderer.container)
app.stage.addChild(hud.container)
app.stage.addChild(shop.container)

// Affichage initial
const { grid: initGrid, rowCounts: initRows } = spin()
renderer.displayGrid(initGrid, initRows)
hud.update()

let isSpinning = false

async function handleSpin() {
  if (isSpinning || economy.isGameOver()) return

  if (!economy.placeBet()) return

  isSpinning = true
  hud.setSpinEnabled(false)
  hud.hideWin()
  renderer.clearHighlights()

  const modifiers = bonusSystem.getModifiers()
  const stickyPositions = modifiers.stickyPositions ?? {}

  const { grid, rowCounts } = spin(stickyPositions)
  await renderer.animateSpin(grid, rowCounts)
  renderer.displayGrid(grid, rowCounts)

  const winResult = calculateWins(grid, economy.currentBet, modifiers)

  bonusSystem.processPostSpin(winResult, grid)

  if (winResult.totalWin > 0) {
    economy.addWin(winResult.totalWin)
    renderer.highlightWins(winResult.winLines)
    hud.showWin(winResult.totalWin)
    await delay(1200)
  }

  if (winResult.scatterTriggered) {
    await handleFreeSpins(grid, 10)
  }

  if (winResult.dropBonus) {
    const level = economy.getShopLevel()
    const dropped = bonusSystem.getShopOffers(level)[0]
    if (dropped && !bonusSystem.isFull) {
      let target = null
      if (dropped.needsTarget === 'column') target = Math.floor(Math.random() * 6)
      else if (dropped.needsTarget === 'symbol') {
        const ids = ['lemon','grape','bell','diamond','star','dog']
        target = ids[Math.floor(Math.random() * ids.length)]
      }
      bonusSystem.addBonus(dropped, target)
      alert(`🎁 Bonus droppé : ${dropped.name}${target !== null ? ` [${target}]` : ''}`)
    }
  }

  hud.update()

  if (economy.isGameOver()) {
    hud.showGameOver()
    return
  }

  isSpinning = false
  hud.setSpinEnabled(true)
}

async function handleFreeSpins(lastGrid, count) {
  for (let i = 0; i < count; i++) {
    await delay(400)
    const modifiers = bonusSystem.getModifiers()
    const { grid, rowCounts } = spin(modifiers.stickyPositions ?? {})
    await renderer.animateSpin(grid, rowCounts)
    renderer.displayGrid(grid, rowCounts)

    const winResult = calculateWins(grid, economy.currentBet, modifiers)
    bonusSystem.processPostSpin(winResult, grid)

    if (winResult.totalWin > 0) {
      economy.addWin(winResult.totalWin)
      renderer.highlightWins(winResult.winLines)
      hud.showWin(winResult.totalWin)
      hud.update()
      await delay(800)
      renderer.clearHighlights()
    }
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
```

- [ ] **Step 2: Lancer le jeu et tester la boucle complète**

```bash
npm run dev
```

Tester dans l'ordre :
1. Cliquer SPIN → rouleaux s'animent, gains affichés
2. Changer la mise → mise se met à jour
3. Ouvrir la boutique → offres visibles
4. Acheter un bonus "Filet de Sécurité" → apparaît dans les bonus actifs
5. Vendre un bonus → remboursement crédité
6. Faire tourner jusqu'au game over (mise élevée) → overlay "GAME OVER" apparaît
7. Vérifier le highscore persiste après rechargement de page (localStorage)

- [ ] **Step 3: Vérifier que tous les tests passent**

```bash
npm test
```

Expected: tous les tests unitaires passent (Random, Symbols, SlotMachine, Economy, BonusSystem)

- [ ] **Step 4: Commit final**

```bash
git add src/main.js
git commit -m "feat: game integration — full loop, free spins, bonus drops, game over"
```

---

## Résumé des tâches

| # | Tâche | Fichiers clés | Testable |
|---|---|---|---|
| 1 | Project Setup | package.json, vite.config.js, index.html | Serveur dev démarre |
| 2 | Random Utils | Random.js | Vitest |
| 3 | Symbols | Symbols.js | Vitest |
| 4 | SlotMachine | SlotMachine.js | Vitest |
| 5 | Economy | Economy.js | Vitest |
| 6 | BonusSystem | BonusSystem.js | Vitest |
| 7 | ReelRenderer | ReelRenderer.js | Visuel |
| 8 | HUD | HUD.js | Visuel |
| 9 | ShopUI | ShopUI.js | Visuel |
| 10 | Integration | main.js | Boucle complète |
