/**
 * Chaque personnage correspond à un péché capital.
 *
 * Champs obligatoires :
 *   id          – identifiant unique (snake_case)
 *   name        – nom affiché
 *   sin         – nom du péché en latin
 *   emoji       – icône du personnage
 *   description – effet affiché au joueur (1 phrase)
 *   effect      – objet consommé par le moteur de jeu (voir exemples ci-dessous)
 *
 * Champs optionnels ajoutés :
 *   color       – couleur d'ambiance du personnage (pour l'instant : couleur de fond)
 *   unlockOrder – ordre de déblocage (du péché le plus léger au plus grave)
 *   hidden      – true = non listé tant que non débloqué
 *   goal        – objectif de cagnotte de la campagne
 *   effect.params – paramètres numériques consommés par le handler custom
 *
 * Types d'effect disponibles (à étendre si besoin) :
 *   { type: 'start_balance',    value: Number }          // solde de départ modifié
 *   { type: 'luck_bonus',       value: Number }          // bonus de chance permanent (0-100)
 *   { type: 'bet_multiplier',   value: Number }          // multiplicateur sur chaque mise
 *   { type: 'win_multiplier',   value: Number }          // multiplicateur sur chaque gain
 *   { type: 'safety_net',       value: Number }          // % remboursé sur spin sans gain
 *   { type: 'start_bonus',      bonusId: String }        // bonus du shop offert au départ
 *   { type: 'free_spins_start', value: Number }          // free spins offerts au départ
 *   { type: 'custom',           key: String, value: any }// effet spécial géré manuellement
 */

export interface Character {
  id: string
  name: string
  sin: string
  emoji: string
  description: string
  mechTitle?: string
  sigil?: string
  tag?: string
  color?: string
  colorEdge?: string
  unlockOrder: number
  /** Machine jouée par ce personnage. Défaut : 'megaways'. */
  machineId?: string
  hidden?: boolean
  goal?: number
  effect: { type: string; key?: string; params?: Record<string, any>; value?: any; bonusId?: string }
}

