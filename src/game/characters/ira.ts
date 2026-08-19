import type {
  CharacterAction, CharacterActionResult, CharacterPlugin,
  DialogueLine, GameContext, GameSymbol,
} from '../../types/index.ts'
import { getCharacter } from '../Characters.ts'
import { getMachine } from '../machines/index.ts'
import { random, randomInt } from '../../utils/Random.ts'

// La géométrie vient de la machine, pas du personnage : une seule source de vérité.
const MACHINE = getMachine(getCharacter('ira')?.machineId ?? 'rigide')
const REEL_COUNT = MACHINE.reelCount
const SLOTS_PER_COL = MACHINE.rows.kind === 'fixed' ? MACHINE.rows.count : MACHINE.rows.max

const P = (getCharacter('ira')?.effect?.params ?? {}) as Record<string, any>

const SLOT_LIVES              = P.slotLives ?? 3
const STRIKE_SPIN_MULTIPLIER  = P.strikeSpinMultiplier ?? 1.5
const SHATTER_BASE            = P.shatterChanceBase ?? 0.10
const SHATTER_PER_STRIKE      = P.shatterChancePerStrike ?? 0.05
const SHATTER_MAX             = P.shatterChanceMax ?? 1
const CALM_REDUCTION          = P.calmReduction ?? 0.15
const DAMAGE_ATTRACTION       = P.damageAttraction ?? 2

export const BROKEN_SYMBOL: GameSymbol = {
  id: 'broken', name: 'Slot brisé', emoji: '✖', weight: 0, color: 0x96431a,
}

export function createIraPlugin(): CharacterPlugin {
  // dmg[col][slot] : points de dégâts par case. SLOT_LIVES points = case morte.
  // La machine d'Ira est figée : une case garde donc sa position d'un spin
  // à l'autre, les dégâts peuvent être ancrés à la case elle-même.
  let dmg: number[][] = []
  let strikes = 0
  let calmStacks = 0

  function reset(): void {
    dmg = Array.from({ length: REEL_COUNT }, () =>
      Array.from({ length: SLOTS_PER_COL }, () => 0))
    strikes = 0
    calmStacks = 0
  }
  reset()

  function shatterChance(): number {
    const raw = SHATTER_BASE + SHATTER_PER_STRIKE * strikes - CALM_REDUCTION * calmStacks
    return Math.max(0, Math.min(SHATTER_MAX, raw))
  }

  /**
   * Cible aléatoire sur toute la machine, pondérée : une case déjà fissurée encaisse
   * plus volontiers le coup suivant (la structure cède où elle est faible). Sans ce
   * biais, 24 cases indépendantes ne meurent jamais assez vite pour tuer une colonne.
   */
  function pickTarget(): [number, number] | null {
    const pool: Array<[number, number]> = []
    for (let c = 0; c < REEL_COUNT; c++)
      for (let r = 0; r < SLOTS_PER_COL; r++) {
        if (dmg[c][r] >= SLOT_LIVES) continue
        const weight = 1 + dmg[c][r] * DAMAGE_ATTRACTION
        for (let w = 0; w < weight; w++) pool.push([c, r])
      }
    return pool.length ? pool[randomInt(0, pool.length - 1)] : null
  }

  /** Une colonne est morte quand ses SLOTS_PER_COL cases sont mortes. */
  function deadColumn(): number {
    for (let c = 0; c < REEL_COUNT; c++)
      if (dmg[c].every(v => v >= SLOT_LIVES)) return c
    return -1
  }

  /** Usure par case, de 0 (intacte) à 1 (morte). */
  function cellStates(): number[][] {
    return dmg.map(col => col.map(v => Math.min(1, v / SLOT_LIVES)))
  }

  return {
    id: 'ira',

    onSetup(_ctx: GameContext): void { reset() },
    onTeardown(_ctx: GameContext): void { reset() },

    /** Remplace les cases mortes par le symbole brisé (aucun gain possible). */
    transformGrid(_ctx: GameContext, grid: GameSymbol[][]): GameSymbol[][] {
      // Seules les cases MORTES bloquent la ligne — une fissure n'a aucun malus.
      const states = cellStates()
      return grid.map((col, c) =>
        col.map((sym, r) => ((states[c]?.[r] ?? 0) >= 1 ? BROKEN_SYMBOL : sym)))
    },

    getCellStates(_ctx: GameContext): number[][] {
      return cellStates()
    },

    getAction(_ctx: GameContext): CharacterAction {
      return {
        id: 'strike',
        label: 'FRAPPER',
        hint: `Spin gratuit ×${STRIKE_SPIN_MULTIPLIER} — risque de casse ${Math.round(shatterChance() * 100)}%`,
        enabled: true,
      }
    },

    onAction(ctx: GameContext, actionId: string): CharacterActionResult {
      if (actionId !== 'strike') return {}

      const target = pickTarget()
      if (!target) return { gameOver: 'La machine est morte. Toi aussi.' }

      const [c, r] = target
      const chance = shatterChance()
      strikes++

      // Une case intacte ne peut jamais céder d'un seul coup : elle fissure d'abord.
      // À partir du 2e niveau (fissurée), une casse nette peut l'emporter directement.
      if (dmg[c][r] > 0 && random() < chance) dmg[c][r] = SLOT_LIVES
      else dmg[c][r]++

      const broken = dmg[c][r] >= SLOT_LIVES
      if (broken) ctx.addLog(`💥 Le slot R${c + 1}·L${r + 1} vole en éclats.`)
      else ctx.addLog(`🩸 Le slot R${c + 1}·L${r + 1} se fissure.`, true)

      return {
        impact: { col: c, row: r, broken },
        freeSpins: 1,
        winMultiplier: STRIKE_SPIN_MULTIPLIER,
      }
    },

    onShopSell(ctx: GameContext, item): void {
      if (item.id === P.repairBonusId) {
        let best: [number, number] | null = null
        for (let c = 0; c < REEL_COUNT; c++)
          for (let r = 0; r < SLOTS_PER_COL; r++)
            if (dmg[c][r] > 0 && (!best || dmg[c][r] > dmg[best[0]][best[1]])) best = [c, r]
        if (best) {
          dmg[best[0]][best[1]] = 0
          ctx.addLog(`🔧 Slot R${best[0] + 1}·L${best[1] + 1} réparé.`)
        }
      }
      if (item.id === P.calmBonusId) {
        calmStacks++
        ctx.addLog(`🌬️ Tu respires — risque de casse ${Math.round(shatterChance() * 100)}%.`)
      }
    },

    onLossCheck(_ctx: GameContext): boolean {
      return P.loseOnDeadColumn !== false && deadColumn() >= 0
    },

    onDialogueTrigger(_ctx: GameContext): DialogueLine[] {
      return [
        { speaker: 'Le Croupier', text: 'Monsieur, la machine ne vous a rien fait.' },
        { speaker: 'Ira', text: 'Elle respire encore. Ça suffit.' },
      ]
    },

    serialize(): any { return { dmg, strikes, calmStacks } },

    restore(data: any): void {
      if (!data) return
      // La sauvegarde peut venir d'une géométrie différente : on redimensionne au
      // format courant plutôt que de restaurer une grille de dégâts incohérente.
      const saved: number[][] = Array.isArray(data.dmg) ? data.dmg : []
      dmg = Array.from({ length: REEL_COUNT }, (_, c) =>
        Array.from({ length: SLOTS_PER_COL }, (_, r) => saved[c]?.[r] ?? 0))
      strikes = data.strikes ?? 0
      calmStacks = data.calmStacks ?? 0
    },
  }
}
