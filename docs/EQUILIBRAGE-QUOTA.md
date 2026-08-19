# Refonte du quota — découpler progression et solde

Statut : **implémenté** sur la branche `equilibrage-quota` (§1 à §3 et §6.1/6.3/6.4).
Cible : run de ~20-30 min au lieu de 5-10 min. Mesure obtenue, mise minimale sans achats
boutique, 200 runs simulés (`Balance.sim.test.ts`) :

```
spins médian 389 · min 152 · max 649 · victoires 23.5% · palier moyen 2.44
```

≈ 26 min à 4 s par spin, contre ~5 min avant. Les valeurs ci-dessous sont celles du code.

## 1. Pourquoi le run est court aujourd'hui

Le quota se compare au **solde** (`GameLoop.checkStageProgress` → `economy.balance >= run.currentGoal`).
Solde de départ 100⛧, quota palier 1 = 500⛧, RTP machine = 0.92.

Conséquence mathématique : atteindre 5× son solde avec un avantage maison de 8 % est un
problème de ruine du joueur. La probabilité de succès est **maximale quand la mise est
maximale** (bold play) et s'effondre quand on mise petit — grinder à 1⛧ est une mort lente
garantie. Le jeu récompense donc l'all-in : 4 spins à 25⛧ et le run est décidé, dans un sens
ou dans l'autre. Ce n'est pas de la malchance, c'est la stratégie optimale.

Deux amplificateurs :