export const CHARACTERS: Character[] = [
  {
    id: 'luxuria',
    name: 'L\'Amante',
    sin: 'Luxuria',           // Luxure
    emoji: '🌹',
    mechTitle: 'Entretien',
    sigil: '♥',
    tag: 'La Rouge',
    color: '#2A0A14',
    colorEdge: '#8a2038',         // bordeaux profond, velours et néon rose
    unlockOrder: 1,
    goal: 10000,
    description:
      'Les symboles rares apparaissent bien plus souvent, mais sa fortune s\'évapore à chaque spin.',
    effect: {
      type: 'custom',
      key: 'luxuria',
      params: {
        rareSymbolWeightMultiplier: 2.5, // fréquence des symboles rares
        upkeepPercent: 0.05,             // % de la cagnotte perdu à chaque spin
        upkeepLabel: 'Entretien',        // libellé affiché (ton bureaucratique)
        upkeepRamp: 0,                   // +X points de % tous les rampEvery spins (0 = désactivé)
        upkeepRampEvery: 5,
      },
    },
  },
  {
    id: 'gula',
    name: 'Le Convive',
    sin: 'Gula',              // Gourmandise
    emoji: '🍖',
    mechTitle: 'Escalade',
    sigil: 'O',
    tag: 'Le Gouffre',
    color: '#2A1508',
    colorEdge: '#8a5a24',         // brun brûlé, graisse et cuivre terni
    unlockOrder: 2,
    goal: 10000,
    description:
      'Sa mise grimpe seule à chaque spin ; il doit dévorer ses propres bonus pour la faire retomber.',
    effect: {
      type: 'custom',
      key: 'gula',
      params: {
        betEscalationPercent: 0.12, // + % de mise à chaque spin, automatique
        betEscalationFloor: 1,      // incrément minimum en valeur absolue
        playerControlsBet: false,   // la mise n'est pas choisie par le joueur
        devourResetsEscalation: true, // consommer un bonus remet la mise à son plancher
        devourRefundPercent: 0,     // 0 = pas de cash rendu, seulement le reset
      },
    },
  },
  {
    id: 'avaritia',
    name: 'Le Banquier',
    sin: 'Avaritia',          // Avarice
    emoji: '💰',
    mechTitle: 'Intérêts',
    sigil: '$',
    tag: 'Le Coffre',
    color: '#241D06',
    colorEdge: '#8a7420',         // or éteint sur fond de coffre-fort
    unlockOrder: 3,
    goal: 10000,
    description:
      'Ses gains sont doublés, mais la boutique ne s\'ouvre que par quarts, à mesure qu\'il s\'enrichit.',
    effect: {
      type: 'custom',
      key: 'avaritia',
      params: {
        winMultiplier: 2,
        // Paliers indexés sur la progression vers `goal` (record de cagnotte)
        shopGates: [
          { progress: 0.0, maxTier: 0, priceMultiplier: null }, // aucun achat
          { progress: 0.25, maxTier: 1, priceMultiplier: 2 },
          { progress: 0.5, maxTier: 2, priceMultiplier: 1.5 },
          { progress: 0.75, maxTier: 3, priceMultiplier: 1 },  // boutique complète
        ],
        // Idée gardée en réserve : les combinaisons faibles ne rapportent rien
        despiseLowSymbols: false,
        lowSymbolPayoutMultiplier: 0,
      },
    },
  },
  {
    id: 'ira',
    name: 'Le Boxeur',
    sin: 'Ira',               // Colère
    emoji: '🔥',
    mechTitle: 'Frappe',
    sigil: 'X',
    tag: 'La Braise',
    color: '#2B0C06',
    colorEdge: '#96431a',         // braise, métal chauffé à blanc
    unlockOrder: 4,
    machineId: 'rigide',
    goal: 10000,
    description:
      'Sa machine ne respire plus : 6 colonnes de 5 slots, figées. Il peut la frapper pour un spin gratuit amélioré, mais chaque coup brise un slot — et une colonne morte finit la partie.',
    effect: {
      type: 'custom',
      key: 'ira',
      params: {
        strikeAlwaysAvailable: true,  // bouton permanent, pas une ressource
        strikeSpinMultiplier: 1.5,    // le free spin obtenu est "amélioré"
        slotLives: 3,                 // intact -> fissuré -> lézardé -> mort
        damageTargeting: 'random',    // slot au hasard parmi les vivants
        damageAttraction: 2,          // les cases déjà abîmées attirent les coups
        shatterChanceBase: 0.10,      // proba de tuer un slot d'un coup
        shatterChancePerStrike: 0.03, // escalade : +3 pts par frappe
        shatterChanceMax: 1,
        loseOnDeadColumn: true,       // une colonne entière morte = fin de partie
        repairBonusId: 'reparation',  // restaure un slot
        calmBonusId: 'respirer',      // fait redescendre shatterChance
        calmReduction: 0.15,          // points de % rendus par "Respirer"
        rareBonusGuaranteedEvery: 3,  // garanti en boutique tous les X paliers
      },
    },
  },
  {
    id: 'invidia',
    name: 'L\'Actrice',
    sin: 'Invidia',           // Envie
    emoji: '👁️',
    mechTitle: 'Déclin',
    sigil: 'E',
    tag: 'Le Miroir',
    color: '#0C2018',
    colorEdge: '#1f7a6a',         // vert malade, lumière d'aquarium
    unlockOrder: 5,
    goal: 10000,
    description:
      'Quatre machines côte à côte : la sienne s\'épuise pendant que les voisines s\'enflamment, et changer coûte un spin à vide.',
    effect: {
      type: 'custom',
      key: 'invidia',
      params: {
        machineCount: 4,
        activeDecayPerSpin: 0.10,   // -10 % de rendement sur la machine occupée
        idleGrowthPerSpin: 0.08,    // les machines libres montent visiblement
        idleMultiplierCap: 5,
        switchCostsSpin: true,      // la mise est payée, aucun gain récolté
        switchInheritsMultiplier: true, // on récupère le multiplicateur de la nouvelle
        showRivalJackpots: true,    // gains des voisines affichés en permanence
      },
    },
  },
  {
    id: 'acedia',
    name: 'Le Voyageur',
    sin: 'Acedia',            // Paresse
    emoji: '💤',
    mechTitle: 'Chrono',
    sigil: 'Z',
    tag: 'Le Dormeur',
    color: '#141A26',
    colorEdge: '#3a4a8a',         // bleu-gris froid, salle d'attente
    unlockOrder: 6,
    goal: 10000,
    description:
      'Dix secondes par spin pour tout décider ; les gains rendent du temps, l\'hésitation le dévore.',
    effect: {
      type: 'custom',
      key: 'acedia',
      params: {
        baseTimerSeconds: 10,
        timerCapSeconds: 30,        // temps capitalisable
        timeGainPerWin: 2,          // secondes rendues par gain
        shopOpenDuringTimer: true,  // réfléchir coûte du temps
        onTimeout: 'auto_spin_min_bet', // occasion perdue, pas la partie
        timerTightenPerTier: 0.5,   // secondes retirées à chaque palier de mise
        timerFloorSeconds: 4,
        pauseBonusId: 'pause',      // rare, usage unique
      },
    },
  },
  {
    id: 'superbia',
    name: 'L\'Architecte',
    sin: 'Superbia',          // Orgueil
    emoji: '👑',
    mechTitle: 'Annonce',
    sigil: '★',
    tag: 'Le Paon',
    color: '#1C0F2B',
    colorEdge: '#5a3fa0',         // pourpre royal, marbre sous néon
    unlockOrder: 7,
    goal: 10000,
    description:
      'Il annonce ses gains avant de lancer : seul ce qu\'il a déclaré compte, tout le reste est perdu.',
    effect: {
      type: 'custom',
      key: 'superbia',
      params: {
        requiresDeclaration: true,     // spin bloqué tant que rien n'est coché
        maxDeclarations: 3,            // nombre d'annonces cochables par spin
        undeclaredPayoutMultiplier: 0, // un gain non annoncé ne rapporte rien
        failLosesBet: true,            // échec = mise perdue même si spin gagnant
        showMissedPayout: true,        // affiche ce qu'on aurait touché : le supplice
        // Grille d'annonces : plus c'est rare, plus ça paie
        declarations: [
          { id: 'three_of_a_kind', label: '3 symboles identiques', multiplier: 1.5 },
          { id: 'four_of_a_kind', label: '4 symboles identiques', multiplier: 3 },
          { id: 'five_of_a_kind', label: '5 symboles identiques', multiplier: 8 },
          { id: 'win_x5', label: 'Au moins ×5 la mise', multiplier: 2 },
          { id: 'win_x20', label: 'Au moins ×20 la mise', multiplier: 6 },
          { id: 'rare_symbol', label: 'Au moins 1 symbole rare', multiplier: 1.8 },
          { id: 'full_column', label: 'Une colonne entière identique', multiplier: 12 },
          { id: 'no_win', label: 'Aucun gain', multiplier: 2.5 },
        ],
      },
    },
  },
  {
    id: 'character_8',
    name: 'Le Joueur',
    sin: 'Spes',              // Espoir — le péché de rester en sachant
    emoji: '❓',
    mechTitle: 'Aucun don',
    sigil: '♠',
    tag: 'Vous',
    color: '#0A0A0A',
    colorEdge: '#4a5058',         // noir. rien d'autre.
    unlockOrder: 8,
    hidden: true,             // révélé uniquement après le twist final
    goal: 150000000000,
    description:
      'Aucune limite, aucun conseil, aucun croupier : un objectif chiffré, affiché, et pratiquement hors d\'atteinte.',
    effect: {
      type: 'custom',
      key: 'character_8',
      params: {
        goalIsTheoreticallyReachable: true, // possible, mais il faut un alignement parfait
        betTiersNeverStop: true,            // les paliers montent à l'infini
        progressBarPrecision: 5,            // affiche ~0,001 %
        croupierSilent: true,               // il ne te parle plus
        difficultyMultiplier: 1,            // les autres persos débloquent des paliers de difficulté ; lui non
        canPrestige: false,
        victoryLine: 'Je savais que tu resterais.', // seule récompense
      },
    },
  },
]

/** Ordre de déblocage : du péché le plus léger au plus grave. */
export const UNLOCK_ORDER = CHARACTERS
  .slice()
  .sort((a, b) => a.unlockOrder - b.unlockOrder)
  .map((c) => c.id)

/** Personnage de départ (seul débloqué à la première partie). */
export const STARTING_CHARACTER_ID = 'luxuria'

export const getCharacter = (id: string): Character | undefined => CHARACTERS.find((c) => c.id === id)
