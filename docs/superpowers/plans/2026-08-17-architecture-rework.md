# Architecture Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrer vers TypeScript et remplacer `main.js` par une architecture extensible — hook registry par personnage, machine configs, items consommables, dialogue de base — sans casser les mécaniques existantes.

**Architecture:** `GameLoop.ts` orchestre la boucle sans aucune logique de personnage. Chaque personnage exporte un `CharacterPlugin` avec des hooks optionnels (`onBeforeSpin`, `onAfterSpin`, etc.) appelés via `plugin.hook?.(ctx)`. Machines et items sont des objets de config. `RunState.ts` est la source de vérité de l'état de run.

**Tech Stack:** Vite 5, TypeScript 5 (strict: false), Vitest

**Spec:** `docs/superpowers/specs/2026-08-17-architecture-rework.md`

## Global Constraints

- Monnaie : `⛧` âmes — type alias `Souls = number` ; affichage `⛧` dans l'UI
- Paliers : 500 → 2 000 → 10 000⛧ ; passage → shop refresh + escalade des mises
- Escalade des mises : la mise max du palier courant devient la mise min du suivant
- Grid : 6 rouleaux × 2-7 rangées (Megaways, inchangé)
- `strict: false` dans tsconfig pour faciliter la migration
- Aucune logique personnage dans `GameLoop.ts`
- Personnages : 7 péchés capitaux existants + `joueur` (aucune mécanique)
- Clé de save localStorage : `casinotro_v2` (rupture avec v1)

---

### Task 1: TypeScript Setup

**Files:**
- Modify: `package.json`
- Create: `tsconfig.json`
- Rename+Modify: `vite.config.js` → `vite.config.ts`

**Interfaces:**
- Consumes: rien
- Produces: pipeline TS, tous les `.ts` compilent

- [ ] **Step 1: Installer TypeScript**

```bash
npm install --save-dev typescript
```

- [ ] **Step 2: Créer `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": false,
    "skipLibCheck": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"]
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Renommer `vite.config.js` → `vite.config.ts`**

```ts
import { defineConfig } from 'vite'
export default defineConfig({ build: { target: 'ES2020' } })
```

- [ ] **Step 4: Vérifier que `npm run dev` démarre sans erreur**

- [ ] **Step 5: Commit**

```bash
git add tsconfig.json vite.config.ts package.json package-lock.json
git rm vite.config.js
git commit -m "chore: add TypeScript"
```

---

### Task 2: Core Types

**Files:**
- Create: `src/types/index.ts`

**Interfaces:**
- Consumes: rien
- Produces: tous les types partagés du projet

- [ ] **Step 1: Créer `src/types/index.ts`**

```ts
// ─── Monnaie ─────────────────────────────────────────────
export type Souls = number

// ─── Symboles ────────────────────────────────────────────
export interface GameSymbol {
  id: string
  name: string
  emoji: string
  weight: number
  color: number
}

// ─── Spin ────────────────────────────────────────────────
export interface SpinOptions {
  rareMultiplier?: number
}

export interface SpinResult {
  totalWin: Souls
  winLines: WinLine[]
  scatterTriggered: boolean
  dropBonus: boolean
}

export interface WinLine {
  symbolId: string
  count: number
  multiplier: number
  win: Souls
  reelRows: number[]
}

// ─── Modificateurs ───────────────────────────────────────
export interface Modifiers {
  columnMultipliers: number[]
  wildColumns: boolean[]
  symbolMultipliers: Record<string, number>
  jackpotMultiplier: number
  safetyNet: boolean
  globalMultiplier: number
  freeRerolls: number
  stickyEnabled: boolean
  chainEnabled: boolean
  stickyPositions: Record<string, GameSymbol>
  luck: number
}

// ─── Items (bonus + consommables) ────────────────────────
export type ItemKind = 'bonus' | 'consumable'

export interface ItemDef {
  id: string
  name: string
  description: string
  level: 1 | 2 | 3
  price: Souls
  kind: ItemKind
  effect: string
  charges?: number
  needsTarget?: 'column' | 'symbol' | null
}

export interface ItemInstance extends ItemDef {
  instanceId: string
  target?: number | string | null
  remainingCharges?: number
}

// ─── Machine ─────────────────────────────────────────────
export interface MachineConfig {
  id: string
  name: string
  reelCount: number
  minRows: number
  maxRows: number
  rtpTarget: number
  unlockRequirement?: string
}

// ─── Dialogue ────────────────────────────────────────────
export interface DialogueLine {
  speaker: string
  text: string
}

// ─── Contexte passé aux hooks ────────────────────────────
export interface UIContext {
  addLog(msg: string, muted?: boolean): void
  triggerDialogue(lines: DialogueLine[]): void
  updateHUD(): void
  updateShop(): void
}

export interface GameContext {
  economy: import('../game/Economy').Economy
  bonusSystem: import('../game/BonusSystem').BonusSystem
  ui: UIContext
  addLog(msg: string, muted?: boolean): void
}

// ─── Plugin personnage ────────────────────────────────────
export interface CharacterPlugin {
  id: string
  onSetup?(ctx: GameContext): void
  onTeardown?(ctx: GameContext): void
  onBeforeSpin?(ctx: GameContext): void
  onAfterSpin?(ctx: GameContext, result: SpinResult): void
  onWin?(ctx: GameContext, amount: Souls): void
  onStageComplete?(ctx: GameContext, stage: number): void
  onShopSell?(ctx: GameContext, item: ItemInstance): void
  onLossCheck?(ctx: GameContext): boolean
  onDialogueTrigger?(ctx: GameContext): DialogueLine[]
  getSpinOptions?(ctx: GameContext): SpinOptions
  getLuckBonus?(ctx: GameContext): number
  offerModifier?(offer: ItemDef): ItemDef | null
}
```

- [ ] **Step 2: Vérifier `tsc --noEmit` sans erreur**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: core TypeScript types"
```

---

### Task 3: Migrer `Random.ts` + tests

**Files:**
- Rename: `src/utils/Random.js` → `src/utils/Random.ts`
- Rename: `src/utils/Random.test.js` → `src/utils/Random.test.ts`

**Interfaces:**
- Consumes: rien
- Produces: `randomInt(min, max): number`, `shuffleArray<T>(arr: T[]): T[]`

- [ ] **Step 1: Renommer et typer `Random.ts`**

```ts
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
```

