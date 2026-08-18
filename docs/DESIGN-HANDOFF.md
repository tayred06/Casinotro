# Casinotro — Design Handoff

Contexte pour une nouvelle conversation de refonte visuelle.

---

## Ce qu'est le jeu

Slot machine browser-based. Grille Megaways : 6 rouleaux × 2 à 7 rangées (variable par spin). Le joueur choisit un personnage, mise des âmes (⛧), tourne, accumule.

---

## Règles actuelles

### Monnaie
- **⛧ âmes** (plus de `$`)
- Type alias TypeScript : `Souls = number`

### Structure d'une run
3 paliers fixes, pas de niveaux infinis :

| Palier | Objectif | Condition |
|--------|----------|-----------|
| 1 | 500⛧ | Départ |
| 2 | 2 000⛧ | Atteindre 500⛧ |
| 3 | 10 000⛧ | Atteindre 2 000⛧ |

Passer un palier → boutique rafraîchie + **escalade des mises** (la mise max du palier courant devient la mise min du suivant).

### Mises de départ
`[1, 2, 5, 10, 25]⛧`

Après palier 1 → `[25, 50, 125, 250, 625]⛧`, etc.

### Conditions de défaite
- Solde insuffisant pour miser
- Condition spécifique au personnage (ex. Gula : balance < mise actuelle)

Pas de victoire automatique — le joueur continue après 10 000⛧.

### Boutique (shop)
- 3 offres au choix après chaque spin (items bonus permanents ou consommables)
- Items niveaux 1/2/3 selon progression
- Reroll payant
- Rafraîchissement automatique à chaque palier

### Items
Deux types :
- **Bonus permanent** — actif pour toute la run (ex. Colonne Dorée, Wild Column)
- **Consommable** — charges limitées (ex. Lucky Streak ×10 spins, Global Multiplier ×5 spins)

### Dialogue
Déclenché au **premier spin** de chaque run. Chaque personnage a 2 lignes (speaker + texte). Clic ou Entrée pour avancer.

---

## Les personnages

8 personnages, 7 péchés capitaux + Le Joueur. Tous ont un dialogue d'intro.

| ID | Nom | Péché | Mécanique |
|----|-----|-------|-----------|
| `luxuria` | L'Amante | Luxure | Symboles rares ×2.5, mais perd 5% du solde à chaque spin (entretien) |
| `gula` | Le Convive | Gourmandise | Mise augmente automatiquement chaque spin (+12% solde), repart au plancher si on vend un bonus |
| `avaritia` | ? | Avarice | Tous les gains ×2 |
| `ira` | ? | Colère | Stub (mécanique à venir) |
| `invidia` | ? | Envie | Stub (mécanique à venir) |
| `acedia` | ? | Paresse | Stub (mécanique à venir) |
| `superbia` | ? | Orgueil | Stub (mécanique à venir) |
| `joueur` | Vous | — | Aucune mécanique, représente le joueur |

---

## Architecture (pour info)

Rework complet TS en place :
- `GameLoop.ts` — orchestration, zéro logique personnage
- `CharacterPlugin` — interface de hooks optionnels (`onBeforeSpin`, `onAfterSpin`, `onWin`, `onLossCheck`, `onDialogueTrigger`, etc.)
- `RunState.ts` — état centralisé (palier, mises, spinCount, dialoguePlayed)
- `src/game/characters/` — un fichier par personnage
- `src/game/items/` — pool d'items (bonus + consommables)
- `src/meta/Progression.ts` — highscore + machines débloquées
- `src/game/machines/` — registry de machines (seule `megaways` pour l'instant)
- Save key : `casinotro_v2`

---

## Ce qui change par rapport à l'ancien design

| Élément | Avant | Après |
|---------|-------|-------|
| Monnaie | `$` | `⛧` (âmes) |
| Objectif | Niveaux infinis (goal × 2.6) | 3 paliers fixes (500 / 2 000 / 10 000) |
| Mises | Fixes toute la run | Escaladent à chaque palier |
| Perte | Balance = 0 | Balance trop faible OU condition personnage |
| Dialogues | Aucun | Intro au premier spin |
| Items | Bonus permanents seulement | Bonus + consommables (charges) |
| Personnages | 7 péchés | 7 péchés + Le Joueur |
| Machines | 1 fixe | Registry extensible (1 pour l'instant) |
| Save key | `casinotro_v1` | `casinotro_v2` |

---

## Thème visuel demandé

**"Arcade crasse"** — référence au projet Claude Design (UUID `1d519bb5-8e62-4584-afa2-d595b780160a`, version `arcade crasse`).

L'intention : casino cheap, enseigne qui clignote, moquette tachée, lumières qui grésillent. Ambiance mi-enfer mi-salle de jeux années 90.

Chaque personnage a une couleur d'ambiance (`--char-color` CSS variable) qui teinte le fond au moment de jouer.

---

## Stack technique

- **Vite 5** + **TypeScript 5** (`strict: false`)
- **Vitest** pour les tests (66 tests, tous verts)
- Grille Megaways rendue par `ReelRenderer.ts`
- CSS dans `index.html` (inline `<style>`)
- Variables CSS custom : `--char-color`, `--panel`, `--gold`, `--hot`
