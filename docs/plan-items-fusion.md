# Plan — Refonte items : rareté, fusion, garde-fous

Statut : **implémenté** le 2026-08-23 sur la branche `feat/items-fusion`.
Les écarts au plan sont listés en section 10 — ils viennent tous d'une mesure, pas d'un choix
de confort.

---

## 1. Règles du système (référence)

### Rareté
Trois paliers : `commun` → `rare` → `epique`.
Courbe : **puissance ×1,4 par palier, coût ×2 par palier**.
Volontairement sous-linéaire en brut — la valeur réelle est dans les slots récupérés
plus le twist qualitatif du palier.

### Fusion
- Automatique **au moment de l'achat**, jamais manuelle, aucune UI dédiée.
- Deux items fusionnent si : **même `id`** ET **même rareté**.
- Items **sans cible** → fusionnent toujours.
- Items **avec cible** (`needsTarget`) → fusionnent seulement si **même cible**.
  Cibles différentes = ils coexistent.
- `commun + rare` du même item = cohabitation autorisée (raretés différentes).
- Consommables : la fusion somme **les charges uniquement** (× 1,5), jamais l'effet.
- Un achat qui fusionne est **légal même à inventaire plein** (il libère un slot).

### Slots
| contexte | slots |
|---|---|
| stage 1 | 3 |
| stage 2 | 4 |
| stage 3 | 5 |
| mode infini | 6 |

### Boutique
Rares et épiques sont **vendables**, selon le niveau de boutique.
Tirage en **deux temps** : d'abord la rareté, ensuite l'item parmi ceux débloqués.
Jamais un pool aplati (sinon les proportions dérivent).

| boutique | commun | rare | épique |
|---|---|---|---|
| stage 1 | 100 % | — | — |
| stage 2 | 75 % | 25 % | — |
| stage 3 | 55 % | 35 % | 10 % |
| infini | 45 % | 35 % | 20 % |

**Prix** : rare ≥ 2,2 × commun, épique ≥ 4,5 × commun.
En dessous de 2,2×, acheter le rare devient meilleur que fusionner et la fusion meurt.
`priceScale` du palier s'applique par-dessus, inchangé.

| item | commun | rare | épique |
|---|---|---|---|
| Colonne Dorée | 20 | 44 | 90 |
| Métronome | 30 | 66 | 135 |
| Colonne Wild | 50 | 110 | 225 |
| Jackpot Amplifié | 80 | 176 | 360 |
| *(les autres suivent le même ratio)* | | | |

### Écho boutique (anti-slot-gelé) — obligatoire, pas optionnel
Avec 13 items × 3 raretés = 39 candidats pour 3 offres, revoir un doublon devient
improbable et un slot se gèle sur un item non fusionnable. Avec 3 slots au stage 1,
c'est 33 % du build mort.

> Une offre sur trois est tirée normalement. Les deux autres ont ~40 % de chance
> d'être biaisées vers un item déjà possédé **en un seul exemplaire, même rareté**.

Invisible pour le joueur, même philosophie que `rtpNudge`.

---

## 2. Garde-fous (à coder AVANT les twists)

