# Audit technique — casinotro

Date : 2026-08-18 · Branche : `feat/architecture-rework`

État de départ : `npx vitest run` → 66 tests passent (7 fichiers). `npx vite build` → OK (52 kB JS / 24 kB CSS). `npx tsc --noEmit` → 1 erreur (voir §5.1).

Périmètre : `src/game`, `src/ui`, `src/meta`, `src/types`, `index.html`, configuration.

> **Suivi.** Tout le §7 a été traité sur la branche `fix/blocking-bugs`, sauf §2.5
> (découpage de `GameLoop`) et le rééquilibrage du RTP découvert en cours de route
> (voir §8). État actuel : `tsc --noEmit` propre en `strict`, 131 tests, CI en place.

---

## 1. Bugs fonctionnels confirmés

### 1.1 — Avaritia crédite ses gains deux fois (critique)

`src/game/characters/avaritia.ts:52` appelle `ctx.economy.addWin(amplified)` **et** assigne `result.totalWin = amplified`. Or `GameLoop.handleSpin` fait ensuite, ligne 179, `this.economy.addWin(result.totalWin)`. Le joueur touche donc ×4 au lieu de ×2.

Correctif : le plugin ne doit que muter `result` — le crédit appartient au `GameLoop`. Un seul endroit doit débiter et créditer.

### 1.2 — Les chips de mise ne suivent jamais la progression

`HUD.#buildBetChips()` n'est appelé que dans le constructeur. `RunState.advanceStage()` change `betOptions` et `Economy.setBetOptions()` remplace le contenu de `BET_OPTIONS`, mais `HUD.restoreBetChips()` n'est **jamais** appelé (grep : zéro appelant).

Conséquence au palier 2 : les chips affichent encore 1/2/5/10/25, et un clic appelle `setBet(1)` qui est silencieusement rejeté par `if (BET_OPTIONS.includes(amount))`. Le joueur ne peut plus changer de mise.

### 1.3 — Reprise de sauvegarde : les options de mise ne sont pas réappliquées

`GameLoop.boot()` restaure `run` (donc `run.betOptions` du palier 3) mais n'appelle jamais `this.economy.setBetOptions(this.run.betOptions)`. Après un rechargement de page en palier 2 ou 3, `BET_OPTIONS` repart aux valeurs initiales : mises, `isGameOver()` (qui lit `Math.min(...BET_OPTIONS)`) et affichage sont désynchronisés du palier réel.

### 1.4 — Deux hooks de personnage ne sont branchés sur rien

`ShopUI` expose `setOfferModifier()` et `setOnBonusSold()`. Aucun des deux n'est appelé par `GameLoop`. Résultat :

- `avaritia.offerModifier` (boutique verrouillée par paliers, prix majorés) — **mort**. La mécanique centrale du personnage n'existe pas en jeu.
- `gula.onShopSell` (dévorer un bonus remet la mise au plancher) — **mort**. Le seul contre-jeu de Gula est injouable ; sa mise monte de +12 % par spin sans échappatoire.

Idem côté HUD : `showEscalatingBet()` et `restoreBetChips()` n'ont aucun appelant, donc la mise escaladée de Gula n'est jamais affichée.

### 1.5 — `character_8` vs `joueur` : identifiants incohérents

`CHARACTERS` (Characters.ts:260) déclare `id: 'character_8'`, alors que le registre de plugins n'expose que `'joueur'`. Sélectionner ce personnage lèverait `Personnage inconnu : character_8` ; il n'est aujourd'hui protégé que par `hidden: true`.

Symétriquement, `getCharacter('joueur')` retourne `undefined` : `GameLoop.ts:83` fait `getCharacter(...)!` et planterait à l'ouverture du profil, et `applyCharacterTheme()` sort silencieusement sans appliquer de thème.

### 1.6 — `remainingCharges` comparé à `null` au lieu de `undefined`

`ShopUI.ts:213` lit `b.remainingUses` — champ qui n'existe pas dans `ItemInstance` (c'est `remainingCharges`). `undefined !== null` étant vrai, chaque bonus affiche ` (undefined)`.

Même erreur dans `ProfileModal.ts:92` (`b.remainingCharges !== null`) : les bonus permanents affichent « undefined spins ».

### 1.7 — Panneau de profil : section « effet » toujours vide

`ProfileModal.#renderEffect()` lit `character.params`, mais `Character` stocke les paramètres dans `character.effect.params`. La table `PARAM_LABELS` (environ 25 entrées soigneusement écrites) n'est jamais utilisée. `CharacterState` expose justement un getter `params` — mais cette classe n'est importée nulle part.

