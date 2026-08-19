import type {
  CharacterPlugin, GameContext, DialogueLine, Modifiers, SpinOptions,
} from '../../types/index.ts'
import {
  CELL_INTACT, CELL_CRACKED, CELL_DEAD, REEL_COUNT, MAX_ROWS,
} from '../SlotMachine.ts'

/** Source unique des réglages d'Ira — référencée par CHARACTERS. */
export const IRA_PARAMS = {
  freeSpinGlobalMultiplier: 1.5,
  freeSpinLuckBonus: 20,
  // En dessous de 3 rouleaux vivants, plus aucune combinaison n'est possible.
  minLiveReels: 3,
}

type Cell = { reel: number; row: number }

export function createIraPlugin(): CharacterPlugin {
  let cellDamage: number[][] = blankDamage()

  function blankDamage(): number[][] {
    return Array.from({ length: REEL_COUNT }, () => Array(MAX_ROWS).fill(CELL_INTACT))
  }

  const reset = () => { cellDamage = blankDamage() }

  /** Un rouleau est mort quand toutes ses cases affichées le sont. */
  function liveReelCount(rowCounts: number[]): number {
    let live = 0
    for (let reel = 0; reel < REEL_COUNT; reel++) {
      const rows = rowCounts[reel] ?? MAX_ROWS
      for (let row = 0; row < rows; row++) {
        if (cellDamage[reel][row] < CELL_DEAD) { live++; break }
      }
    }
    return live
  }

  /** Cases actuellement à l'écran et pas encore détruites. */
  function damageableCells(rowCounts: number[]): Cell[] {
    const cells: Cell[] = []
    for (let reel = 0; reel < REEL_COUNT; reel++) {
      const rows = Math.min(rowCounts[reel] ?? MAX_ROWS, MAX_ROWS)
      for (let row = 0; row < rows; row++) {
        if (cellDamage[reel][row] < CELL_DEAD) cells.push({ reel, row })
      }
    }
    return cells
  }

  /** Plancher de rangées : une case abîmée doit rester affichée. */
  function minRowsPerReel(): number[] {
    return cellDamage.map(rows => {
      let deepest = 0
      rows.forEach((d, row) => { if (d > CELL_INTACT) deepest = Math.max(deepest, row + 1) })
      return deepest
    })
  }

  return {
    id: 'ira',

    onSetup(_ctx: GameContext): void { reset() },
    onTeardown(_ctx: GameContext): void { reset() },

    getSpinOptions(_ctx: GameContext): SpinOptions {
      return { minRowsPerReel: minRowsPerReel() }
    },

    getModifierOverrides(_ctx: GameContext): Partial<Modifiers> {
      return { cellDamage: cellDamage.map(rows => [...rows]) }
    },

    // La machine ne peut plus rien payer = fin de la run.
    onLossCheck(ctx: GameContext): boolean {
      return liveReelCount(ctx.rowCounts) < IRA_PARAMS.minLiveReels
    },

    actions: [
      {
        id: 'frapper',
        label: 'FRAPPER',
        title: 'Un tour gratuit amélioré — mais une case au hasard est endommagée.',
        isEnabled: (ctx: GameContext) => damageableCells(ctx.rowCounts).length > 0,
        async onInvoke(ctx: GameContext): Promise<void> {
          const cells = damageableCells(ctx.rowCounts)
          if (!cells.length) return

          const { reel, row } = cells[Math.floor(Math.random() * cells.length)]
          const state = ++cellDamage[reel][row]

          ctx.addLog(
            state >= CELL_DEAD
              ? `💥 Case R${reel + 1}·L${row + 1} brisée — elle ne compte plus.`
              : `💥 Case R${reel + 1}·L${row + 1} fissurée — gains divisés par 2.`,
            state < CELL_DEAD
          )

          await ctx.requestSpin({
            free: true,
            globalMultiplier: IRA_PARAMS.freeSpinGlobalMultiplier,
            luckBonus: IRA_PARAMS.freeSpinLuckBonus,
          })
        },
      },
    ],

    onDialogueTrigger(_ctx: GameContext): DialogueLine[] {
      return [
        { speaker: 'Le Croupier', text: 'Monsieur, la machine ne vous a rien fait.' },
        { speaker: 'Ira', text: "Elle a pris mon argent. Elle prendra mes poings." },
      ]
    },
  }
}

export { CELL_INTACT, CELL_CRACKED, CELL_DEAD }