- [ ] **Step 2: Renommer `Random.test.ts` (contenu inchangé hormis l'extension)**

- [ ] **Step 3: Lancer les tests**

```bash
npx vitest run src/utils/Random.test.ts
```
Expected: tous passent.

- [ ] **Step 4: Commit**

```bash
git add src/utils/Random.ts src/utils/Random.test.ts
git rm src/utils/Random.js src/utils/Random.test.js
git commit -m "chore: migrate Random to TypeScript"
```

---

### Task 4: Migrer `Symbols.ts`

**Files:**
- Rename: `src/game/Symbols.js` → `src/game/Symbols.ts`
- Rename: `src/game/Symbols.test.js` → `src/game/Symbols.test.ts`

**Interfaces:**
- Consumes: `GameSymbol`, `Souls` from `types/index.ts`
- Produces: `SYMBOLS: GameSymbol[]`, `WIN_SYMBOLS: GameSymbol[]`, `WIN_MULTIPLIERS: Record<number, number>`, `generateReelColumn(rowCount, luckFactor, rareMultiplier?): GameSymbol[]`

- [ ] **Step 1: Renommer en `.ts` et ajouter les imports de types**

Ajouter en tête du fichier :
```ts
import type { GameSymbol } from '../types/index.ts'
```

Typer les exports existants :
```ts
export const SYMBOLS: GameSymbol[] = [ /* contenu inchangé */ ]
export const WIN_SYMBOLS: GameSymbol[] = [ /* contenu inchangé */ ]
export const WIN_MULTIPLIERS: Record<number, number> = { /* contenu inchangé */ }

export function generateReelColumn(
  rowCount: number,
  luckFactor: number,
  rareMultiplier = 1
): GameSymbol[] { /* corps inchangé */ }
```

- [ ] **Step 2: Renommer le test en `.ts`, lancer**

```bash
npx vitest run src/game/Symbols.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/game/Symbols.ts src/game/Symbols.test.ts
git rm src/game/Symbols.js src/game/Symbols.test.js
git commit -m "chore: migrate Symbols to TypeScript"
```

---

### Task 5: Migrer `Economy.ts` (+ alias Souls)

**Files:**
- Rename: `src/game/Economy.js` → `src/game/Economy.ts`
- Rename: `src/game/Economy.test.js` → `src/game/Economy.test.ts`

**Interfaces:**
- Consumes: `Souls` from `types/index.ts`
- Produces: `class Economy` avec les mêmes méthodes, `BET_OPTIONS: Souls[]`

- [ ] **Step 1: Renommer en `.ts`, ajouter import**

```ts
import type { Souls } from '../types/index.ts'

export const BET_OPTIONS: Souls[] = [1, 2, 5, 10, 25]
```

Typer les champs privés et signatures de méthode :

```ts
export class Economy {
  #balance: Souls
  #currentBet: Souls
  #totalEarned: Souls
  #highscore: Souls
  #totalWagered: Souls = 0
  #totalReturned: Souls = 0

  // Signatures existantes, corps inchangés
  get balance(): Souls { return this.#balance }
  get currentBet(): Souls { return this.#currentBet }
  addWin(amount: Souls): void { /* inchangé */ }
  spend(amount: Souls): boolean { /* inchangé */ }
  // ... reste inchangé
}
```

- [ ] **Step 2: Tests**

```bash
npx vitest run src/game/Economy.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/game/Economy.ts src/game/Economy.test.ts
git rm src/game/Economy.js src/game/Economy.test.js
git commit -m "chore: migrate Economy to TypeScript"
```

---

### Task 6: Migrer `SlotMachine.ts`

**Files:**
- Rename: `src/game/SlotMachine.js` → `src/game/SlotMachine.ts`
- Rename: `src/game/SlotMachine.test.js` → `src/game/SlotMachine.test.ts`

**Interfaces:**
- Consumes: `GameSymbol`, `SpinOptions`, `SpinResult`, `WinLine`, `Modifiers`, `Souls` from `types/index.ts`
- Produces: `spin(stickyPositions, luckFactor, opts?): { grid: GameSymbol[][], rowCounts: number[] }`, `calculateWins(grid, bet, modifiers?): SpinResult`

- [ ] **Step 1: Renommer en `.ts` et typer les signatures**

```ts
import type { GameSymbol, SpinOptions, SpinResult, WinLine, Modifiers, Souls } from '../types/index.ts'
import { randomInt } from '../utils/Random.ts'
import { generateReelColumn, WIN_SYMBOLS, WIN_MULTIPLIERS } from './Symbols.ts'

export function spin(
  stickyPositions: Record<string, GameSymbol> = {},
  luckFactor = 0,
  opts: SpinOptions = {}
): { grid: GameSymbol[][], rowCounts: number[] } {
  // corps inchangé
}

export function calculateWins(
  grid: GameSymbol[][],
  bet: Souls,
  modifiers: Partial<Modifiers> = {}
): SpinResult {
  // corps inchangé
}
```

- [ ] **Step 2: Tests**

```bash
npx vitest run src/game/SlotMachine.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/game/SlotMachine.ts src/game/SlotMachine.test.ts
git rm src/game/SlotMachine.js src/game/SlotMachine.test.js
git commit -m "chore: migrate SlotMachine to TypeScript"
```

---

### Task 7: Item Pool (`src/game/items/index.ts`)

Remplace `BONUS_POOL` de `BonusSystem.js`. Sépare la définition des items de leur gestion.

**Files:**
- Create: `src/game/items/index.ts`

**Interfaces:**
- Consumes: `ItemDef`, `ItemKind` from `types/index.ts`
- Produces: `ITEM_POOL: ItemDef[]`, `getItemsByLevel(level: 1|2|3): ItemDef[]`

- [ ] **Step 1: Créer `src/game/items/index.ts`**

```ts
import type { ItemDef } from '../../types/index.ts'

export const ITEM_POOL: ItemDef[] = [
  // ── Niveau 1 ─────────────────────────────────────────
  {
    id: 'golden_column', name: 'Colonne Dorée', kind: 'bonus',
    description: 'Un rouleau choisi vaut ×2', level: 1, price: 20,
    effect: 'column_multiplier', needsTarget: 'column',
  },
  {
    id: 'safety_net', name: 'Filet de Sécurité', kind: 'bonus',
    description: 'Spin sans gain → récupère 50% de la mise', level: 1, price: 15,
    effect: 'safety_net', needsTarget: null,
  },
  {
    id: 'free_reroll', name: 'Reroll Gratuit', kind: 'consumable',
    description: '1 reroll de boutique gratuit', level: 1, price: 10,
    effect: 'free_reroll', needsTarget: null, charges: 1,
  },
  {
    id: 'symbol_multiplier', name: 'Symbole Béni', kind: 'bonus',
    description: 'Un symbole choisi rapporte ×2', level: 1, price: 25,
    effect: 'symbol_multiplier', needsTarget: 'symbol',
  },
  {
    id: 'luck_boost', name: 'Porte-Bonheur', kind: 'bonus',
    description: '+15 chance permanente', level: 1, price: 30,
    effect: 'luck_boost', needsTarget: null,
  },
  // ── Niveau 2 ─────────────────────────────────────────
  {
    id: 'wild_column', name: 'Colonne Wild', kind: 'bonus',
    description: 'Un rouleau entier devient Wild (permanent)', level: 2, price: 50,
    effect: 'wild_column', needsTarget: 'column',
  },
  {
    id: 'chain', name: 'Chaîne', kind: 'bonus',
    description: 'Un symbole qui gagne 3 spins consécutifs gagne +50% permanent', level: 2, price: 40,
    effect: 'chain', needsTarget: 'symbol',
  },
  {
    id: 'sticky', name: 'Symbole Collant', kind: 'bonus',
    description: 'Les symboles gagnants restent en place 1 spin', level: 2, price: 45,
    effect: 'sticky', needsTarget: null,
  },
  {
    id: 'lucky_streak', name: 'Coup de Chance', kind: 'consumable',
    description: '+30 chance pendant 10 spins', level: 2, price: 45,
    effect: 'lucky_streak', needsTarget: null, charges: 10,
  },
  // ── Niveau 3 ─────────────────────────────────────────
  {
    id: 'jackpot_boost', name: 'Jackpot Amplifié', kind: 'bonus',
    description: 'Le multiplicateur ×6 passe de ×20 à ×50', level: 3, price: 80,
    effect: 'jackpot_boost', needsTarget: null,
  },
  {
    id: 'global_multiplier', name: 'Ligne Magique', kind: 'consumable',
    description: '×3 sur tous les gains pendant 5 spins', level: 3, price: 100,
    effect: 'global_multiplier', needsTarget: null, charges: 5,
  },
]

export function getItemsByLevel(maxLevel: 1 | 2 | 3): ItemDef[] {
  return ITEM_POOL.filter(i => i.level <= maxLevel)
}
```

- [ ] **Step 2: Pas de test unitaire pour les données — vérifier que tsc passe**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/game/items/index.ts
git commit -m "feat: item pool (bonus + consumables) extracted to items/index.ts"
```

---

### Task 8: Migrer `BonusSystem.ts` (utilise `ItemDef` / `ItemInstance`)

**Files:**
- Rename: `src/game/BonusSystem.js` → `src/game/BonusSystem.ts`
- Rename: `src/game/BonusSystem.test.js` → `src/game/BonusSystem.test.ts`

**Interfaces:**
- Consumes: `ItemDef`, `ItemInstance`, `Modifiers`, `SpinResult`, `GameSymbol` from `types/index.ts` ; `getItemsByLevel` from `items/index.ts`
- Produces: `class BonusSystem` — `addBonus`, `removeBonus`, `getModifiers`, `processPostSpin`, `getShopOffers`, `serialize`, `restore`

- [ ] **Step 1: Renommer en `.ts`, remplacer `BONUS_POOL` par import, typer**

Supprimer le tableau `BONUS_POOL` du fichier. Remplacer `getShopOffers` :

```ts
import type { ItemDef, ItemInstance, Modifiers, SpinResult, GameSymbol } from '../types/index.ts'
import { shuffleArray } from '../utils/Random.ts'
import { getItemsByLevel } from './items/index.ts'

export class BonusSystem {
  static #counter = 0
  #active: ItemInstance[] = []
  // ... champs privés identiques

  getShopOffers(level: 1 | 2 | 3): ItemDef[] {
    return shuffleArray(getItemsByLevel(level)).slice(0, 3)
  }

  addBonus(bonusDef: ItemDef, target: number | string | null = null): ItemInstance {
    const instance: ItemInstance = {
      ...bonusDef,
      instanceId: String(++BonusSystem.#counter),
      target,
      remainingCharges: bonusDef.charges ?? undefined,
    }
    this.#active.push(instance)
    return instance
  }
  // ... reste inchangé, juste typé
}
```

- [ ] **Step 2: Mettre à jour le test pour importer depuis `BonusSystem.ts`**

```bash
npx vitest run src/game/BonusSystem.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/game/BonusSystem.ts src/game/BonusSystem.test.ts
git rm src/game/BonusSystem.js src/game/BonusSystem.test.js
git commit -m "chore: migrate BonusSystem to TypeScript, use item pool"
```

---

### Task 9: `RunState.ts`

**Files:**
- Create: `src/game/RunState.ts`

**Interfaces:**
- Consumes: `Souls` from `types/index.ts`
- Produces: `class RunState` avec `stage`, `stageGoals`, `betOptions`, `machineId`, `characterId`, `spinCount`, `dialoguePlayed`, `advanceStage()`, `serialize()`, `restore()`

- [ ] **Step 1: Créer `src/game/RunState.ts`**

```ts
import type { Souls } from '../types/index.ts'

export const STAGE_GOALS: [Souls, Souls, Souls] = [500, 2000, 10000]
export const INITIAL_BET_OPTIONS: Souls[] = [1, 2, 5, 10, 25]

export class RunState {
  stage: 1 | 2 | 3 = 1
  stageGoals: [Souls, Souls, Souls] = [...STAGE_GOALS]
  betOptions: Souls[] = [...INITIAL_BET_OPTIONS]
  machineId = 'megaways'
  characterId = 'luxuria'
  spinCount = 0
  dialoguePlayed = false

  get currentGoal(): Souls {
    return this.stageGoals[this.stage - 1]
  }

  advanceStage(): void {
    if (this.stage >= 3) return
    const newMin = this.betOptions[this.betOptions.length - 1]
    // la mise max du palier courant devient la mise min du suivant
    this.betOptions = [
      newMin,
      newMin * 2,
      newMin * 5,
      newMin * 10,
      newMin * 25,
    ]
    this.stage = (this.stage + 1) as 2 | 3
  }

  reset(characterId: string, machineId: string): void {
    this.stage = 1
    this.stageGoals = [...STAGE_GOALS]
    this.betOptions = [...INITIAL_BET_OPTIONS]
    this.characterId = characterId
    this.machineId = machineId
    this.spinCount = 0
    this.dialoguePlayed = false
  }

  serialize() {
    return {
      stage: this.stage,
      stageGoals: this.stageGoals,
      betOptions: this.betOptions,
      machineId: this.machineId,
      characterId: this.characterId,
      spinCount: this.spinCount,
      dialoguePlayed: this.dialoguePlayed,
    }
  }

  restore(data: ReturnType<RunState['serialize']>): void {
    this.stage = data.stage ?? 1
    this.stageGoals = data.stageGoals ?? [...STAGE_GOALS]
    this.betOptions = data.betOptions ?? [...INITIAL_BET_OPTIONS]
    this.machineId = data.machineId ?? 'megaways'
    this.characterId = data.characterId ?? 'luxuria'
    this.spinCount = data.spinCount ?? 0
    this.dialoguePlayed = data.dialoguePlayed ?? false
  }
}
```

- [ ] **Step 2: Vérifier `tsc --noEmit`**

- [ ] **Step 3: Commit**

```bash
git add src/game/RunState.ts
git commit -m "feat: RunState — centralized run state with stage progression"
```

---

### Task 10: Machine Registry

**Files:**
- Create: `src/game/machines/megaways.ts`
- Create: `src/game/machines/index.ts`

**Interfaces:**
- Consumes: `MachineConfig` from `types/index.ts`
- Produces: `MACHINES: Record<string, MachineConfig>`, `getMachine(id): MachineConfig`

- [ ] **Step 1: Créer `src/game/machines/megaways.ts`**

```ts
import type { MachineConfig } from '../../types/index.ts'

export const megaways: MachineConfig = {
  id: 'megaways',
  name: 'La Machine Ordinaire',
  reelCount: 6,
  minRows: 2,
  maxRows: 7,
  rtpTarget: 0.92,
}
```

- [ ] **Step 2: Créer `src/game/machines/index.ts`**

```ts
import type { MachineConfig } from '../../types/index.ts'
import { megaways } from './megaways.ts'

export const MACHINES: Record<string, MachineConfig> = {
  megaways,
}

export function getMachine(id: string): MachineConfig {
  const m = MACHINES[id]
  if (!m) throw new Error(`Machine inconnue : ${id}`)
  return m
}
```

- [ ] **Step 3: Vérifier `tsc --noEmit`**

- [ ] **Step 4: Commit**

```bash
git add src/game/machines/
git commit -m "feat: machine registry — MachineConfig + megaways"
```

---

### Task 11: Progression Meta (`src/meta/Progression.ts`)

**Files:**
- Create: `src/meta/Progression.ts`

**Interfaces:**
- Consumes: `Souls` from `types/index.ts`
- Produces: `class Progression` — `highscore`, `unlockedMachines`, `updateHighscore(v)`, `unlockMachine(id)`, `serialize()`, `restore()`

- [ ] **Step 1: Créer `src/meta/Progression.ts`**

```ts
import type { Souls } from '../types/index.ts'

const KEY = 'casinotro_meta_v2'

export class Progression {
  highscore: Souls = 0
  unlockedMachines: Set<string> = new Set(['megaways'])

  constructor() { this.load() }

  updateHighscore(value: Souls): void {
    if (value > this.highscore) {
      this.highscore = value
      this.save()
    }
  }

  unlockMachine(id: string): void {
    this.unlockedMachines.add(id)
    this.save()
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        highscore: this.highscore,
        unlockedMachines: [...this.unlockedMachines],
      }))
    } catch {}
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(KEY)
      if (!raw) return
      const data = JSON.parse(raw)
      this.highscore = data.highscore ?? 0
      this.unlockedMachines = new Set(data.unlockedMachines ?? ['megaways'])
    } catch {}
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/meta/Progression.ts
git commit -m "feat: Progression meta — highscore + machine unlocks"
```

---

### Task 12: Character Plugin Files

**Files:**
- Create: `src/game/characters/index.ts`
- Create: `src/game/characters/luxuria.ts`
- Create: `src/game/characters/gula.ts`
- Create: `src/game/characters/avaritia.ts`
- Create: `src/game/characters/ira.ts`
- Create: `src/game/characters/invidia.ts`
- Create: `src/game/characters/acedia.ts`
- Create: `src/game/characters/superbia.ts`
- Create: `src/game/characters/joueur.ts`

**Interfaces:**
- Consumes: `CharacterPlugin`, `GameContext`, `SpinResult`, `SpinOptions`, `DialogueLine`, `ItemDef`, `ItemInstance`, `Souls` from `types/index.ts`
- Produces: `getCharacterPlugin(id: string): CharacterPlugin` depuis `characters/index.ts`

Les personnages stateful (gula) utilisent le pattern factory pour un état frais à chaque run.

- [ ] **Step 1: Créer `src/game/characters/luxuria.ts`**

```ts
import type { CharacterPlugin, GameContext, SpinResult, SpinOptions, DialogueLine } from '../../types/index.ts'