### 2.1 Invariant wild — bloquant
```
nombre de colonnes wild consécutives depuis le rouleau 1 < machine.minMatch
```
Sur `lines` (rigide, minMatch 3), 2 colonnes wild sur les rouleaux 1-2 ⇒ les 20 lignes
gagnent à **chaque** spin, quel que soit le rouleau 3.
Sur `ways`, 3 colonnes wild ⇒ ways ×~91 en moyenne (jusqu'à ×343) sur **tous** les symboles.

Conséquence : **1 seule Colonne Wild par run** tant que minMatch = 3.
La Colonne Wild redevient donc **unique stricte** ; sa seule progression est la fusion.

### 2.2 Clamp d'occurrences — dormant
Sur l'évaluateur `ways`, un rouleau transformé en wild par un item compte pour
**1 occurrence** dans le produit, pas `h` (2–7 rangées).
Sans effet aujourd'hui (megaways désactivé), à écrire quand même : le piège est
désamorcé d'avance au retour du megaways. Coût : une ligne + un test.

### 2.3 Cap multiplicatif global — ×12
Appliqué **en un seul endroit**, fin de `calculateWins`, sur le produit de toutes les
sources multiplicatives d'une même combinaison : colonnes dorées, symbole béni,
jackpot, ligne magique, chaînes.
À rendre **visible** dans l'UI ("gain plafonné") — un plafond silencieux est perçu
comme un bug, un plafond affiché est un moment de fierté.

### 2.4 Cap de la Chaîne
`+50 % permanent` est une croissance non bornée : en mode infini elle compose sans fin.
Plafond dur : **+200 % (commun) / +250 % (rare) / +300 % (épique)**.

### 2.5 Consommables
La fusion ne touche **que les charges**. Le multiplicateur est figé.
Un ×9 pendant 5 spins vaudrait plus que tout le reste du build réuni.

---

## 3. Megaways mis de côté

- Toutes les machines passent sur le principe de celle du Boxer : `evaluator: 'lines'`.
- `megaways.ts` **n'est pas supprimé**. Ajout d'un flag `playable: false` sur `MachineConfig` :
  la machine sort du pool jouable et du déblocage `Progression`, mais reste validée par
  `machines.test.ts` (sinon elle pourrit en silence).
- Décider si `SlotMachine.rtp.test.ts` continue de la mesurer (300k spins × 3 seeds :
  la sortir divise le temps de suite par deux).

### Différenciation des machines sans second évaluateur
Leviers restants, plus riches qu'il n'y paraît :
dessin des lignes (plates vs zigzag) · nombre de lignes (10 payantes vs 40 grignotantes,
levier de variance pur) · géométrie (5×3 / 6×5 / 7×4) · `minMatch` 3 vs 4 (levier de
variance très fort, sous-exploité) · forme du paytable (plate = régulier, pentue = loterie)
· `scatterMin`.

Le péché du personnage peut se lire dans ces réglages : avarice sur courbe pentue,
acédie sur du plat et fréquent.
`machines.test.ts` devient le garde-fou principal puisque tout partage un moteur unique.

---

## 4. Twists qualitatifs

**Principe : un twist n'est jamais "encore un multiplicateur".** Trois familles :
- **mémoire** — accumule entre les spins (pity, série)
- **portée** — touche plus de cases, pas plus fort
- **synergie** — se branche sur un système existant (`pickAnchor`, scatter, free spins, chaînes)

Aucun twist ci-dessous ne demande un nouveau hook dans le pipeline.

| item | commun | rare | épique | famille |
|---|---|---|---|---|
| Colonne Dorée | ×2 | ×2,8 | ×4 + rouleau adjacent au choix ×1,5 | portée |
| Filet de Sécurité | 50 % | 65 % | 80 %, remboursement compte comme mise pour les chaînes | synergie |
| Reroll Gratuit | 1 | 3 | 7, chaque reroll garantit ≥ 1 offre rare | synergie |
| Symbole Béni | ×2 | ×2,8 | ×4, prioritaire comme ancre de cohésion | synergie |
| Porte-Bonheur | +10/+10 | +16/+16 | +25/+25, +10 cohésion cumulé par spin perdant, reset au gain | mémoire |
| Métronome | +20 coh | +32 | +50, ancre fixée 3 spins au lieu d'être retirée chaque spin | synergie |
| Colonne Wild | 1 rouleau | + ×1,5 sur les combos traversantes | + ×2,5 | — |
| Chaîne | 3 spins → +50 % (cap 200) | 3 spins → +80 % (cap 250) | 2 spins → +100 % (cap 300) | mémoire |
| Symbole Collant | 35 %, 1 spin | 50 %, 1 spin | 60 %, 2 spins, non re-collable au 2e | mémoire |
| Œil du Cupide | +25 rar | +40 | +60, biais appliqué aussi au scatter | synergie |
| Coup de Chance | +30 rar, 10 spins | 20 spins | 40 spins, décompte en pause en free spins | — |
| Jackpot Amplifié | ×2,5 | ×3,5 | ×5, une combo pleine déclenche 1 free spin | synergie |
| Ligne Magique | ×3, 5 spins | 10 spins | 20 spins, décompte en pause en free spins | — |

### Notes de conception
- **Colonne Wild épique** : l'idée "20 % de chance que la colonne adjacente devienne wild"
  est **écartée** — elle franchit l'invariant 2.1 une fois sur cinq. Un ×2,5 plat est
  ennuyeux mais sûr. Alternative si on veut un vrai twist : garantir un scatter tous les
  20 spins (ne touche pas aux wilds).
- **Métronome épique** : ancre fixée 3 spins ne change presque pas l'espérance mais
  transforme la sensation — la machine "insiste". Le meilleur rapport effet/coût du lot.
- **Symbole Béni épique** : ×4 **et** favorisé comme ancre = deux effets qui se
  multiplient dans les faits. Candidat n° 1 pour taper le cap ×12.
- **Colonne Dorée épique** : seul twist "portée". Une combinaison traversant la colonne
  dorée et son adjacente prend ×4 × ×1,5 = ×6 avant tout le reste. C'est exactement le
  scénario pour lequel le cap existe.

---

## 5. Structure de données

Une entrée de pool par item (pas 39), la rareté portée par l'instance.

```ts
export type ItemRarity = 'commun' | 'rare' | 'epique'

export interface ItemTier {
  price: Souls
  description: string
  /** Valeurs numériques de l'effet à ce palier. Lues par getModifiers(). */
  params: Record<string, number>
  charges?: number
}

export interface ItemDef {
  id: string
  name: string
  level: 1 | 2 | 3          // gating boutique, inchangé
  kind: ItemKind
  effect: string
  needsTarget?: 'column' | 'symbol' | null
  /** Cap par famille, ex. wild_column: 1. Absent = pas de cap. */
  maxOwned?: number
  tiers: Record<ItemRarity, ItemTier>
}

export interface ItemInstance {
  instanceId: string
  defId: string             // ⚠ ne "extends ItemDef" plus
  rarity: ItemRarity
  target?: number | string | null
  remainingCharges?: number
}
```

**Rupture importante** : `ItemInstance extends ItemDef` disparaît. Tout le code qui lit
`instance.price` / `instance.effect` directement doit passer par `getItem(defId)` et
`def.tiers[instance.rarity]`.

`getModifiers()` contient aujourd'hui des nombres en dur (`modifiers.rarity += 10`,
`+= 25`, `+= 30`). Ils doivent tous être lus depuis `tier.params`.