- `RunState.#scaleBetOptions()` prend `newMin = dernier palier` → ×25 par palier
  ([RunState.ts:41](../src/game/RunState.ts#L41)). Palier 2 démarre à 25⛧ de mise mini pour
  un solde de ~500⛧ : 20 spins de marge. Chaque palier est plus court que le précédent.
- Les bonus se multiplient entre eux (`column ×2` × `symbol ×2` × `jackpot ×2.5` ×
  `global ×3` = ×30). Le test RTP les exclut : la vraie partie n'est pas mesurée.

## 2. Changement 1 — le quota se remplit avec les gains cumulés

**Règle** : le quota d'un palier se compare aux **gains cumulés depuis le début du palier**,
pas au solde.

```
progression_palier = somme des gains encaissés depuis l'entrée dans le palier
quota atteint      ⟺ progression_palier >= currentGoal
```

Le solde ne sert plus de jauge de progression. Il devient une **barre de vie** : il descend
de (mise − gain) à chaque spin, et le run s'arrête quand il ne couvre plus la mise mini.

### Ce que ça change dans la dynamique

| | Aujourd'hui | Après |
|---|---|---|
| Condition de victoire | solde net ×5 | volume de gains encaissés |
| Atteignable en grindant ? | Non (RTP < 1) | Oui — c'est une question de survie |
| Stratégie optimale | miser le max, 4 spins | gérer sa bankroll sur la durée |
| Durée | décidée par 1 ou 2 spins | ~110-180 spins par palier |
| Source de tension | « est-ce que je touche le gros lot » | « est-ce que je tiens jusqu'au quota » |

Le quota devient **garanti atteignable** : à RTP 0.92, 1 spin rapporte 0.92× la mise en
moyenne, donc un quota de 100× la mise se remplit en ~110 spins. La seule question est de
savoir si la bankroll tient les ~9 % de fuite sur ces 110 spins. Le run se joue sur la
gestion, plus sur un coup de dé.

Effet de bord voulu : miser gros **avance toujours plus vite** (les gains comptent en
valeur absolue) mais vide la bankroll plus vite. Le risque/récompense de la mise est
conservé, il n'est plus dégénéré vers l'all-in.

### Implémentation

- `Economy` : ajouter `#stageEarned` incrémenté dans `addWin()`, getter `stageEarned`,
  méthode `resetStageEarned()`. Sérialiser/restaurer le champ.
  Ne pas réutiliser `totalEarned` : il pilote déjà `getShopLevel()`.
- `GameLoop.checkStageProgress()` : `if (this.economy.stageEarned < this.run.currentGoal) return`,
  puis `this.economy.resetStageEarned()` dans les trois branches (palier, infini, victoire).
- `HUD.ts:102` et `ProfileModal.ts:37` : la barre de progression passe de
  `balance / goal` à `stageEarned / goal`. Afficher le solde séparément comme jauge de vie.
- Fin de run : `gameOver` reste sur `economy.isGameOver()` (solde < mise mini) — inchangé,
  mais c'est désormais la **seule** façon de perdre, ce qui est le comportement voulu.

## 3. Changement 2 — quotas et mises indexés l'un sur l'autre

Sans ça, le changement 1 casse à l'échelle : palier 3 exige 10000⛧ de gains avec une mise
mini de 625⛧, soit 16 spins — on retombe sur un palier expédié.

**Règle** : le quota d'un palier s'exprime en **multiples de la mise mini du palier**.

```
quota_n = K_n × miseMini_n
```

Escalade de mise adoucie (×3 au lieu de ×25) et paliers de mise resserrés :

```
betOptions(palier n) = [m, 2m, 3m, 5m, 10m]   avec m = miseMini
miseMini : 1 → 3 → 8
```

### Calibration proposée

| Palier | mise mini | K | quota (gains cumulés) | spins attendus @ mise mini | fuite bankroll attendue |
|---|---|---|---|---|---|
| 1 | 1⛧ | 140 | 140⛧ | ~160 | ~13⛧ |
| 2 | 3⛧ | 180 | 540⛧ | ~205 | ~50⛧ |
| 3 | 8⛧ | 220 | 1760⛧ | ~250 | ~160⛧ |

Total ≈ 615 spins pour un run gagné ; médiane mesurée 342 spins, les runs perdus tirant
la distribution vers le bas. K a été calibré par balayage sur `Balance.sim.test.ts`
([100,130,160] → 300 spins / 29,5 % de victoires ; [140,180,220] → 342 / 21,5 %).
`spins attendus = K / RTP`. `fuite = (1 − RTP) × spins × mise`.

Mode infini : `currentGoal = K_3 × miseMini_courante × ENDLESS_GOAL_FACTOR^endlessLevel`,
la formule reste homogène.

### Prime de quota (nécessaire)

La fuite de bankroll croît de 9 → 34 → 112⛧ alors que le solde de départ est 100⛧. Sans
apport, le palier 3 est statistiquement imperdable-puis-impossible. Chaque quota franchi
verse une **prime** :

```
prime_n = 0.6 × quota_n   →   60⛧ / 234⛧ / (fin de run)
```

La prime finance le palier suivant **et** la boutique. C'est là que se place le vrai choix
du joueur : dépenser la prime en bonus (qui remontent le RTP effectif) ou la garder comme
coussin de survie. La mort vient alors d'un sur-investissement en boutique ou d'une série
noire, pas d'un all-in raté.

### Implémentation

- `RunState` : remplacer `STAGE_GOALS` par `STAGE_QUOTA_K = [100, 130, 160]` et
  `STAGE_MIN_BETS = [1, 3, 8]`. `currentGoal` devient
  `STAGE_QUOTA_K[stage-1] * betOptions[0]`.
- `#scaleBetOptions()` : `m = STAGE_MIN_BETS[stage]` (ou `m × 3` en mode infini),
  table `[m, 2m, 3m, 5m, 10m]`.
- `Economy.addMoney(prime)` appelé dans `checkStageProgress()` avant `advanceStage()`.
- `serialize/restore` : `stageGoals` disparaît du format — prévoir un fallback dans
  `restore()` pour les sauvegardes `casinotro_v3` existantes (recalculer depuis `stage`).

## 4. Tests à mettre à jour

- `Economy.test.ts` : `stageEarned` s'incrémente sur `addWin`, se remet à zéro sur reset,
  survit au round-trip `serialize`/`restore`.
- `RunState.test.ts` : `currentGoal` suit la mise mini ; escalade ×3 ; mode infini homogène.
- `GameLoop.test.ts` : le palier avance sur gains cumulés, pas sur solde (cas explicite :
  solde bas + quota atteint → avance quand même) ; prime versée une seule fois.
- `HUD.test.ts` : la barre lit `stageEarned`.
- Nouveau `Balance.sim.test.ts` (Monte-Carlo, `seedRng`) : sur 200 runs sans achats
  boutique, longueur médiane de run ∈ [300, 550] spins et taux de victoire ∈ [15 %, 40 %].
  C'est le garde-fou qui empêche de re-dériver.

## 5. Ordre de mise en œuvre

1. `Economy.stageEarned` + bascule de `checkStageProgress` (changement 1 seul, jouable tel quel).
2. Barres HUD / ProfileModal.
3. `RunState` quotas indexés + escalade ×3 + prime.
4. `Balance.sim.test.ts`, puis calibrer `K` et la prime sur ses mesures.

Non couvert ici (voir discussion) : bonus multiplicatifs à rendre additifs et capés,
aplatissement de la paytable, budget de spins par palier.

## 6. Interaction avec les bonus — le point qui décide de tout

Le changement 1 modifie la **valeur** des bonus, pas seulement l'équilibrage. Sous l'ancien
système, un bonus servait à fabriquer un pic (seul moyen de faire ×5 son solde). Sous le
nouveau, un bonus sert d'abord à **rester en vie assez longtemps pour remplir le quota**.
Trois conséquences concrètes.

### 6.1 Un item qui monte le RTP au-dessus de 1.0 casse le nouveau système

Mesure faite sur 50 000 spins `megaways` (graine 42, free spins et nudge exclus) :

```
taux de spins morts : 0.461
RTP nu              : 0.878
RTP + safety_net    : 1.109
```

`safety_net` (niveau 1, **15⛧**, permanent, [items/index.ts:10](../src/game/items/index.ts#L10))
rembourse 50 % de la mise sur chaque spin mort, et 46 % des spins sont morts. À lui seul il
fait passer le joueur en avantage.

Aujourd'hui c'est invisible : le run se termine en 5 spins, l'espérance n'a pas le temps de
s'exprimer. Avec des runs de 400 spins, une bankroll à RTP > 1 **ne meurt plus jamais** : le
run n'est plus gagnable ou perdable, il est juste long. On aurait remplacé « trop court » par
« sans enjeu ».

**Règle à poser** : aucune combinaison d'items ne doit amener le RTP effectif au-dessus de
~1.02. Un run reste une descente lente ; les items règlent la *pente*, pas le *signe*.

Correctifs pour `safety_net` (au choix) : remboursement à 15 % au lieu de 50 % (≈ +0.07 RTP),
ou seulement à partir du 3ᵉ spin mort consécutif (anti-tilt, effet ciblé sur les séries
noires), ou passage en consommable à charges. Même audit à faire sur `sticky`, `chain` et
`regularity`, qui montent le RTP sans plafond.

### 6.2 Séparer explicitement deux familles d'items

Sous le nouveau système, les deux monnaies du run sont **la survie** (bankroll) et **la
vitesse** (remplissage du quota). Un item devrait acheter l'une ou l'autre, pas les deux :

| Famille | Achète | Items | Contrainte de design |
|---|---|---|---|
| **Edge** — survie | +RTP, −variance | `safety_net`, `regularity`, `chain`, `sticky` | +0.03 RTP max chacun, plafond global à 1.02 |
| **Burst** — vitesse | +variance, gains cumulés | `jackpot_boost`, `global_multiplier`, `greed_eye`, `lucky_streak` | à charges ou durée limitée, RTP quasi neutre |

C'est le nouveau système qui rend cette distinction *lisible* : aujourd'hui tous les items
font la même chose (fabriquer un pic) parce que c'est la seule chose qui compte.

Bon effet de bord : `global_multiplier` (×3 sur 5 spins) devient un vrai outil tactique — on
le déclenche pour finir un quota, pas pour sauver un run. Les gains comptent en cumulé, donc
un burst avance la barre même s'il ne change pas le solde net.

### 6.3 Le multiplicatif ne tient pas à 5+ slots

`getModifiers()` multiplie les effets entre eux : `column ×2` × `symbol ×2` ×
`jackpot ×2.5` × `global ×3` = **×30** sur une combinaison. Et `SLOTS_PER_QUOTA = 2` fait
passer l'inventaire de 5 à 7 puis 9 slots. Passer en additif avec plafond :

```
multiplicateur_total = 1 + Σ(bonus − 1)      plafonné à ×6
```

`column ×2 + symbol ×2 + jackpot ×2.5 + global ×3` → ×6.5 plafonné à ×6, au lieu de ×30.

### 6.4 Deux réglages qui cassent silencieusement avec les nouveaux quotas

- **`Economy.getShopLevel()`** est indexé sur `totalEarned` (seuils 500 / 2000). Avec les
  quotas recalibrés, le cumul de gains sur tout le run vaut 100 + 390 + 1280 = 1770⛧ :
  le niveau 2 arriverait en fin de palier 2 et **le niveau 3 jamais**. À réindexer sur
  `run.stage` — c'est déjà la sémantique voulue.
- **Prix des items** (10 → 100⛧), figés, calibrés pour des mises de 25⛧. Au palier 1
  (mise 1⛧, prime 60⛧) un item à 80⛧ est hors de portée ; au palier 3 (mise 8⛧, prime
  234⛧) tout est bradé. Exprimer les prix en **multiples de la mise mini du palier**, comme
  les quotas : `prix_effectif = price × miseMini`. La boutique reste le drain principal de
  bankroll à toutes les échelles.

### 6.5 Boucle de difficulté qui en résulte

```
quota franchi → mise mini ×3 (fuite ×3)  ⟷  +2 slots + prime (edge ↑)
```

C'est le vrai bouton de difficulté du jeu : tant que le gain d'edge apporté par les
nouveaux slots reste **sous** l'augmentation de fuite due à la mise, la pression monte
palier après palier. À vérifier dans `Balance.sim.test.ts` (§4) avec achats boutique
simulés, pas seulement à vide.


## 7. Ce qui a été implémenté

| Fichier | Changement |
|---|---|
| `Economy.ts` | `stageEarned` (jauge de quota) + `resetStageEarned()` ; `getShopLevel(stage?)` |
| `RunState.ts` | `STAGE_QUOTA_K = [140,180,220]`, `STAGE_MIN_BETS = [1,3,8]`, `betOptionsFor()` = `[m,2m,3m,5m,10m]`, `currentGoal = K × miseMini`, `quotaReward` (60 %), `ENDLESS_BET_FACTOR = 3`, `ENDLESS_GOAL_FACTOR = 1.5`, restore tolérant aux vieilles sauvegardes |
| `GameLoop.ts` | quota testé sur `stageEarned`, prime versée, prix et reroll réindexés sur la mise mini, boutique indexée sur le palier |
| `SlotMachine.ts` | `combineMultipliers()` additif plafonné à `MULT_CAP = 6` ; `SAFETY_NET_REFUND = 0.15` (RTP + filet : 1.109 → ~0.95) |
| `BonusSystem.ts` | `priceScale` appliqué aux offres de boutique |
| `HUD.ts` / `ProfileModal.ts` | barre de progression sur les gains du palier, plus sur le solde |
| `Balance.sim.test.ts` | garde-fou : médiane ∈ [250, 800] spins, victoires ∈ [5 %, 60 %] |

Reste à faire : §6.2 (séparation explicite edge / burst, audit de `sticky`, `chain`,
`regularity`), simulation avec achats boutique, aplatissement de la paytable.


## 8. Vitalité — le solde est une barre de vie

Le solde n'est plus une cagnotte, c'est une **barre de HP** : chaque spin entame (la mise),
chaque gain soigne, un gros gain soigne à fond. Le surplus au-dessus du plafond ne
disparaît pas — il déborde en **crédit boutique**, non misable.

| Palier | départ (plancher) | plafond | marge en mises minimales |
|---|---|---|---|
| 1 | 100⛧ | 200⛧ | 200 |
| 2 | 200⛧ | 400⛧ | 133 |
| 3 | 400⛧ | 800⛧ | 100 |

Le plancher remplace la prime de quota : « chaque palier démarre à X » se lit, un
versement de 60 % du quota ne se lit pas. Le plafond empêche un joueur chanceux de se
constituer un matelas qui rendrait le palier 3 formel, et la marge se resserre volontairement
palier après palier (200 → 133 → 100 mises).

Mesuré : plancher + plafond font passer la médiane de 342 à 389 spins et le taux de
victoire de 21,5 % à 23,5 %. L'essentiel du gain vient du **plancher** ; le plafond ne mord
que dans ~25 % des runs et sert surtout à borner la dérive haute.

### Conséquences

- **La boutique se paie en HP.** Une seule monnaie misable : acheter un bonus, c'est
  sacrifier de la survie immédiate contre du RTP durable. Le crédit d'overheal amortit ce
  choix — `Economy.spend()` consomme toujours le crédit avant la vitalité.
- **Le record passe sur `totalEarned`.** Avec un solde plafonné à 800⛧, un highscore basé
  sur le solde s'écrasait sur 800 pour tout le monde. Les gains cumulés sont la seule mesure
  de performance non bornée.
- **Mode infini** : plancher et plafond sont multipliés par `ENDLESS_BET_FACTOR ^ niveau`,
  comme les mises.

### UI

Barre de vie dans la barre de contrôle, à la place de « Cagnotte » :

- remplissage sur le plafond du palier, `⛧142 / ⛧200` sous la barre ;
- **repère pointillé au point de départ** (à 50 % de la barre au palier 1) : il montre d'un
  coup d'œil qu'on démarre à mi-jauge et qu'il y a autant à gagner au-dessus ;
- vert → orange sous 50 % → rouge pulsant sous 20 % ;
- pastille `+⛧73 crédit` qui apparaît et tressaute quand l'overheal alimente la boutique.

La jauge de quota reste séparée, dans la carte « Manche — quota » : progression et survie
sont deux barres distinctes, jamais la même.

## 9. Balayage de calibration — durée vs jouabilité

Mesures `Balance.sim.test.ts`, 200 runs, graine 7, mise minimale, sans achats boutique.

**Le quota seul est un mauvais levier de durée** (HP laissés à 100/200) :

| K | spins médians | victoires |
|---|---|---|
| `[140,180,220]` *(actuel)* | 389 | 23,5 % |
| `[200,260,320]` | 433 | 13,0 % |
| `[300,390,480]` | 481 | 4,0 % |

La fuite de bankroll est linéaire dans le nombre de spins alors que le plafond de HP est
fixe : allonger le quota ne fait qu'ajouter des occasions de mourir avant la ligne. On
achète des minutes en rendant le run ingagnable.

**La durée se pilote par les HP, le quota suit** :

| K | HP plancher / plafond | spins médians | victoires |
|---|---|---|---|
| `[180,235,290]` | `[125,250,500]` / `[250,500,1000]` | 558 | 29,5 % |
| `[200,260,320]` | `[125,250,500]` / `[250,500,1000]` | 573 | 19,0 % |
| `[220,290,360]` | `[150,300,600]` / `[300,600,1200]` | 733 | 28,5 % |
| `[300,390,480]` | `[150,300,600]` / `[300,600,1200]` | 763 | 20,5 % |
| `[300,390,480]` | `[200,400,800]` / `[400,800,1600]` | 1027 | 29,0 % |

Candidats retenus si la durée actuelle (389 spins ≈ 26 min) se révèle trop courte en jeu :

- **~37 min** — `K=[180,235,290]`, `HP=[125,250,500]/[250,500,1000]` : 558 spins, 29,5 %
  de victoires. Allonge *et* rend le run plus juste que l'actuel.
- **~49 min** — `K=[220,290,360]`, `HP=[150,300,600]/[300,600,1200]` : 733 spins, 28,5 %.

Changer la config = trois constantes dans `RunState.ts` plus les bornes du garde-fou dans
`Balance.sim.test.ts`.