const PARAMS = {
  rareSymbolWeightMultiplier: 2.5,
  upkeepPercent: 0.05,
  upkeepLabel: 'Entretien',
}

export const luxuriaPlugin: CharacterPlugin = {
  id: 'luxuria',

  getSpinOptions(_ctx: GameContext): SpinOptions {
    return { rareMultiplier: PARAMS.rareSymbolWeightMultiplier }
  },

  onBeforeSpin(ctx: GameContext): void {
    const upkeep = Math.round(ctx.economy.balance * PARAMS.upkeepPercent * 100) / 100
    if (upkeep > 0 && ctx.economy.spend(upkeep)) {
      ctx.addLog(`${PARAMS.upkeepLabel} — -${upkeep.toFixed(2)}⛧`, true)
    }
  },

  onDialogueTrigger(_ctx: GameContext): DialogueLine[] {
    return [
      { speaker: 'Le Croupier', text: 'Vous saignez sur le feutre, madame. Ce n\'est pas grave : il est déjà rouge.' },
      { speaker: 'Luxuria', text: 'Je n\'ai jamais gardé un sou. Ni un amant. Ici on appelle ça un supplice ; moi j\'appelle ça une carrière.' },
    ]
  },
}
```

- [ ] **Step 2: Créer `src/game/characters/gula.ts`**

```ts
import type { CharacterPlugin, GameContext, SpinResult, DialogueLine, ItemInstance } from '../../types/index.ts'

