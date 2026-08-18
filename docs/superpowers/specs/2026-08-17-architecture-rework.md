# Casinotro — Architecture Rework
*Date: 2026-08-17*

## Contexte

La base actuelle (`main.js` ~380 lignes) est un module-dieu qui orchestre tout : effets
de personnage (`if effectKey === 'gula'`), sauvegarde, UI, boucle de jeu. Ajouter les 5
personnages restants (Ira, Invidia, Acedia, Superbia + Le Joueur) et les nouvelles
mécaniques (machines multiples, items consommables, dialogues, meta-progression) casserait
l'architecture. Ce rework pose une base extensible avant d'implémenter ces features.

---

## Stack

- **TypeScript** (migration depuis JS vanilla) — Vite transpile via esbuild, zéro impact
  sur le build time. `tsc --noEmit` pour le type-check.
- **Vite** — inchangé
- **Vitest** — inchangé, tests existants migrés en `.ts`

---

## Changements de règles

| Règle | Avant | Après |
|---|---|---|
| Monnaie | `$` | `⛧` (âmes) |
| Objectif | Levels infinis (goal × 2.6) | 3 paliers fixes : 500 → 2 000 → 10 000⛧ |
| Passage de palier | Shop refresh + nouveau goal | Shop refresh + escalade des mises |
| Escalade des mises | — | La mise max du palier devient la mise min du suivant |
| Perte | Balance = 0 | Balance insuffisante OU condition perso |
| Machine | 1 fixe (Megaways) | Multiple, débloquées par meta-progression |
| Personnages | 7 péchés | 7 péchés + Le Joueur (aucune mécanique) |
| Items | Bonus permanents/temporaires | Bonus permanents + items consommables (charges) |
| Dialogues | — | Base : déclenché au premier spin |

---

## Architecture — Approche B (modules plats + hook registry)

### Principe

`GameLoop.ts` orchestre la boucle de jeu et appelle les hooks optionnels du personnage
actif via `plugin.hook?.(ctx)`. Chaque personnage est un fichier isolé. Ajouter un
personnage = créer un fichier, l'enregistrer dans `characters/index.ts`. Aucune modification
de `GameLoop.ts`.

---

## Structure de fichiers

```
src/
  types/
    index.ts            — types partagés (RunState, CharacterPlugin, MachineConfig, …)
  game/
    GameLoop.ts         — orchestration (remplace main.js)
    RunState.ts         — état centralisé + mutations pures
    Economy.ts          — balance, mises, highscore (migré TS)
    SlotMachine.ts      — spin, calculateWins (migré TS)
    BonusSystem.ts      — bonus actifs, modificateurs (migré TS)
    Symbols.ts          — définition symboles (migré TS)
    characters/
      index.ts          — registre : { [id: string]: CharacterPlugin }
      luxuria.ts
      gula.ts
      avaritia.ts
      ira.ts
      invidia.ts
      acedia.ts
      superbia.ts
      joueur.ts
    machines/
      index.ts          — registre : { [id: string]: MachineConfig }
      megaways.ts       — machine actuelle (6 rouleaux, 2-7 rangées)
    items/
      index.ts          — pool d'items (bonus + consommables)
  ui/
    ReelRenderer.ts
    HUD.ts
    ShopUI.ts
    DialogueUI.ts       — nouveau
    CharacterSelect.ts
    ProfileModal.ts
  utils/
    Random.ts
  meta/
    Progression.ts      — machines débloquées, highscore (localStorage)
  main.ts               — bootstrap uniquement (new GameLoop())
```

---

## Types clés (`src/types/index.ts`)

