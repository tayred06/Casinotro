import { describe, it, expect } from 'vitest'
import { Tutorial, TUTORIAL_STEPS } from './Tutorial.ts'
import type { TutorialStore, TutorialEvent } from './Tutorial.ts'

const spin = (o: Partial<{ won: boolean; canAffordOffer: boolean; fusionAvailable: boolean }> = {}): TutorialEvent =>
  ({ type: 'spin_resolved', won: false, canAffordOffer: false, fusionAvailable: false, ...o })

function store(done = false, seen: string[] = []): { tutorialDone: boolean; tutorialSeen: Set<string>; saves: number; saveTutorial(d: boolean, s: readonly string[]): void } {
  return {
    tutorialDone: done,
    tutorialSeen: new Set(seen),
    saves: 0,
    saveTutorial(d, s) { this.tutorialDone = d; this.tutorialSeen = new Set(s); this.saves++ },
  }
}

describe('Tutorial — séquence', () => {
  it('début de run → mise', () => {
    expect(new Tutorial().notify({ type: 'run_start' })).toEqual(['mise'])
  })

  it('spin perdant → quota puis vitalité ; spin gagnant → quota seul', () => {
    expect(new Tutorial().notify(spin())).toEqual(['quota', 'vitalite'])
    expect(new Tutorial().notify(spin({ won: true }))).toEqual(['quota'])
  })

  it('boutique seulement si une offre est abordable', () => {
    const t = new Tutorial()
    expect(t.notify({ type: 'shop_changed', canAffordOffer: false, fusionAvailable: false })).toEqual([])
    expect(t.notify({ type: 'shop_changed', canAffordOffer: true, fusionAvailable: false })).toEqual(['boutique'])
  })

  it('fusion seulement si une offre fusionnable est abordable', () => {
    expect(new Tutorial().notify(spin({ won: true, canAffordOffer: true, fusionAvailable: true })))
      .toEqual(['quota', 'boutique', 'fusion'])
  })

  it('palier seulement à partir du palier 2', () => {
    const t = new Tutorial()
    expect(t.notify({ type: 'stage_reached', stage: 1 })).toEqual([])
    expect(t.notify({ type: 'stage_reached', stage: 2 })).toEqual(['palier'])
  })

  it('une étape vue ne revient plus', () => {
    const t = new Tutorial()
    t.markSeen('quota')
    expect(t.notify(spin())).toEqual(['vitalite'])
  })

  it('les six étapes vues terminent le tuto, qui ne renvoie plus rien', () => {
    const t = new Tutorial()
    for (const id of TUTORIAL_STEPS) {
      expect(t.done).toBe(false)
      t.markSeen(id)
    }
    expect(t.done).toBe(true)
    expect(t.notify({ type: 'run_start' })).toEqual([])
    expect(t.notify(spin({ canAffordOffer: true, fusionAvailable: true }))).toEqual([])
    expect(t.notify({ type: 'stage_reached', stage: 2 })).toEqual([])
  })

  it('passer termine immédiatement', () => {
    const t = new Tutorial()
    t.skip()
    expect(t.done).toBe(true)
    expect(t.notify({ type: 'run_start' })).toEqual([])
  })

  it('reset rouvre toutes les étapes', () => {
    const t = new Tutorial()
    t.markSeen('mise')
    t.skip()
    t.reset()
    expect(t.done).toBe(false)
    expect(t.notify({ type: 'run_start' })).toEqual(['mise'])
  })
})

describe('Tutorial — persistance via le store', () => {
  it('écrit vues et fin dans le store', () => {
    const s = store()
    const t = new Tutorial(s)
    t.markSeen('mise')
    expect([...s.tutorialSeen]).toEqual(['mise'])
    t.skip()
    expect(s.tutorialDone).toBe(true)
  })

  it('reprend les étapes déjà vues et ignore les ids inconnus', () => {
    const t = new Tutorial(store(false, ['mise', 'obsolete']))
    expect(t.notify({ type: 'run_start' })).toEqual([])
    expect(t.hasSeen('mise')).toBe(true)
  })

  it('un store terminé coupe le tuto dès la construction', () => {
    expect(new Tutorial(store(true)).notify({ type: 'run_start' })).toEqual([])
  })

  it('marquer deux fois la même étape n\'écrit qu\'une fois', () => {
    const s = store()
    const t = new Tutorial(s)
    t.markSeen('mise')
    t.markSeen('mise')
    expect(s.saves).toBe(1)
  })
})