const PARAMS = {
  betEscalationPercent: 0.12,
  betEscalationFloor: 1,
}

export function createGulaPlugin(): CharacterPlugin {
  let gulaBet = PARAMS.betEscalationFloor

  function getIncrement(ctx: GameContext): number {
    return ctx.economy.balance < 100
      ? PARAMS.betEscalationFloor
      : Math.round(ctx.economy.balance * PARAMS.betEscalationPercent * 100) / 100
  }

  return {
    id: 'gula',

    onSetup(ctx: GameContext): void {
      gulaBet = PARAMS.betEscalationFloor
      ctx.economy.forceSetBet(gulaBet)
    },

    onTeardown(_ctx: GameContext): void {
      gulaBet = PARAMS.betEscalationFloor
    },

    onAfterSpin(ctx: GameContext, _result: SpinResult): void {
      const increment = getIncrement(ctx)
      gulaBet = Math.round((gulaBet + increment) * 100) / 100
      ctx.economy.forceSetBet(gulaBet)
    },

    onShopSell(ctx: GameContext, item: ItemInstance): void {
      gulaBet = PARAMS.betEscalationFloor
      ctx.economy.forceSetBet(gulaBet)
      ctx.addLog(`Dévoré : ${item.name} — mise remise à ${gulaBet}⛧`, true)
    },

    onLossCheck(ctx: GameContext): boolean {
      return ctx.economy.balance < gulaBet
    },

    onDialogueTrigger(_ctx: GameContext): DialogueLine[] {
      return [
        { speaker: 'Le Croupier', text: 'Monsieur, votre mise a encore doublé.' },
        { speaker: 'Gula', text: 'Je sais. C\'est le prix de l\'appétit.' },
      ]
    },
  }
}
```

- [ ] **Step 3: Créer `src/game/characters/avaritia.ts`**

```ts
import type { CharacterPlugin, GameContext, SpinResult, DialogueLine, ItemDef } from '../../types/index.ts'

const PARAMS = {
  winMultiplier: 2,
  shopGates: [
    { progress: 0.0, maxTier: 0, priceMultiplier: null },
    { progress: 0.25, maxTier: 1, priceMultiplier: 2 },
    { progress: 0.5, maxTier: 2, priceMultiplier: 1.5 },
    { progress: 0.75, maxTier: 3, priceMultiplier: 1 },
  ],
  goal: 10000,
}

function getGate(ctx: GameContext) {
  const progress = ctx.economy.balance / PARAMS.goal
  let gate = PARAMS.shopGates[0]
  for (const g of PARAMS.shopGates) { if (progress >= g.progress) gate = g }
  return gate
}

