# Casinotro — Design Document
*Date: 2026-08-13*

## Vue d'ensemble

Jeu de machine à sous roguelike jouable dans le navigateur. Inspiré de Balatro (couche stratégique de bonus) et de The Dog House Megaways 1000 (mécanique de slot). Le joueur commence avec 100$ et tente d'aller le plus haut possible en plaçant stratégiquement des bonus sur la machine.

**Plateforme :** Navigateur web  
**Stack :** PixiJS v8 (rendu), Vite.js (bundler), JS vanilla (logique)  
**Monnaie :** Une seule ($)  
**Condition de défaite :** Argent = 0$  
**Objectif :** Highscore (montant maximum atteint, sauvegardé en localStorage)

---

## Boucle de jeu

```
DÉPART : 100$

PHASE BOUTIQUE (accessible à tout moment entre les spins)
  └─ 3 bonus proposés aléatoirement
  └─ Reroll boutique : 5$
  └─ Vendre un bonus : 50% du prix d'achat

PHASE SPIN
  └─ Choisir la mise (1$, 2$, 5$, 10$, 25$)
  └─ Lancer les 6 rouleaux
  └─ Calcul des gains (combinaisons + bonus actifs)
  └─ Drop possible de bonus gratuit (~15% si 4+ symboles alignés)

GAME OVER si argent = 0$
```

---

## Machine à Sous

**Configuration :** 6 rouleaux, 4-6 rangées par rouleau (nombre variable par spin, style Megaways)

### Symboles

| Symbole | Rareté |
|---|---|
| 🍋 Citron | Très commun |
| 🍇 Raisin | Commun |
| 🔔 Cloche | Peu commun |
| 💎 Diamant | Rare |
| ⭐ Étoile | Très rare |
| 🐕 Chien | Jackpot |
| 🃏 Wild | Remplace tout |

*Note : les assets visuels (images) seront définis plus tard. Les emojis servent de placeholder.*

### Règles de gain

Une combinaison est valide si le même symbole apparaît sur **3 rouleaux consécutifs ou plus en partant de la gauche**.

| Symboles alignés | Multiplicateur |
|---|---|
| 3 | x0.5 mise |
| 4 | x2 mise |
| 5 | x5 mise |
| 6 | x20 mise |

**Scatter :** si 3+ Scatters apparaissent n'importe où, déclenchement de **free spins** (nombre à définir lors de l'implémentation, ex: 10 free spins).

**Wild :** remplace n'importe quel symbole pour compléter une combinaison.

---

## Système de Bonus

Le joueur peut avoir **maximum 5 bonus actifs simultanément**. Pour en acheter un nouveau quand le maximum est atteint, il faut en vendre un.

### Bonus de Grille (placés sur lignes/colonnes)

| Bonus | Effet |
|---|---|
| Colonne Dorée | Tous les symboles d'un rouleau choisi valent x2 (permanent) |
| Ligne Explosive | Une rangée choisie multiplie les gains par x3 (permanent) |
| Colonne Wild | Un rouleau entier devient Wild pour le prochain spin uniquement, puis se réinitialise |

### Bonus de Symbole

| Bonus | Effet |
|---|---|
| Symbole Béni | Un symbole choisi rapporte x2 partout |
| Chaîne | Si un symbole génère un gain sur 3 spins consécutifs, +50% permanent sur ce symbole |
| Symbole Collant | Après un gain, le symbole reste en place au prochain spin |

### Bonus Globaux

| Bonus | Effet |
|---|---|
| Filet de Sécurité | Si un spin rapporte 0$, on récupère 50% de la mise |
| Jackpot Amplifié | Le multiplicateur x6 passe de x20 à x50 |
| Reroll Gratuit | 1 reroll de boutique gratuit disponible par session |

### Drops In-Machine

Probabilité ~15% de dropper un bonus aléatoire quand 4+ symboles identiques s'alignent. Le bonus droppé est tiré aléatoirement dans la pool du niveau de boutique actuel.

---

## Économie

### Mises
Valeurs disponibles : **1$, 2$, 5$, 10$, 25$**

### Prix des Bonus

| Niveau Boutique | Déclencheur | Fourchette de prix |
|---|---|---|
| Niveau 1 | 0$ – 500$ gagnés | 10$ – 30$ |
| Niveau 2 | 500$ – 2000$ gagnés | 30$ – 60$ |
| Niveau 3 | 2000$+ gagnés | 60$ – 100$ |

*"Gagnés" = montant total cumulé depuis le début de la run, pas le solde actuel.*

### Boutique
- 3 bonus proposés aléatoirement, tirés dans la pool du niveau actuel
- Reroll : 5$ pour voir 3 nouveaux bonus
- Vente d'un bonus actif : 50% du prix d'achat original

### Highscore
Sauvegardé en `localStorage` sous la clé `casinotro_highscore`. Affiché dans le HUD en permanence.

---

## Architecture Technique

```
casinotro/
├── index.html
├── src/
│   ├── main.js              — initialise PixiJS, monte les scènes
│   ├── game/
│   │   ├── SlotMachine.js   — logique des rouleaux, calcul des gains
│   │   ├── BonusSystem.js   — gestion des bonus actifs et leurs effets
│   │   ├── Economy.js       — argent, mises, boutique, highscore
│   │   └── Symbols.js       — définition symboles, multiplicateurs, rareté
│   ├── ui/
│   │   ├── ReelRenderer.js  — rendu PixiJS des rouleaux et animations
│   │   ├── ShopUI.js        — interface boutique (achat, vente, reroll)
│   │   └── HUD.js           — affichage argent, mise sélectionnée, highscore
│   └── utils/
│       └── Random.js        — fonctions RNG réutilisables
├── assets/                  — images des symboles (à ajouter plus tard)
└── package.json
```

**Principe clé :** la logique du jeu (`game/`) est 100% indépendante du rendu (`ui/`). Les modules `game/` ne connaissent pas PixiJS — ils exposent des données que les modules `ui/` consomment pour afficher.

---

## Ce qui est hors scope (pour l'instant)

- Site web autour du jeu
- Assets visuels finaux (images, animations)
- Multijoueur ou leaderboard en ligne
- Sons / musique
