# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite dev server → http://localhost:5173
npm run build        # Production build
npm test             # Vitest (run once)
npm run test:watch   # Vitest (watch mode)
npx vitest run src/game/Economy.test.ts  # Single test file
```

## Architecture

Browser roguelike slot machine. No backend — `localStorage` only.

**Stack:** PixiJS v8, Vite, Vitest, TypeScript ESModules. Canvas is 1200×750, mounted via `app.canvas` (PixiJS v8 API — not `app.view`).

**Entry point:** `src/main.ts` → `new GameLoop()`. All orchestration lives in `GameLoop`.

### Layer separation

```
src/game/    — pure logic, no DOM, no PixiJS. Tested with Vitest.
src/ui/      — PixiJS rendering + HTML DOM wiring. Tested manually only.
src/meta/    — cross-run persistence (highscore, unlocked machines).
src/types/   — shared TypeScript interfaces (GameSymbol, SpinResult, Modifiers, CharacterPlugin, …)
```

### Data flow per spin

1. `GameLoop.handleSpin()` calls `bonusSystem.getModifiers()` → `Modifiers`
2. `spin(stickyPositions, luckFactor, spinOptions)` → `{ grid }` (6-reel Megaways grid)
3. `calculateWins(grid, bet, modifiers)` → `SpinResult`
4. `bonusSystem.processPostSpin(result, grid)` updates chain counters and sticky positions
5. `plugin.onAfterSpin?.(ctx, result)` — character hook fires
6. UI updates: `renderer`, `hud`, `shop`

### Character plugin system

Each playable character (`src/game/characters/`) implements `CharacterPlugin` (defined in `src/types/index.ts`). All hooks are optional:

- **Stateless** characters (no internal state) export a singleton object → registered in `STATELESS` map in `characters/index.ts`
- **Stateful** characters export a factory function `createXPlugin()` → registered in `FACTORIES` map

`getCharacterPlugin(id)` is the single entry point — it handles both patterns.

Key hooks: `onBeforeSpin`, `onAfterSpin`, `onWin`, `onStageComplete`, `onLossCheck`, `onDialogueTrigger`, `getSpinOptions`, `getLuckBonus`, `offerModifier`, `getModifierOverrides`.

Characters can also declare `actions: CharacterAction[]` — buttons rendered next to SPIN by `HUD.setCharacterActions()`. An action receives `GameContext` and may call `ctx.requestSpin({ free, globalMultiplier, luckBonus })` to trigger a spin outside the normal bet flow (used by Ira's FRAPPER). `Modifiers.cellDamage` is a 6×7 grid of per-cell damage states (0 intact / 1 cracked / 2 dead) consumed by `calculateWins`; `SpinOptions.minRowsPerReel` keeps damaged cells on screen despite variable Megaways row counts.

### Run progression

`RunState` tracks `stage` (1→2→3), `stageGoals` (500⛧ / 2000⛧ / 10000⛧), and `betOptions`. Advancing a stage scales bet options by the last bet in the current set.

`Economy.rtpNudge` nudges the luck factor toward 92% RTP once ≥50⛧ wagered — implemented as a weight adjustment in symbol selection, invisible to players.

### Persistence

- **In-run:** `localStorage` key `casinotro_v2` — serializes `RunState`, `Economy`, `BonusSystem`, current grid, and shop offers. Restored on `boot()`.
- **Meta:** `localStorage` key `casinotro_meta_v2` — highscore and unlocked machines via `Progression`.

### Items (bonuses + consumables)

`BonusSystem` manages up to 5 active `ItemInstance`s. `BONUS_POOL` in `BonusSystem.ts` defines all available items. Items with `needsTarget: 'column'` or `'symbol'` require a target set at purchase time. `getModifiers()` aggregates all active instances into a single `Modifiers` object consumed by `calculateWins`.

### Currency

`Souls` = `number` (aliased in `src/types/index.ts`). Displayed as `⛧` in logs/UI, `$` not used.

## Key constraints

- PixiJS v8 only — use `app.init()` async, `app.canvas` (not `app.view`), `new Text({ text, style })` object syntax
- Tests only cover `src/game/` — UI modules (`src/ui/`) are verified manually in browser
- No CSS framework — styles are inline HTML or PixiJS Graphics
- All characters are the seven deadly sins plus a neutral `joueur` character