export const avaritiaPlugin: CharacterPlugin = {
  id: 'avaritia',

  onAfterSpin(ctx: GameContext, result: SpinResult): void {
    if (result.totalWin > 0) {
      const bonus = result.totalWin * (PARAMS.winMultiplier - 1)
      ctx.economy.addMoney(bonus)
      result.totalWin *= PARAMS.winMultiplier
      result.winLines = result.winLines.map(l => ({ ...l, win: l.win * PARAMS.winMultiplier }))
    }
  },

  offerModifier(offer: ItemDef): ItemDef | null {
    // NOTE: gate calculated without ctx — avaritia needs ctx here
    // GameLoop doit passer ctx via closure lors de l'appel à offerModifier
    return offer
  },

  onDialogueTrigger(_ctx: GameContext): DialogueLine[] {
    return [
      { speaker: 'Le Croupier', text: 'Vous ne dépensez rien, madame. Comment comptez-vous acheter le ticket ?' },
      { speaker: 'Avaritia', text: 'En attendant. L\'attente est gratuite et elle rapporte sept pour cent.' },
    ]
  },
}
```

> **Note :** `offerModifier` pour avaritia a besoin du contexte. Le `GameLoop` doit construire la closure : `plugin.offerModifier ? (offer) => plugin.offerModifier!(offer, ctx) : null`. Adapter la signature dans `CharacterPlugin` si besoin lors de l'implémentation.

- [ ] **Step 4: Créer les stubs pour les personnages non encore implémentés**

Pour `ira.ts`, `invidia.ts`, `acedia.ts`, `superbia.ts` — créer des stubs avec juste `id` et `onDialogueTrigger` :

```ts
// ira.ts
import type { CharacterPlugin, DialogueLine, GameContext } from '../../types/index.ts'
export const iraPlugin: CharacterPlugin = {
  id: 'ira',
  onDialogueTrigger(_ctx: GameContext): DialogueLine[] {
    return [{ speaker: 'Le Croupier', text: 'Monsieur, la machine ne vous a rien fait.' }]
  },
}
```
Répéter le même pattern pour `invidia`, `acedia`, `superbia`.

- [ ] **Step 5: Créer `src/game/characters/joueur.ts`**

```ts
import type { CharacterPlugin, DialogueLine, GameContext } from '../../types/index.ts'
export const joueurPlugin: CharacterPlugin = {
  id: 'joueur',
  onDialogueTrigger(_ctx: GameContext): DialogueLine[] {
    return [
      { speaker: 'Le Croupier', text: 'Vous n\'êtes pas un péché, vous êtes un client. Nous vous aimons beaucoup.' },
      { speaker: 'Vous', text: 'Encore un tour et j\'arrête.' },
    ]
  },
}
```

- [ ] **Step 6: Créer `src/game/characters/index.ts`**

```ts
import type { CharacterPlugin } from '../../types/index.ts'
import { luxuriaPlugin } from './luxuria.ts'
import { createGulaPlugin } from './gula.ts'
import { avaritiaPlugin } from './avaritia.ts'
import { iraPlugin } from './ira.ts'
import { invidiaPlugin } from './invidia.ts'
import { acediaPlugin } from './acedia.ts'
import { superbiaPlugin } from './superbia.ts'
import { joueurPlugin } from './joueur.ts'

const STATELESS: Record<string, CharacterPlugin> = {
  luxuria: luxuriaPlugin,
  avaritia: avaritiaPlugin,
  ira: iraPlugin,
  invidia: invidiaPlugin,
  acedia: acediaPlugin,
  superbia: superbiaPlugin,
  joueur: joueurPlugin,
}

// Personnages stateful : factory appelée à chaque nouvelle run
const FACTORIES: Record<string, () => CharacterPlugin> = {
  gula: createGulaPlugin,
}

export function getCharacterPlugin(id: string): CharacterPlugin {
  if (FACTORIES[id]) return FACTORIES[id]()
  const plugin = STATELESS[id]
  if (!plugin) throw new Error(`Personnage inconnu : ${id}`)
  return plugin
}