### 1.8 — Les free spins ignorent les personnages et la persistance

`handleFreeSpins()` (GameLoop.ts:226) n'appelle ni `onAfterSpin`, ni `onWin`, ni `progression.updateHighscore()`, ni `save()`. Pendant les 8 spins gratuits : le ×2 d'Avaritia disparaît, l'entretien de Luxuria ne s'applique pas, l'escalade de Gula est gelée, et un crash ou un rechargement perd la séquence.

### 1.9 — Une sauvegarde corrompue bloque le jeu définitivement

`loadSave()` est protégé par try/catch, mais `run.restore(save.run)` ne l'est pas : si `save.run` est absent ou malformé, `boot()` lève une exception dans le constructeur, l'écran reste noir, et seul un vidage manuel de `localStorage` répare. Un try/catch autour du bloc de restauration avec repli sur `clearSave()` suffit.

### 1.10 — `isSpinning` n'est jamais relâché en cas d'exception

`handleSpin()` n'a pas de `try/finally`. Toute erreur d'un hook de personnage, du renderer ou du calcul laisse `isSpinning = true` et le bouton SPIN désactivé : la partie est bloquée jusqu'au rechargement. Enrober le corps dans `try { … } finally { this.isSpinning = false; … }`.

### 1.11 — Textes d'interface faux

- `index.html:120` : « 20 lignes · 5 × 4 » alors que la machine est un Megaways 6 rouleaux, 2 à 7 lignes.
- `CharacterSelect.ts` (`#selectCard`) : solde de départ « 1 000 ⛧ » et quota « 3 000 ⛧ » codés en dur, alors que le jeu démarre à 100 ⛧ avec un objectif de 500 ⛧.

---

## 2. Architecture

### 2.1 — Les paramètres des personnages sont dupliqués et ont déjà divergé

`Characters.ts` porte des `effect.params` détaillés ; chaque plugin redéclare une constante `PARAMS` locale. Les deux copies ne sont plus d'accord :

- **Avaritia** : `Characters.ts` définit des paliers par `progress` (0.25 / 0.5 / 0.75 du `goal`), le plugin par `minEarned` (500 / 2000 / 6000).
- **Luxuria** : `upkeepRamp` et `upkeepRampEvery` existent dans la donnée, sont absents du plugin.

Un plugin devrait recevoir ses paramètres à la construction (`createXPlugin(params)`), depuis `getCharacter(id).effect.params` — source unique. Cela rend aussi les plugins testables sans constante figée.

### 2.2 — La couche « machine » est un décor

`MachineConfig` définit `reelCount`, `minRows`, `maxRows`, `rtpTarget`. `SlotMachine.ts` les redéclare en constantes de module (`REEL_COUNT = 6`, `MIN_ROWS = 2`, `MAX_ROWS = 7`), `Economy` a son propre `TARGET_RTP = 0.92`, et `getMachine` est importé dans `GameLoop.ts:9` sans jamais être appelé.

Ajouter une deuxième machine demanderait aujourd'hui de réécrire `spin()`. La fonction devrait prendre la config en paramètre.

### 2.3 — `BET_OPTIONS` est un état global mutable

`Economy.setBetOptions()` fait `BET_OPTIONS.splice(0, length, ...options)` : un tableau exporté au niveau module est muté en place. Conséquences : deux instances d'`Economy` partagent leurs paliers, `Economy.restart()` ne les remet pas aux valeurs initiales (une nouvelle partie hérite donc des mises du palier 3), et l'ordre des fichiers de test devient significatif.

À remplacer par un champ d'instance `#betOptions`, `BET_OPTIONS` restant une valeur par défaut immuable.

### 2.4 — Le score max est stocké à deux endroits

