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
2. `spin(machine, stickyPositions, luckFactor, spinOptions)` → `{ grid, rowCounts }`
3. `calculateWins(machine, grid, bet, modifiers)` → `SpinResult`
4. `bonusSystem.processPostSpin(result, grid)` updates chain counters and sticky positions
5. `plugin.onAfterSpin?.(ctx, result)` — character hook fires
6. UI updates: `renderer`, `hud`, `shop`

### Character plugin system

Each playable character (`src/game/characters/`) implements `CharacterPlugin` (defined in `src/types/index.ts`). All hooks are optional:

- **Stateless** characters (no internal state) export a singleton object → registered in `STATELESS` map in `characters/index.ts`
- **Stateful** characters export a factory function `createXPlugin()` → registered in `FACTORIES` map

`getCharacterPlugin(id)` is the single entry point — it handles both patterns.

Key hooks: `onBeforeSpin`, `onAfterSpin`, `onWin`, `onStageComplete`, `onLossCheck`, `onDialogueTrigger`, `getSpinOptions`, `getLuckBonus`, `offerModifier`.

### Machines

A `MachineConfig` (`src/game/machines/`) owns everything about how a machine behaves:
geometry, symbol pool, paytable, and win evaluator. `getMachine(run.machineId)` is the
single entry point; a character selects its machine via `Character.machineId`.

Two real casino mechanics are implemented, chosen per machine via `evaluator`:

- **`'ways'`** (`megaways`) — a symbol counts anywhere in its column. A win needs the
  symbol on ≥`minMatch` consecutive reels starting at reel 1; the payout is multiplied
  by the number of distinct combinations (product of occurrences per reel). Columns are
  2–7 rows, drawn per spin.
- **`'lines'`** (`rigide`, Ira's machine) — 20 fixed paylines over a 6×5 grid, one cell
  per reel. The reference symbol is the first non-wild on the line.

Wild substitutes for any paying symbol; scatter never forms a combination and only
triggers free spins at `scatterMin`.

Adding a machine = one file in `src/game/machines/` plus a line in its `index.ts`.
`machines.test.ts` validates every registered config (paytable coverage, monotonic
payouts, rarity ordering, payline bounds).

### RTP

Each machine declares `rtpTarget`. The single balancing knob is the `SCALE` constant in
the machine file, which scales the whole paytable without changing its shape.
`SlotMachine.rtp.test.ts` measures the real RTP by Monte-Carlo (300k spins over 3 seeds,
free spins included, shop items excluded) and fails if a machine drifts off target.

Because the measurement needs reproducibility, **all randomness goes through
`src/utils/Random.ts`** — never call `Math.random()` in `src/game/`. `seedRng(n)` makes
any sequence deterministic.

### Run progression

`RunState` tracks `stage` (1→2→3), `stageGoals` (500⛧ / 2000⛧ / 10000⛧), and `betOptions`. Advancing a stage scales bet options by the last bet in the current set.

`Economy.rtpNudge` nudges symbol weights toward 92% RTP once ≥50⛧ wagered — invisible to
players. It rides the `nudge` field of `LuckProfile`, deliberately **not** amplified by the
rarity gains.

### Luck: two independent axes

`LuckProfile` (`src/game/Symbols.ts`) replaces the old single `luck` number, because the two
things players call "luck" pull in opposite directions:

- **`rarity`** (*convoitise*) — biases weights toward high payers via `RARITY_BIAS`. Bigger
  wins, slightly *fewer* of them. Gains are asymmetric (`RARITY_POS_GAIN` 3 /
  `RARITY_NEG_GAIN` 0.4): a symmetric bias destroys more small wins than it creates big
  ones and lowers RTP.
- **`cohesion`** (*régularité*) — `pickAnchor()` draws one anchor symbol per spin (weighted
  on base weights, wild/scatter excluded) and overweights it on the first `minMatch` reels
  only. Raises hit rate on both evaluators; extending it to every reel multiplies full-line
  wins and blows RTP up (measured ×2 to ×7).

Both are clamped in `toLuckProfile()`. `Modifiers` carries `rarity` and `cohesion`;
`SlotMachine.luck.test.ts` guards that each axis still moves its own metric.

Bet tiers live on the `Economy` instance (`betOptions`), never in a shared module-level
array. `DEFAULT_BET_OPTIONS` is frozen. The HUD must call `rebuildBetChips()` whenever
the tiers change.

### Persistence

- **In-run:** `localStorage` key `casinotro_v3` — serializes `RunState`, `Economy`, `BonusSystem`, current grid, and shop offers. Restored on `boot()`.
- **Meta:** `localStorage` key `casinotro_meta_v2` — highscore and unlocked machines via `Progression`.

`Progression` is the only owner of the highscore. `Economy` reads and writes it through
the injected `HighscoreStore` — it has no storage of its own.

### Items (bonuses + consumables)

`BonusSystem` manages up to 5 active `ItemInstance`s. `BONUS_POOL` in `BonusSystem.ts` defines all available items. Items with `needsTarget: 'column'` or `'symbol'` require a target set at purchase time. `getModifiers()` aggregates all active instances into a single `Modifiers` object consumed by `calculateWins`.

### Currency

`Souls` = `number` (aliased in `src/types/index.ts`). Displayed as `⛧` in logs/UI, `$` not used.

## Key constraints

- PixiJS v8 only — use `app.init()` async, `app.canvas` (not `app.view`), `new Text({ text, style })` object syntax
- Tests only cover `src/game/` — UI modules (`src/ui/`) are verified manually in browser
- No CSS framework — styles are inline HTML or PixiJS Graphics
- All characters are the seven deadly sins plus a neutral `joueur` character
- No `Math.random()` inside `src/game/` — use `src/utils/Random.ts` so RTP stays measurable
- Symbol geometry belongs to the machine, never to a character's `effect.params`