```ts
// Monnaie
type Souls = number  // toujours en âmes (⛧)

// État d'une run
interface RunState {
  stage: 1 | 2 | 3
  stageGoals: [Souls, Souls, Souls]  // ex: [500, 2000, 10000]
  stageCleared: [boolean, boolean, boolean]
  betOptions: Souls[]                // escalade à chaque palier
  machineId: string
  characterId: string
  spinCount: number
  dialoguePlayed: boolean
}

// Plugin personnage
interface CharacterPlugin {
  id: string
  // Hooks optionnels — GameLoop appelle plugin.hook?.(ctx)
  onSetup?(ctx: GameContext): void
  onTeardown?(ctx: GameContext): void
  onBeforeSpin?(ctx: GameContext): void
  onAfterSpin?(ctx: GameContext, result: SpinResult): void
  onWin?(ctx: GameContext, amount: Souls): void
  onStageComplete?(ctx: GameContext, stage: number): void
  onShopPurchase?(ctx: GameContext, item: ItemInstance): void
  onShopSell?(ctx: GameContext, item: ItemInstance): void
  onLossCheck?(ctx: GameContext): boolean  // true = game over
  onDialogueTrigger?(ctx: GameContext): DialogueLine[]
}

// Config machine
interface MachineConfig {
  id: string
  name: string
  reelCount: number
  minRows: number
  maxRows: number
  rtpTarget: number
  unlockRequirement?: string  // id de la machine précédente
}

// Items
type ItemKind = 'bonus' | 'consumable'

interface ItemDef {
  id: string
  name: string
  description: string
  level: 1 | 2 | 3
  price: Souls
  kind: ItemKind
  effect: string
  charges?: number        // consommable seulement
  needsTarget?: 'column' | 'symbol' | null
}

interface ItemInstance extends ItemDef {
  instanceId: string
  target?: number | string | null
  remainingCharges?: number
}

// Dialogue
interface DialogueLine {
  speaker: string
  text: string
}

// Contexte passé aux hooks
interface GameContext {
  run: RunState
  economy: Economy
  bonusSystem: BonusSystem
  inventory: ItemInstance[]
  ui: UIContext  // accès aux méthodes UI sans couplage direct
}
```

---

## GameLoop.ts

Responsabilités :
- Charge le plugin du personnage actif depuis le registre
- Appelle les hooks au bon moment
- Orchestre : spin → animation → calcul → wins → shop → save
- Ne contient **aucune logique** spécifique à un personnage

```ts
// Pseudo-code
async handleSpin() {
  await plugin.onBeforeSpin?.(ctx)
  const result = doSpin()
  await animateSpin(result)
  const wins = calculateWins(result)
  await plugin.onAfterSpin?.(ctx, wins)
  if (wins.totalWin > 0) await plugin.onWin?.(ctx, wins.totalWin)
  checkStageProgress()
  if (plugin.onLossCheck?.(ctx)) return gameOver()
  save()
}
```

---

## RunState.ts

Source de vérité unique. Exposé en lecture, muté uniquement via méthodes. Sérialisable
pour la sauvegarde.

```ts
class RunState {
  stage: 1 | 2 | 3 = 1
  stageGoals: [Souls, Souls, Souls] = [500, 2000, 10000]
  betOptions: Souls[] = [1, 2, 5, 10, 25]

  advanceStage(): void {
    // incrémente stage, escalade les mises (max actuel → nouveau min)
    const newMin = this.betOptions[this.betOptions.length - 1]
    this.betOptions = [newMin, newMin*2, newMin*5, newMin*10, newMin*25]
    this.stage++
  }
}
```

---

## Progression.ts (meta)

Persiste dans localStorage séparément de la save de run.
- Machines débloquées (par défaut : `megaways` uniquement)
- Highscore global

---

## Dialogue

`DialogueUI.ts` : composant UI simple, affiche une file de `DialogueLine[]`.
Déclenché par `GameLoop` au premier spin (`!run.dialoguePlayed`). Les lignes viennent
de `plugin.onDialogueTrigger?.(ctx)`.

---

## Migration JS → TS

1. `tsconfig.json` + `vite.config.ts` mis à jour
2. Renommer `.js` → `.ts` fichier par fichier
3. Typer progressivement (strict mode optionnel au départ)
4. Tests Vitest inchangés (Vitest supporte TS nativement)

---

## Ce qui est hors-scope

- Implémentation des mécaniques Ira/Invidia/Acedia/Superbia (hooks présents, logique à venir)
- Nouveau design visuel (arcade crasse)
- Sons / musique
- Leaderboard en ligne