**Sauvegarde** : le format d'instance change ⇒ bumper `casinotro_v3` → `casinotro_v4`.
Pas de migration, les runs en cours sont perdus (acceptable, jeu en dev).

---

## 6. UI

### Couleurs de rareté
Thème démoniaque, pas MMO — pas de bleu/violet/orange. Progression pierre → sang → or.

| rareté | fond | bordure |
|---|---|---|
| commun | `#2a2a2f` (gris ardoise) | `#55555e` |
| rare | `#3a1418` (rouge sang sourd) | `#a3202c` |
| épique | `#3a2c0a` (or brûlé) | `#d4a017` + halo |

Pulsation lente ou liseré animé sur l'épique uniquement.

### Bouton d'achat — trois états, pas un booléen
1. `achetable`
2. `achetable en fusion uniquement` (inventaire plein mais l'achat fusionne)
3. `bloqué`

### Le piège de l'ordre pour les items ciblés
Pour un item **sans cible**, l'état est déterminable à l'affichage.
Pour un item **ciblé**, savoir si l'achat fusionne dépend de la cible — **choisie après
le clic**. Donc :

> Le bouton reste actif. Le **sélecteur de cible** grise les cibles qui ne mènent pas à
> une fusion quand l'inventaire est plein, avec la raison affichée.

L'état 3 ne survient pour un item ciblé que si l'inventaire est plein **et** qu'aucune
cible ne mène à une fusion.

Les deux raisons de blocage — *pas assez d'âmes* et *inventaire plein* — doivent être
distinguées à l'écran : sinon le joueur ne sait pas s'il doit attendre ou vendre.

---

## 7. Ordre d'implémentation

Les garde-fous avant les twists : coder les twists d'abord, c'est mesurer un RTP
déjà cassé.

| # | phase | contenu | risque |
|---|---|---|---|
| 1 | **Fondations** | `ItemRarity`, `ItemTier`, découplage `ItemInstance`/`ItemDef`, extraction des nombres en dur de `getModifiers()` vers `tiers.commun.params`. Aucun changement de gameplay, suite verte. | refactor large |
| 2 | **Garde-fous** | invariant wild (2.1), clamp dormant (2.2), cap ×12 (2.3), cap chaîne (2.4), règle consommables (2.5) | faible |
| 3 | **Megaways off** | flag `playable`, retrait du pool jouable et de `Progression` | faible |
| 4 | **Slots** | 3/4/5/6 selon stage et mode infini | faible |
| 5 | **Fusion** | fusion auto à l'achat, règle cible, achat légal à inventaire plein, `maxOwned` | moyen |
| 6 | **Boutique** | tirage rareté en deux temps, prix par palier, écho | moyen |
| 7 | **Twists** | les 13 × 2 paliers de la section 4 | gros volume |
| 8 | **UI** | couleurs, bouton 3 états, filtrage des cibles, affichage du cap | manuel only |

---

## 8. Tests

### Nouveaux
- `items.fusion.test.ts` — matrice de fusion : même id/même rareté ✓, cibles différentes ✗,
  commun+rare ✗, consommables = charges seulement, achat légal à inventaire plein.
- `items.shop.test.ts` — distribution de rareté par stage (tolérance statistique),
  ratios de prix ≥ 2,2× et ≥ 4,5×, écho biaise bien vers les items possédés en 1 exemplaire.
- `items.rtp-ceiling.test.ts` — **nouvelle catégorie** : premier test qui inclut des items
  dans la mesure RTP. Ce n'est **pas** une extension de `SlotMachine.rtp.test.ts` :
  c'est un **plafond de sécurité**, pas une cible. Configs à mesurer :
  1, 2, 3 colonnes wild (avec et sans clamp) · 5 slots d'épiques multiplicatifs ·
  chaîne saturée en run long. Échec si > 160 %.

### Existants à ajuster
- `BonusSystem.test.ts` — construit les items via `ITEM_POOL.find(b => b.effect === …)`,
  cassera au découplage `ItemInstance`.
- `machines.test.ts` — doit continuer à valider megaways malgré `playable: false`.

---

## 9. Chiffres à mesurer avant de figer

Le tableau de la section 4 est cohérent avec la courbe ×1,4, mais trois valeurs sont
des paris, pas des mesures :

1. **Filet de Sécurité** — sa valeur = `taux × P(zéro gain)`. Si `P(zéro gain)` vaut 25–40 %
   sur `rigide`, l'item ajoute déjà **+12 à +20 % de RTP** au palier commun pour 15⛧.
   C'est probablement l'item le plus fort du pool actuel et ça ne se voit pas.
   → mesurer `P(zéro gain)` sur `rigide` avant de figer 50/65/80.
2. **Chaîne** — dépend de la durée d'un run et surtout du mode infini.
3. **Symbole Béni épique** — double effet (×4 + priorité d'ancre).

### Hypothèse économique sous-jacente
Toute la courbe sous-linéaire suppose que **les slots bloquent avant les âmes** en fin
de partie : le joueur finit avec 5 slots pleins et un surplus d'âmes inutilisable.
Les slots resserrés (3/4/5) forcent ce monde. Si à l'usage le joueur finit avec des
slots vides faute d'argent, la fusion devient un piège et **toute la section 1 est à
revoir** — c'est l'hypothèse à surveiller aux premiers tests de jeu réels.


---

## 10. Écarts au plan, mesurés à l'implémentation

Trois valeurs du plan étaient des paris (section 9). La mesure les a tranchés, deux d'entre
eux contre le plan.

### 10.1 Filet de Sécurité — 15 / 20 / 25 %, pas 50 / 65 / 80 %
`P(spin mort)` mesurée sur `rigide` : **0,707** (200 000 spins, graine 42). À 50 %, l'item
seul ajoute +35 points de RTP et rend le joueur gagnant de très loin. Les paliers retenus
ajoutent +10,6 / +14,1 / +17,7 points — le palier épique dépasse quand même 100 % de RTP à
lui seul, assumé : c'est l'item le plus fort du pool et il est le seul dans ce cas.

### 10.2 Invariant wild — la limite est `minMatch - 2`, et la colonne devient intermittente
Le plan écrivait « moins de `minMatch` colonnes wild consécutives », ce qui autorise deux
colonnes wild sur une machine `minMatch: 3` — exactement le cas que le plan décrit comme
mortel. La limite tenable est `minMatch - 2`, soit **une seule** colonne wild : c'est ce que
le code applique (`sanitizeWildColumns`), et ça rejoint la conclusion du plan (`maxOwned: 1`).

Mais même une seule colonne wild permanente était intenable : **RTP mesuré à 3,5** sur
`rigide`, parce que chaque ligne n'a plus besoin que de deux symboles au lieu de trois, sur
vingt lignes. Deux corrections :

1. Une colonne wild **allonge** une combinaison, elle n'en crée jamais le minimum : il faut
   toujours `minMatch` rouleaux naturels (`naturalCount`).
2. La colonne wild n'est plus permanente mais **intermittente** — 8 / 11 / 15 % des spins
   selon le palier, tirée une fois par spin (`BonusSystem.rollSpinState`). Le palier épique
   garde son ×1,5. RTP de l'item épique seul : **1,51**.

C'est le seul twist du tableau de la section 4 qui change de nature.

### 10.3 Le plafond RTP de 160 % est incompatible avec un cap ×12
Mesures sur `rigide`, 40 000 spins, items inclus :

| configuration | RTP |
|---|---|
| aucun item | 0,94 |
| Colonne Dorée épique | 3,77 |
| Symbole Collant épique | 2,07 |
| Œil du Cupide épique | 1,51 |
| Colonne Wild épique | 1,51 |
| 5 emplacements d'épiques | 7,64 |

Un multiplicateur de colonne touche **toutes** les lignes qui la traversent : ×4 vaut ×4 de
RTP. C'est structurel, pas un emballement — et c'était déjà vrai avant la refonte (la
Colonne Dorée commune ×2 valait déjà ×1,84). Un plafond de 160 % supposerait un `MULT_CAP`
autour de ×4, donc des items sans intérêt.

`items.rtp-ceiling.test.ts` garde donc deux seuils **mesurés** au lieu du 160 % théorique :
- **4,2** pour un item seul — attrape l'item qui s'emballe tout seul ;
- **10** pour un build de cinq épiques — attrape la dérive multiplicative (le vrai risque,
  du type ways ×343).

À rediscuter si l'on préfère honorer les 160 % : le levier est `MULT_CAP`, pas les items.

### 10.4 Détails d'implémentation qui tranchent une ambiguïté
- **Colonne Dorée épique** : le rouleau adjacent est le suivant (le précédent sur le dernier
  rouleau), pas « au choix » — aucune UI de seconde cible.
- **Fusion d'un consommable** : la rareté monte quand même, mais les charges sont sommées
  puis ×1,5 au lieu d'être remplacées par celles du palier. L'effet reste figé, comme prévu.
- **Filet épique / chaîne** : « le remboursement compte comme mise pour les chaînes » est
  implémenté comme « un spin mort ne casse pas la chaîne » (`chainKeepOnLoss`).
- **Œil du Cupide épique** : la convoitise biaisait déjà le scatter ; le palier ajoute un
  surpoids explicite (`scatterBoost`).
- **Emplacements** : 3 / 4 / 5 / 6 sont désormais attachés au palier (`setMaxSlots`), pas
  cumulés par quota franchi.
- **RTP de megaways** : `SlotMachine.rtp.test.ts` ne mesure plus que les machines jouables
  (temps de suite divisé par deux) ; `machines.test.ts` continue de valider sa config.