export const CHARACTER_IDS = [
  'luxuria', 'gula', 'avaritia', 'ira', 'invidia', 'acedia', 'superbia', 'joueur'
]
```

- [ ] **Step 7: Vérifier `tsc --noEmit`**

- [ ] **Step 8: Commit**

```bash
git add src/game/characters/
git commit -m "feat: character plugin registry — 8 personnages avec hooks"
```

---

### Task 13: `DialogueUI.ts`

**Files:**
- Create: `src/ui/DialogueUI.ts`

**Interfaces:**
- Consumes: `DialogueLine` from `types/index.ts`
- Produces: `class DialogueUI` — `show(lines: DialogueLine[]): Promise<void>`, `hide()`

Le composant crée son propre DOM et s'attache au `body`. Il se ferme sur clic ou touche.

- [ ] **Step 1: Créer `src/ui/DialogueUI.ts`**

```ts
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
```

- [ ] **Step 2: Ajouter les styles minimaux dans `index.html` ou un CSS existant**

```css
.dialogue-overlay {
  position: fixed; inset: 0; z-index: 100;
  display: flex; align-items: flex-end; padding: 24px;
  background: rgba(0,0,0,0.5); cursor: pointer;
}
.dialogue-overlay.hidden { display: none; }
.dialogue-box {
  width: 100%; max-width: 700px; margin: 0 auto;
  background: var(--panel, #111); border: 1px solid var(--gold, #c39b52);
  padding: 20px 24px;
}
.dialogue-speaker {
  font-size: 11px; letter-spacing: .2em; text-transform: uppercase;
  color: var(--hot, #e0435c); margin-bottom: 10px;
}
.dialogue-text { margin: 0; font-size: 16px; line-height: 1.6; }
.dialogue-hint {
  margin-top: 12px; font-size: 10px; text-align: right;
  opacity: .5; letter-spacing: .1em; text-transform: uppercase;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/DialogueUI.ts
git commit -m "feat: DialogueUI — sequential dialogue lines, keyboard + click"
```

---

### Task 14: Migrer les fichiers UI existants

**Files:**
- Rename: `src/ui/ReelRenderer.js` → `src/ui/ReelRenderer.ts`
- Rename: `src/ui/HUD.js` → `src/ui/HUD.ts`
- Rename: `src/ui/ShopUI.js` → `src/ui/ShopUI.ts`
- Rename: `src/ui/CharacterSelect.js` → `src/ui/CharacterSelect.ts`
- Rename: `src/ui/ProfileModal.js` → `src/ui/ProfileModal.ts`

**Interfaces:**
- Consumes: `Souls`, `WinLine`, `Modifiers`, `ItemInstance`, `ItemDef`, `DialogueLine` from `types/index.ts`
- Produces: mêmes classes avec signatures typées

Migration mécanique — même logique, types ajoutés aux signatures. Exemple pour `HUD.ts` :

```ts
import type { Souls } from '../types/index.ts'

export class HUD {
  // Signatures existantes typées :
  update(stage: number, goal: Souls, balance: Souls, luck?: number): void { /* inchangé */ }
  setSpinEnabled(enabled: boolean): void { /* inchangé */ }
  setSpinLabel(label: string): void { /* inchangé */ }
  showEscalatingBet(bet: Souls, increment: Souls): void { /* inchangé */ }
  restoreBetChips(): void { /* inchangé */ }
}
```

Répéter pour chaque fichier UI : renommer, ajouter imports de types, typer les paramètres.

- [ ] **Step 1: Renommer et typer ReelRenderer.ts**
- [ ] **Step 2: Renommer et typer HUD.ts**
- [ ] **Step 3: Renommer et typer ShopUI.ts** — `ShopUI` devra utiliser `ItemDef` / `ItemInstance` à la place des anciens objets bonus
- [ ] **Step 4: Renommer et typer CharacterSelect.ts**
- [ ] **Step 5: Renommer et typer ProfileModal.ts**

- [ ] **Step 6: Vérifier `tsc --noEmit`**

- [ ] **Step 7: Commit**

```bash
git add src/ui/
git rm src/ui/ReelRenderer.js src/ui/HUD.js src/ui/ShopUI.js src/ui/CharacterSelect.js src/ui/ProfileModal.js
git commit -m "chore: migrate UI files to TypeScript"
```

---

### Task 15: `GameLoop.ts` — Cœur de l'architecture

**Files:**
- Create: `src/game/GameLoop.ts`

**Interfaces:**
- Consumes: tout — `Economy`, `BonusSystem`, `RunState`, `Progression`, `CharacterPlugin`, `MachineConfig`, `DialogueUI`, toutes les classes UI, `spin`, `calculateWins`, `getCharacterPlugin`, `getMachine`
- Produces: `class GameLoop` avec `startRun(characterId)`, `handleSpin()` — aucune logique personnage en dur

- [ ] **Step 1: Créer `src/game/GameLoop.ts`**

```ts
import type { CharacterPlugin, GameContext, SpinResult, UIContext } from '../types/index.ts'
import { Economy } from './Economy.ts'
import { BonusSystem } from './BonusSystem.ts'
import { RunState } from './RunState.ts'
import { Progression } from '../meta/Progression.ts'
import { spin, calculateWins } from './SlotMachine.ts'
import { getCharacterPlugin } from './characters/index.ts'
import { getMachine } from './machines/index.ts'
import { ReelRenderer } from '../ui/ReelRenderer.ts'
import { HUD } from '../ui/HUD.ts'
import { ShopUI } from '../ui/ShopUI.ts'
import { CharacterSelect } from '../ui/CharacterSelect.ts'
import { ProfileModal } from '../ui/ProfileModal.ts'
import { DialogueUI } from '../ui/DialogueUI.ts'
import { CHARACTERS, getCharacter } from './Characters.ts'

const SAVE_KEY = 'casinotro_v2'

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export class GameLoop {
  private economy = new Economy(100)
  private bonusSystem = new BonusSystem()
  private run = new RunState()
  private progression = new Progression()
  private plugin: CharacterPlugin = { id: 'joueur' }
  private isSpinning = false

  private renderer: ReelRenderer
  private hud: HUD
  private shop: ShopUI
  private characterSelect: CharacterSelect
  private profileModal: ProfileModal
  private dialogueUI: DialogueUI

  private get ctx(): GameContext {
    return {
      economy: this.economy,
      bonusSystem: this.bonusSystem,
      ui: this.uiContext,
      addLog: (msg, muted) => this.shop.addLog(msg, muted),
    }
  }

  private get uiContext(): UIContext {
    return {
      addLog: (msg, muted) => this.shop.addLog(msg, muted),
      triggerDialogue: (lines) => this.dialogueUI.show(lines),
      updateHUD: () => this.hud.update(
        this.run.stage,
        this.run.currentGoal,
        this.economy.balance,
        this.bonusSystem.getModifiers().luck
      ),
      updateShop: () => this.shop.updateDisplay(),
      showModifiers: (mods) => this.renderer.showModifiers(mods),
    }
  }

  constructor() {
    this.renderer = new ReelRenderer(() => this.restartRun())
    this.hud = new HUD(
      this.economy,
      () => this.handleSpin(),
      (amount) => { this.economy.setBet(amount); this.uiContext.updateHUD() }
    )
    this.dialogueUI = new DialogueUI()
    this.shop = new ShopUI(
      this.bonusSystem,
      this.economy,
      () => { this.uiContext.updateHUD(); this.renderer.showModifiers(this.bonusSystem.getModifiers()); this.save() },
      async (offer) => {
        if (offer.needsTarget === 'column') return this.renderer.selectColumn()
        if (offer.needsTarget === 'symbol') return this.renderer.selectSymbol()
        return null
      }
    )
    this.characterSelect = new CharacterSelect(CHARACTERS, (c) => this.startRun(c.id))
    this.profileModal = new ProfileModal()

    document.getElementById('pm-close')?.addEventListener('click', () => this.profileModal.close())
    document.querySelector('.char-hud-identity')?.addEventListener('click', () => {
      this.profileModal.open(this.run.characterId, this.economy, this.run, this.bonusSystem)
    })

    this.boot()
  }

  private boot(): void {
    const save = this.loadSave()
    if (save) {
      this.run.restore(save.run)
      this.economy.restore(save.economy)
      this.bonusSystem.restore(save.bonusSystem)
      this.plugin = getCharacterPlugin(this.run.characterId)
      this.plugin.onSetup?.(this.ctx)

      const machine = getMachine(this.run.machineId)
      const grid = save.grid
        ? save.grid.map((col: string[]) => col.map((id: string) => this.symbolById(id)))
        : spin({}, this.getLuckFactor(), this.plugin.getSpinOptions?.(this.ctx)).grid

      this.renderer.displayGrid(grid, this.bonusSystem.getModifiers())
      this.renderer.showModifiers(this.bonusSystem.getModifiers())
      this.shop.setOffers(save.shopOffers ?? [], this.economy.getShopLevel())
      this.uiContext.updateHUD()
      this.applyCharacterTheme()
      this.characterSelect.hide()
    }
    // Sans save : CharacterSelect reste visible
  }

  startRun(characterId: string): void {
    this.plugin.onTeardown?.(this.ctx)
    this.plugin = getCharacterPlugin(characterId)

    this.run.reset(characterId, 'megaways')
    this.economy.restart(100)
    this.bonusSystem.reset()
    this.renderer.hideGameOver()
    this.renderer.clearHighlights()
    this.characterSelect.hide()
    this.clearSave()

    this.plugin.onSetup?.(this.ctx)
    this.applyCharacterTheme()

    const opts = this.plugin.getSpinOptions?.(this.ctx) ?? {}
    const { grid } = spin({}, this.getLuckFactor(), opts)
    this.renderer.displayGrid(grid, this.bonusSystem.getModifiers())
    this.renderer.showModifiers(this.bonusSystem.getModifiers())
    this.shop.refresh(1)
    this.hud.setSpinEnabled(true)
    this.hud.setSpinLabel('SPIN')
    this.isSpinning = false
    this.uiContext.updateHUD()
    this.shop.addLog(`${getCharacter(characterId)?.emoji ?? ''} ${getCharacter(characterId)?.name ?? characterId} — bonne chance.`, true)
    this.save(grid)
  }

  async handleSpin(): Promise<void> {
    if (this.isSpinning || this.economy.isGameOver()) return
    if (!this.economy.placeBet()) {
      if (this.plugin.onLossCheck?.(this.ctx)) {
        this.gameOver('Mise impossible.')
      }
      return
    }

    this.isSpinning = true
    this.hud.setSpinEnabled(false)
    this.hud.setSpinLabel('SPIN…')
    this.renderer.hideWin()
    this.renderer.clearHighlights()
    this.uiContext.updateHUD()
    this.run.spinCount++

    // Dialogue premier spin
    if (!this.run.dialoguePlayed) {
      this.run.dialoguePlayed = true
      const lines = this.plugin.onDialogueTrigger?.(this.ctx)
      if (lines?.length) await this.dialogueUI.show(lines)
    }

    await this.plugin.onBeforeSpin?.(this.ctx)

    const mods = this.bonusSystem.getModifiers()
    const stickyPositions = mods.stickyPositions ?? {}
    const opts = this.plugin.getSpinOptions?.(this.ctx) ?? {}
    const { grid } = spin(stickyPositions, this.getLuckFactor(), opts)

    await this.renderer.animateSpin(grid)

    const result: SpinResult = calculateWins(grid, this.economy.currentBet, mods)
    this.bonusSystem.processPostSpin(result, grid)

    await this.plugin.onAfterSpin?.(this.ctx, result)

    if (result.totalWin > 0) {
      this.economy.addWin(result.totalWin)
      this.progression.updateHighscore(this.economy.balance)
      this.renderer.highlightWins(result.winLines)
      this.renderer.showWin(result.totalWin, result.winLines)
      this.uiContext.updateHUD()
      this.shop.addLog(this.buildWinLog(result))
      await this.plugin.onWin?.(this.ctx, result.totalWin)
      await delay(1400)
      this.renderer.hideWin()
      this.renderer.clearHighlights()
    } else {
      this.shop.addLog('Aucune combinaison.', true)
    }

    if (result.scatterTriggered) await this.handleFreeSpins(8)

    if (result.dropBonus && !this.bonusSystem.isFull) {
      const level = this.economy.getShopLevel()
      const offers = this.bonusSystem.getShopOffers(level)
      if (offers[0]) {
        this.bonusSystem.addBonus(offers[0], null)
        this.renderer.showWin(0, null, `🎁 ${offers[0].name}`)
        await delay(1600)
        this.renderer.hideWin()
      }
    }

    this.uiContext.updateHUD()
    this.shop.updateDisplay()
    this.checkStageProgress(grid)

    if (this.plugin.onLossCheck?.(this.ctx)) {
      this.gameOver('Condition de défaite du personnage.')
      return
    }
    if (this.economy.isGameOver()) {
      this.gameOver(`Niveau ${this.run.stage} · objectif ${this.run.currentGoal}⛧ · solde ${this.economy.balance.toFixed(2)}⛧`)
      return
    }

    this.save(grid)
    this.isSpinning = false
    await delay(150)
    this.hud.setSpinEnabled(true)
    this.hud.setSpinLabel('SPIN')
  }

  private async handleFreeSpins(count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      await delay(380)
      const mods = this.bonusSystem.getModifiers()
      const opts = this.plugin.getSpinOptions?.(this.ctx) ?? {}
      const { grid } = spin(mods.stickyPositions ?? {}, this.getLuckFactor(), opts)
      await this.renderer.animateSpin(grid)
      const result = calculateWins(grid, this.economy.currentBet, mods)
      this.bonusSystem.processPostSpin(result, grid)
      this.renderer.displayGrid(grid, this.bonusSystem.getModifiers())
      if (result.totalWin > 0) {
        this.economy.addWin(result.totalWin)
        this.renderer.highlightWins(result.winLines)
        this.renderer.showWin(result.totalWin, result.winLines)
        this.uiContext.updateHUD()
        await delay(900)
        this.renderer.hideWin()
        this.renderer.clearHighlights()
      }
    }
  }

  private checkStageProgress(grid: any[][]): void {
    if (this.economy.balance >= this.run.currentGoal) {
      if (this.run.stage < 3) {
        this.plugin.onStageComplete?.(this.ctx, this.run.stage)
        this.run.advanceStage()
        this.economy.setBetOptions(this.run.betOptions)
        this.shop.refresh(this.economy.getShopLevel())
        this.shop.addLog(`Palier ${this.run.stage} atteint — boutique renouvelée !`)
        this.uiContext.updateHUD()
        this.save(grid)
      }
      // Palier 3 atteint → victoire (pas de game over automatique, le joueur continue)
    }
  }

  private gameOver(text: string): void {
    this.clearSave()
    this.renderer.showGameOver(text)
    this.isSpinning = false
  }

  private restartRun(): void {
    this.clearSave()
    this.renderer.hideGameOver()
    this.renderer.clearHighlights()
    this.hud.setSpinEnabled(false)
    this.characterSelect.show()
  }

  private getLuckFactor(): number {
    const luckBonus = this.plugin.getLuckBonus?.(this.ctx) ?? 0
    return (this.bonusSystem.getModifiers().luck + luckBonus) / 100 + this.economy.rtpNudge
  }

  private applyCharacterTheme(): void {
    const char = getCharacter(this.run.characterId)
    if (!char) return
    document.documentElement.style.setProperty('--char-color', char.color ?? '#0f1110')
    const emojiEl = document.getElementById('char-hud-emoji')
    const nameEl  = document.getElementById('char-hud-name')
    const sinEl   = document.getElementById('char-hud-sin')
    if (emojiEl) emojiEl.textContent = char.emoji
    if (nameEl)  nameEl.textContent  = char.name
    if (sinEl)   sinEl.textContent   = char.sin
  }

  private buildWinLog(result: SpinResult): string {
    if (!result.winLines.length) return 'Aucune combinaison.'
    const best = result.winLines.reduce((a, b) => b.count > a.count ? b : a)
    return `${best.count} × ${best.symbolId} — +${result.totalWin.toFixed(2)}⛧`
  }

  private symbolById(id: string): any {
    const { SYMBOLS } = require('./Symbols.ts')
    return SYMBOLS.find((s: any) => s.id === id) ?? SYMBOLS[0]
  }

  // ── Save ─────────────────────────────────────────────────
  private save(grid?: any[][]): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        run:         this.run.serialize(),
        economy:     this.economy.serialize(),
        bonusSystem: this.bonusSystem.serialize(),
        shopOffers:  this.shop.getOffers(),
        grid:        grid?.map(col => col.map((s: any) => s.id)),
      }))
    } catch {}
  }

  private loadSave(): any {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  }

  private clearSave(): void {
    try { localStorage.removeItem(SAVE_KEY) } catch {}
  }
}
```

> **Note :** La méthode `symbolById` utilise un import dynamique — remplacer par un import statique de `SYMBOLS` en haut de fichier. Le `require` est un placeholder pour forcer l'attention de l'exécutant sur ce point.

> **Note :** `economy.setBetOptions()` n'existe pas encore — l'ajouter dans `Economy.ts` lors de cette tâche :
> ```ts
> setBetOptions(options: Souls[]): void {
>   BET_OPTIONS.splice(0, BET_OPTIONS.length, ...options)
>   if (!options.includes(this.#currentBet)) this.#currentBet = options[0]
> }
> ```
> Ou exporter `BET_OPTIONS` comme tableau mutable et le remplacer directement.

- [ ] **Step 2: Vérifier `tsc --noEmit`**

- [ ] **Step 3: Commit**

```bash
git add src/game/GameLoop.ts
git commit -m "feat: GameLoop.ts — orchestration sans logique personnage"
```

---

### Task 16: `main.ts` Bootstrap + `Characters.ts`

**Files:**
- Create: `src/main.ts`
- Modify: `src/game/Characters.js` → `src/game/Characters.ts`
- Modify: `src/game/CharacterState.js` → `src/game/CharacterState.ts`
- Delete: `src/main.js` (remplacé par GameLoop + main.ts)

**Interfaces:**
- Consumes: `GameLoop` from `game/GameLoop.ts`
- Produces: une ligne de bootstrap

- [ ] **Step 1: Migrer `Characters.ts`**

Renommer, ajouter type `Character` :

```ts
export interface Character {
  id: string
  name: string
  sin: string
  emoji: string
  description: string
  color?: string
  unlockOrder: number
  hidden?: boolean
  goal?: number
  effect: { type: string; key?: string; params?: Record<string, any> }
}
```

Typer `CHARACTERS: Character[]` et `getCharacter`.

- [ ] **Step 2: Migrer `CharacterState.ts`** (renommer, corps inchangé)

- [ ] **Step 3: Créer `src/main.ts`**

```ts
import { GameLoop } from './game/GameLoop.ts'

new GameLoop()
```

- [ ] **Step 4: Supprimer `src/main.js`**

```bash
git rm src/main.js
```

- [ ] **Step 5: Vérifier que `npm run dev` démarre et le jeu fonctionne**

Tester : sélectionner Luxuria, lancer un spin, vérifier que le dialogue apparaît au premier spin, vérifier que les gains s'affichent.

- [ ] **Step 6: Commit**

```bash
git add src/main.ts src/game/Characters.ts src/game/CharacterState.ts
git rm src/main.js src/game/Characters.js src/game/CharacterState.js
git commit -m "feat: main.ts bootstrap + Characters migrated to TS, main.js removed"
```

---

### Task 17: Tests — Migration et smoke tests

**Files:**
- Rename: `src/game/BonusSystem.test.ts` ← déjà fait en Task 8
- Rename: `src/game/SlotMachine.test.ts` ← déjà fait en Task 6
- Create: `src/game/RunState.test.ts`
- Create: `src/game/characters/characters.test.ts`

**Interfaces:**
- Consumes: `RunState`, `getCharacterPlugin`, `Economy`
- Produces: suite de tests passants

- [ ] **Step 1: Créer `src/game/RunState.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { RunState, STAGE_GOALS, INITIAL_BET_OPTIONS } from './RunState.ts'

describe('RunState', () => {
  it('démarre au stage 1 avec les paliers par défaut', () => {
    const run = new RunState()
    expect(run.stage).toBe(1)
    expect(run.currentGoal).toBe(500)
    expect(run.betOptions).toEqual([1, 2, 5, 10, 25])
  })

  it('advanceStage passe au stage 2 et escalade les mises', () => {
    const run = new RunState()
    run.advanceStage()
    expect(run.stage).toBe(2)
    expect(run.betOptions[0]).toBe(25) // max du stage 1 = nouveau min
    expect(run.currentGoal).toBe(2000)
  })

  it('advanceStage depuis stage 3 ne fait rien', () => {
    const run = new RunState()
    run.advanceStage(); run.advanceStage(); run.advanceStage()
    expect(run.stage).toBe(3)
  })

  it('reset remet tout à zéro', () => {
    const run = new RunState()
    run.advanceStage()
    run.reset('gula', 'megaways')
    expect(run.stage).toBe(1)
    expect(run.betOptions).toEqual([1, 2, 5, 10, 25])
    expect(run.characterId).toBe('gula')
  })

  it('serialize / restore est symétrique', () => {
    const run = new RunState()
    run.advanceStage()
    run.spinCount = 42
    const data = run.serialize()
    const run2 = new RunState()
    run2.restore(data)
    expect(run2.stage).toBe(2)
    expect(run2.spinCount).toBe(42)
  })
})
```

- [ ] **Step 2: Créer `src/game/characters/characters.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { getCharacterPlugin, CHARACTER_IDS } from './index.ts'

describe('getCharacterPlugin', () => {
  it('retourne un plugin pour chaque personnage', () => {
    for (const id of CHARACTER_IDS) {
      const plugin = getCharacterPlugin(id)
      expect(plugin.id).toBe(id)
    }
  })

  it('gula retourne une nouvelle instance à chaque appel (factory)', () => {
    const a = getCharacterPlugin('gula')
    const b = getCharacterPlugin('gula')
    expect(a).not.toBe(b)
  })

  it('luxuria retourne toujours la même instance (singleton)', () => {
    const a = getCharacterPlugin('luxuria')
    const b = getCharacterPlugin('luxuria')
    expect(a).toBe(b)
  })

  it('getCharacterPlugin lève une erreur pour un id inconnu', () => {
    expect(() => getCharacterPlugin('fantome')).toThrow('Personnage inconnu')
  })
})
```

- [ ] **Step 3: Lancer tous les tests**

```bash
npx vitest run
```
Expected: tous passent.

- [ ] **Step 4: Commit**

```bash
git add src/game/RunState.test.ts src/game/characters/characters.test.ts
git commit -m "test: RunState + character plugin registry"
```

---

## Récapitulatif des tâches

| # | Tâche | Deliverable |
|---|---|---|
| 1 | TS Setup | Projet compile en TS |
| 2 | Core Types | `types/index.ts` |
| 3 | Random.ts | Utilitaire typé |
| 4 | Symbols.ts | Symboles typés |
| 5 | Economy.ts | Economy typée + alias Souls |
| 6 | SlotMachine.ts | Spin/wins typés |
| 7 | Item Pool | `items/index.ts` — bonus + consommables |
| 8 | BonusSystem.ts | Utilise ItemDef, plus de BONUS_POOL interne |
| 9 | RunState.ts | Source de vérité run |
| 10 | Machine Registry | `machines/megaways.ts` + `machines/index.ts` |
| 11 | Progression.ts | Highscore + machines débloquées |
| 12 | Character Plugins | 8 fichiers + registre + factory pattern |
| 13 | DialogueUI.ts | Dialogue séquentiel |
| 14 | Migrate UI | 5 fichiers typés |
| 15 | GameLoop.ts | Orchestration sans logique perso |
| 16 | main.ts | Bootstrap 1 ligne |
| 17 | Tests | RunState + character registry |
