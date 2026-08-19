# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite dev server → http://localhost:5173
npm run build        # Production build
npm test             # Vitest (run once)
npm run test:watch   # Vitest (watch mode)
npx vitest run src/game/Economy.test.ts  # Single test file
npm run typecheck    # tsc --noEmit (strict)
npm run check        # typecheck + tests + build, same as CI
```

## Architecture

Browser roguelike slot machine. No backend — `localStorage` only.

**Stack:** Vite, Vitest, TypeScript ESModules, SCSS. No rendering library — the reels are plain DOM elements built by `ReelRenderer`, styled by SCSS partials. Imports carry explicit `.ts` extensions (`allowImportingTsExtensions`).

**Entry point:** `src/main.ts` → `new GameLoop()`. All orchestration lives in `GameLoop`.

### Layer separation

```
src/game/    — pure logic, no DOM. Tested with Vitest.
src/ui/      — DOM construction + event wiring. Tested under jsdom (see Key constraints).
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

`Economy.rtpNudge` raises the luck factor when measured RTP sits below the 92% target, once ≥50⛧ has been wagered. It is a genuine negative feedback loop: measured over 20k spins it pulls RTP from 0.77 to ~0.88 while the nudge itself decays from 0.31 to 0.10.

### Payout model

Two rules decide a win, and they are load-bearing — changing either one moves the RTP a lot:

1. **Chain length** picks the tier (`WIN_MULTIPLIERS`: 3→0.85, 4→3.4, 5→11.8, 6→35).
2. **Symbol rarity** scales it (`SYMBOL_VALUE`: lemon 1 … dog 2.75).

A symbol counts on a reel when it fills 40% of that column, **except premium symbols** (`PREMIUM_SYMBOLS`: star, dog) which count from a single cell. Without that exception rare symbols essentially never chain — the dog appeared in 1 chain per 30 000 spins — which is what made luck reduce the return.

Two guards keep that exception from exploding, both found by playtest rather than by reasoning:

- Premium chains cap at `PREMIUM_MAX_TIER` (5), never reaching the jackpot tier. A premium chain's odds are `P(≥1 per column)^6`, so the jackpot tier made every rarity bonus explosive.
- `rareMultiplier` (Luxuria) applies **only** to premium symbols, never to wild or scatter. Wild substitutes for every symbol, so boosting it made every line chain at once — worth nearly ×3 RTP on its own.

These numbers come from simulation, not intuition. `SlotMachine.rtp.test.ts` asserts the baseline lands near 0.92, that RTP rises with luck, and that max luck does not double it. Re-run it after touching any weight, multiplier or bias.

### Persistence

- **In-run:** `localStorage` key `casinotro_v2` — serializes `RunState`, `Economy`, `BonusSystem`, current grid, and shop offers. Restored on `boot()`.
- **Meta:** `localStorage` key `casinotro_meta_v2` — highscore and unlocked machines via `Progression`.

### Items (bonuses + consumables)

`BonusSystem` manages up to 5 active `ItemInstance`s. `ITEM_POOL` in `src/game/items/index.ts` defines all available items. Items with `needsTarget: 'column'` or `'symbol'` require a target set at purchase time. `getModifiers()` aggregates all active instances into a single `Modifiers` object consumed by `calculateWins`.

### Currency

`Souls` = `number` (aliased in `src/types/index.ts`). Displayed as `⛧` in logs/UI, `$` not used.

## Key constraints

- Vitest defaults to `environment: 'node'`. A test needing the DOM or `localStorage` opts in with `// @vitest-environment jsdom` on its first line, and mounts the real page via `mountIndexHtml()` from `src/test/domFixture.ts` — never a hand-written DOM, so a renamed id in `index.html` fails a test instead of the app.
- `ReelRenderer` animations are not covered: they run on real timers. Tests exercise construction, wiring and state, not the spin animation.
- No CSS framework and no inline `<style>` — all styling lives in `src/styles/*.scss`
- Build DOM with `createElement` / `textContent`, never `innerHTML` — keeps the app free of injection surface
- A character's id in `CHARACTERS` (`Characters.ts`) must match its plugin key in `characters/index.ts`; `characters.test.ts` enforces this
- Character params live in the plugin module (`LUXURIA_PARAMS`, `GULA_PARAMS`, `AVARITIA_PARAMS`, `IRA_PARAMS`) and `Characters.ts` references those exports. Never restate the values in `Characters.ts`, and never import `Characters.ts` from a plugin — params flow one way to avoid a cycle
- `Math.random` is not called directly in `src/game/`: the random-consuming functions take an optional trailing `rng`, which is what makes the RTP tests deterministic
- All characters are the seven deadly sins plus a neutral `joueur` character
