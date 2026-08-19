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

**Stack:** Vite, Vitest, TypeScript ESModules, SCSS. No rendering library — the reels are plain DOM elements built by `ReelRenderer`, styled by SCSS partials. Imports carry explicit `.ts` extensions (`allowImportingTsExtensions`).

**Entry point:** `src/main.ts` → `new GameLoop()`. All orchestration lives in `GameLoop`.

### Layer separation

```
src/game/    — pure logic, no DOM. Tested with Vitest.
src/ui/      — DOM construction + event wiring. Tested manually only.
src/meta/    — cross-run persistence (highscore, unlocked machines).
src/types/   — shared TypeScript interfaces (GameSymbol, SpinResult, Modifiers, CharacterPlugin, …)
src/styles/  — SCSS partials, all imported by main.scss (itself imported by main.ts).
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

`BonusSystem` manages up to 5 active `ItemInstance`s. `ITEM_POOL` in `src/game/items/index.ts` defines all available items. Items with `needsTarget: 'column'` or `'symbol'` require a target set at purchase time. `getModifiers()` aggregates all active instances into a single `Modifiers` object consumed by `calculateWins`.

### Currency

`Souls` = `number` (aliased in `src/types/index.ts`). Displayed as `⛧` in logs/UI, `$` not used.

## Key constraints

- Tests only cover `src/game/` — UI modules (`src/ui/`) are verified manually in browser. Vitest runs with `environment: 'node'`, so anything touching `document` cannot be tested as-is.
- No CSS framework and no inline `<style>` — all styling lives in `src/styles/*.scss`
- Build DOM with `createElement` / `textContent`, never `innerHTML` — keeps the app free of injection surface
- A character's id in `CHARACTERS` (`Characters.ts`) must match its plugin key in `characters/index.ts`; `characters.test.ts` enforces this
- Character params are declared in `Characters.ts` under `effect.params`, but plugins currently redeclare their own local `PARAMS` — the two can drift (see `docs/AUDIT.md` §2.1)
- All characters are the seven deadly sins plus a neutral `joueur` character