`Economy` écrit sous la clé `casinotro_highscore`, `Progression` sous `casinotro_meta_v2`. Les deux sont mis à jour à chaque gain avec des valeurs qui peuvent diverger (`Progression` n'est pas alimenté pendant les free spins). Le HUD lit `economy.highscore`, donc `Progression.highscore` n'est en pratique jamais affiché. Choisir `Progression` comme unique propriétaire du méta.

### 2.5 — `GameLoop` accumule trop de responsabilités

321 lignes qui cumulent : orchestration du spin, animation, persistance, thème CSS, écouteurs DOM directs (`GameLoop.ts:81-85`), formatage des logs.

Les getters `ctx` et `uiContext` reconstruisent un objet à chaque accès, et `uiContext.updateHUD()` appelle `getModifiers()` — recalcul complet des modificateurs à chaque rafraîchissement d'affichage. Extraire au minimum la persistance (`SaveManager`) et le thème.

### 2.6 — Aléatoire non injectable

`Math.random()` est appelé directement dans `Random.ts`, `SlotMachine.ts:94` (`dropBonus`) et `ReelRenderer.#randomVisual()`. Impossible d'écrire un test déterministe sur une séquence de spins, sur le RTP réel, ou de reproduire un bug signalé.

Injecter une fonction `rng: () => number` (par défaut `Math.random`) dans `spin()` et `calculateWins()` ouvrirait la porte à une vraie validation statistique du RTP.

---

## 3. Code mort et dépendances

| Élément | Constat |
|---|---|
| `pixi.js` (dependency) | Aucun import dans `src/`. L'UI est 100 % DOM + SCSS. À retirer du `package.json`. |
| `src/ui/DebugPanel.js` | Jamais importé. Encore en JS, et importe `../game/Symbols.js` alors que le fichier est `.ts` : ne se résoudrait pas si on le rebranchait. |
| `src/game/CharacterState.ts` | Aucun importeur. |
| `getMachine` | Importé dans `GameLoop`, jamais appelé. |
| `UNLOCK_ORDER`, `STARTING_CHARACTER_ID` | Exportés, aucun consommateur : le déblocage progressif n'est pas implémenté. |
| `BonusSystem.resetWildColumns()` | No-op assumé, aucun appelant. |
| `ShopUI.rarityFor()`, `setLevelLabel()` | Aucun appelant. `rarityFor` teste un item `greed` absent du pool. |
| `Economy.debugSetEarned`, `saveHighscore`, `loadHighscore` | Aucun appelant hors debug. |
| `rowCounts` (retour de `spin`) | Retourné, jamais lu. |
| `ShopUI.getRerollCost` / `setRerollCost` | Existent pour la sauvegarde, mais `GameLoop.save()` ne persiste pas `#rerollCost` : le coût de reroll retombe à 5 ⛧ à chaque rechargement — reroll gratuit à volonté. |

---

## 4. Tests

66 tests, tous verts, mais la couverture est concentrée sur les fonctions pures les plus simples. Trous notables :

- **`GameLoop`** : zéro test. C'est pourtant là que vivent les bugs 1.1, 1.3, 1.8 et 1.10.
- **Comportement des plugins** : `characters.test.ts` ne vérifie que la résolution du registre (« un plugin existe pour cet id »), jamais l'effet. Un test « Avaritia double le gain » aurait attrapé 1.1.
- **`serialize` / `restore`** : testé pour `RunState`, absent pour `Economy` et `BonusSystem`.
- **`Economy.rtpNudge`** et la boucle de correction RTP : non testés, alors que c'est la règle d'équilibrage la plus subtile du jeu.
- **`processPostSpin`** : chaînes et sticky positions non couverts — c'est la logique la plus dense de `BonusSystem`.
- **`items/index.ts`** : `getItemsByLevel` non testé directement.
- `BonusSystem.test.ts` nomme encore son bloc `describe('BONUS_POOL')` alors que la constante s'appelle `ITEM_POOL` depuis le déplacement vers `items/index.ts`.

`vite.config.ts` déclare `test.environment: 'node'` — cohérent tant que rien du DOM n'est testé, mais il faudra `jsdom` pour couvrir `src/ui`.

---

## 5. Configuration et outillage

### 5.1 — `tsc --noEmit` échoue

```
src/main.ts(1,8): error TS2882: Cannot find module or type declarations for
side-effect import of './styles/main.scss'.
```

Corriger avec un `src/vite-env.d.ts` contenant `/// <reference types="vite/client" />`. En l'état, aucun typecheck ne peut tourner en CI.

### 5.2 — `strict: false`

Le projet est en TypeScript mais renonce à l'essentiel de ses garanties. Les bugs 1.5 (`getCharacter(...)!`), 1.6 (`!== null` sur un `undefined`) et 1.7 (`character.params` inexistant) sont exactement ceux que `strict` associé au typage réel de `Character` aurait signalés à la compilation.

Passer à `strict: true` progressivement (`strictNullChecks` d'abord) est le meilleur rapport effort/bugs évités de cet audit. Les nombreux `as any` de `ShopUI` et `ProfileModal` masquent le même problème.

### 5.3 — Divers

- Aucun linter ni formateur (ESLint, Prettier), aucune CI.
- `npm test` et `npm run build` ne sont enchaînés nulle part.
- Le SCSS déclenche `DEPRECATION WARNING [legacy-js-api]` à chaque build : passer `css.preprocessorOptions.scss.api = 'modern-compiler'` dans `vite.config.ts`.
- Extension `.ts` explicite dans les imports + `allowImportingTsExtensions` : fonctionne avec Vite, mais c'est inhabituel et ça bloquera une éventuelle compilation `tsc` directe.
- Polices chargées depuis Google Fonts sans repli local : hors-ligne, l'identité visuelle tombe.

### 5.4 — `CLAUDE.md` ne décrit plus le projet

Après le rework, le document affirme encore : rendu PixiJS, canvas 1200×750, `app.canvas`, « pas de CSS framework — styles inline », et `BONUS_POOL` dans `BonusSystem.ts`. En réalité : DOM pur, SCSS modulaire dans `src/styles/`, et `ITEM_POOL` dans `src/game/items/index.ts`. Une consigne fausse est plus coûteuse qu'une consigne absente.

---

## 6. Points solides

À conserver tels quels :

- La séparation `game` (pur) / `ui` (DOM) / `meta` est nette et réellement respectée.
- Aucune injection HTML : `textContent` et `createElement` partout, jamais `innerHTML` avec des données. Pas de surface XSS.
- Le système de plugins de personnages est bien conçu : hooks optionnels, distinction singleton / factory pour l'état, point d'entrée unique.
- Accès à `localStorage` systématiquement protégé par try/catch.
- `ReelRenderer` annule proprement ses timers (`#cancelAnimation`) et retire ses écouteurs dans les `cleanup()` des sélections — pas de fuite d'événements.
- `BonusSystem.restore` fait avancer le compteur statique pour éviter les collisions d'`instanceId` : détail juste, souvent oublié.

---

## 7. Ordre de traitement suggéré

**Bloquants — cassent le jeu**

1. Double crédit d'Avaritia (§1.1)
2. Chips de mise figées après un palier (§1.2, §1.3)
3. Brancher `setOfferModifier` et `setOnBonusSold` (§1.4) — sans ça, deux personnages jouables sur trois n'ont pas leur mécanique
4. `try/finally` sur `handleSpin` et restauration de sauvegarde défensive (§1.9, §1.10)

**Rapides et rentables**

5. `vite-env.d.ts` pour débloquer `tsc` (§5.1)
6. Corriger `remainingUses` → `remainingCharges` et les comparaisons à `null` (§1.6)
7. Câbler `ProfileModal` sur `effect.params` (§1.7)
8. Aligner `character_8` et `joueur` (§1.5)
9. Retirer `pixi.js`, `DebugPanel.js`, `CharacterState.ts` (§3)
10. Mettre `CLAUDE.md` à jour (§5.4)

**Fond**

11. `strict: true` par étapes (§5.2)
12. Paramètres de personnages injectés depuis `Characters.ts` (§2.1)
13. `BET_OPTIONS` en état d'instance (§2.3)
14. RNG injectable et tests de RTP (§2.6)
15. Free spins passés par le même chemin que les spins normaux (§1.8)


---

## 8. Découvert pendant les correctifs — non corrigé

### 8.1 — La chance fait baisser le retour (équilibrage)

Mesurable seulement depuis l'injection du RNG (§2.6). Sur 20 000 spins, graine 99 :

| luck | RTP | taux de gain |
|---|---|---|
| 0 | 0,470 | 10,24 % |
| 0,5 | 0,290 | 8,00 % |
| 2 | 0,164 | 6,42 % |

`WIN_MULTIPLIERS` ne dépend que du **nombre** de symboles alignés, jamais du symbole :
une ligne de 🐕 (poids 4) paie exactement comme une ligne de 🍋 (poids 30). Augmenter
la chance ne fait donc qu'aplatir la distribution des poids, ce qui produit moins de
chaînes d'un même symbole.

Conséquences :
- `luck_boost`, `lucky_streak` et le `rareMultiplier` de Luxuria pénalisent l'acheteur ;
- `Economy.rtpNudge` corrige à l'envers : RTP bas → il monte la chance → RTP plus bas ;
- le RTP de base (0,47) étant très loin de la cible 0,92, le nudge sature à +0,5 en
  permanence : le jeu tourne en continu autour de 0,29.

Pistes : faire dépendre le paiement du symbole (les rares paient plus), ou revoir le
sens de `LUCK_BIAS`. C'est une décision de game design, d'où l'absence de correctif.
Le comportement mesuré est verrouillé dans `SlotMachine.rtp.test.ts`.

### 8.2 — Personnages déclarés mais non implémentés

`invidia`, `acedia` et `superbia` ont un plugin réduit à un dialogue, mais gardent dans
`Characters.ts` des `effect.params` détaillés décrivant une mécanique inexistante. Le
panneau de profil les affiche au joueur comme si elles étaient actives.
