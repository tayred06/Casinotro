import { describe, it, expect } from 'vitest'
import { MACHINES, getMachine, DEFAULT_MACHINE_ID } from './index.ts'
import { resolvePool, winSymbolsOf } from '../Symbols.ts'
import { CHARACTERS } from '../Characters.ts'

/**
 * Garde-fou pour toute machine ajoutée plus tard : une config invalide casse ici,
 * pas en jeu.
 */
describe.each(Object.values(MACHINES))('machine $id', (machine) => {
  it('a une géométrie cohérente', () => {
    expect(machine.reelCount).toBeGreaterThan(0)
    if (machine.rows.kind === 'fixed') {
      expect(machine.rows.count).toBeGreaterThan(0)
    } else {
      expect(machine.rows.min).toBeGreaterThan(0)
      expect(machine.rows.max).toBeGreaterThanOrEqual(machine.rows.min)
    }
    expect(machine.minMatch).toBeGreaterThanOrEqual(2)
    expect(machine.minMatch).toBeLessThanOrEqual(machine.reelCount)
  })

  it('n\'utilise que des symboles connus, wild et scatter inclus', () => {
    expect(() => resolvePool(machine.symbolPool)).not.toThrow()
    expect(machine.symbolPool).toContain('wild')
    expect(machine.symbolPool).toContain('scatter')
  })

  it('a une paytable couvrant chaque symbole payant de minMatch à reelCount', () => {
    for (const symbol of winSymbolsOf(machine.symbolPool)) {
      const rows = machine.paytable[symbol.id]
      expect(rows, `paytable manquante pour ${symbol.id}`).toBeDefined()
      for (let n = machine.minMatch; n <= machine.reelCount; n++) {
        expect(rows[n], `${symbol.id} × ${n}`).toBeGreaterThan(0)
      }
    }
  })

  it('a une paytable croissante avec le nombre de rouleaux', () => {
    for (const symbol of winSymbolsOf(machine.symbolPool)) {
      const rows = machine.paytable[symbol.id]
      for (let n = machine.minMatch + 1; n <= machine.reelCount; n++) {
        expect(rows[n]).toBeGreaterThan(rows[n - 1])
      }
    }
  })

  it('paie les symboles rares davantage que les fréquents', () => {
    const bySymbol = winSymbolsOf(machine.symbolPool)   // du plus rare au plus fréquent
    const pay = bySymbol.map(s => machine.paytable[s.id][machine.reelCount])
    for (let i = 1; i < pay.length; i++) {
      expect(pay[i]).toBeLessThanOrEqual(pay[i - 1])
    }
  })

  it('déclare des lignes de paie valides si son évaluateur en utilise', () => {
    if (machine.evaluator !== 'lines') {
      expect(machine.paylines).toBeUndefined()
      return
    }
    expect(machine.rows.kind).toBe('fixed')
    const height = machine.rows.kind === 'fixed' ? machine.rows.count : 0
    expect(machine.paylines!.length).toBeGreaterThan(0)

    const seen = new Set<string>()
    for (const line of machine.paylines!) {
      expect(line).toHaveLength(machine.reelCount)
      for (const row of line) {
        expect(row).toBeGreaterThanOrEqual(0)
        expect(row).toBeLessThan(height)
      }
      const key = line.join(',')
      expect(seen.has(key), `ligne en double : ${key}`).toBe(false)
      seen.add(key)
    }
  })
})

describe('registre', () => {
  it('getMachine lève sur un id inconnu', () => {
    expect(() => getMachine('nope')).toThrow(/Machine inconnue/)
  })

  it('la machine par défaut existe', () => {
    expect(() => getMachine(DEFAULT_MACHINE_ID)).not.toThrow()
  })

  it('chaque personnage pointe vers une machine existante', () => {
    for (const character of CHARACTERS) {
      expect(() => getMachine(character.machineId ?? DEFAULT_MACHINE_ID)).not.toThrow()
    }
  })

  it('Ira joue la machine figée', () => {
    const ira = CHARACTERS.find(c => c.id === 'ira')!
    const machine = getMachine(ira.machineId!)
    expect(machine.evaluator).toBe('lines')
    expect(machine.rows).toEqual({ kind: 'fixed', count: 5 })
  })
})
