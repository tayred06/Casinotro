import { describe, it, expect, beforeEach } from 'vitest'
import { Economy, DEFAULT_BET_OPTIONS } from './Economy.ts'

describe('DEFAULT_BET_OPTIONS', () => {
  it('contient les 5 mises attendues', () => {
    expect([...DEFAULT_BET_OPTIONS]).toEqual([1, 2, 5, 10, 25])
  })

  it('est figé — aucune instance ne peut le muter', () => {
    const eco = new Economy(100)
    eco.setBetOptions([50, 100])
    expect([...DEFAULT_BET_OPTIONS]).toEqual([1, 2, 5, 10, 25])
    expect(new Economy(100).betOptions).toEqual([1, 2, 5, 10, 25])
  })

  it('est immuable : setBetOptions ne doit pas le réécrire', () => {
    const eco = new Economy(100)
    eco.setBetOptions([25, 50, 125, 250, 625])
    expect(DEFAULT_BET_OPTIONS).toEqual([1, 2, 5, 10, 25])
  })

  it('les paliers sont propres à chaque Economy', () => {
    const a = new Economy(100)
    const b = new Economy(100)
    a.setBetOptions([25, 50, 125, 250, 625])
    expect(b.betOptions).toEqual([1, 2, 5, 10, 25])
    expect(a.betOptions).toEqual([25, 50, 125, 250, 625])
  })

  it('restart() ramène les paliers initiaux', () => {
    const eco = new Economy(100)
    eco.setBetOptions([25, 50, 125, 250, 625])
    eco.restart(100)
    expect(eco.betOptions).toEqual([1, 2, 5, 10, 25])
    expect(eco.currentBet).toBe(1)
  })

  it('isGameOver() se base sur les paliers courants', () => {
    const eco = new Economy(100)
    eco.setBetOptions([25, 50, 125, 250, 625])
    expect(eco.isGameOver()).toBe(false)
    eco.spend(80) // solde 20 < plus petite mise (25)
    expect(eco.isGameOver()).toBe(true)
  })
})

describe('Economy — jauge de quota', () => {
  it('stageEarned cumule les gains et se remet à zéro au palier', () => {
    const e = new Economy(100)
    e.addWin(30)
    e.addWin(12)
    expect(e.stageEarned).toBe(42)
    expect(e.totalEarned).toBe(42)
    e.resetStageEarned()
    expect(e.stageEarned).toBe(0)
    expect(e.totalEarned).toBe(42)
  })

  it('addMoney (prime de quota) ne remplit pas la jauge', () => {
    const e = new Economy(100)
    e.addMoney(500)
    expect(e.stageEarned).toBe(0)
  })

  it('survit au round-trip serialize / restore', () => {
    const e = new Economy(100)
    e.addWin(77)
    const e2 = new Economy(0)
    e2.restore(e.serialize())
    expect(e2.stageEarned).toBe(77)
  })

  it('le niveau de boutique suit le palier quand il est fourni', () => {
    const e = new Economy(100)
    expect(e.getShopLevel(1)).toBe(1)
    expect(e.getShopLevel(3)).toBe(3)
  })
})

describe('Economy', () => {
  let eco: Economy

  beforeEach(() => {
    eco = new Economy(100)
  })

  it('initialise avec le solde de départ', () => {
    expect(eco.balance).toBe(100)
  })

  it('setBet change la mise si elle fait partie des paliers', () => {
    eco.setBet(5)
    expect(eco.currentBet).toBe(5)
  })

  it('setBet ignore une mise non valide', () => {
    eco.setBet(1)
    eco.setBet(99)
    expect(eco.currentBet).toBe(1)
  })

  it('placeBet déduit la mise', () => {
    eco.setBet(10)
    const result = eco.placeBet()
    expect(result).toBe(true)
    expect(eco.balance).toBe(90)
  })

  it('placeBet retourne false si solde insuffisant', () => {
    const eco2 = new Economy(3)
    eco2.setBet(5)
    expect(eco2.placeBet()).toBe(false)
    expect(eco2.balance).toBe(3)
  })

  it('addWin ajoute au solde', () => {
    eco.addWin(50)
    expect(eco.balance).toBe(150)
  })

  it('addWin met à jour totalEarned', () => {
    eco.addWin(30)
    eco.addWin(20)
    expect(eco.totalEarned).toBe(50)
  })

  it('addMoney ajoute au solde directement', () => {
    const eco = new Economy(100)
    eco.addMoney(50)
    expect(eco.balance).toBe(150)
  })

  describe('getShopLevel', () => {
    it('niveau 1 si totalEarned < 500', () => {
      expect(eco.getShopLevel()).toBe(1)
    })

    it('niveau 2 si totalEarned entre 500 et 2000', () => {
      eco.addWin(600)
      expect(eco.getShopLevel()).toBe(2)
    })

    it('niveau 3 si totalEarned >= 2000', () => {
      eco.addWin(2500)
      expect(eco.getShopLevel()).toBe(3)
    })
  })

  it('spend déduit le montant et retourne true', () => {
    expect(eco.spend(30)).toBe(true)
    expect(eco.balance).toBe(70)
  })

  it('spend retourne false si solde insuffisant', () => {
    expect(eco.spend(200)).toBe(false)
    expect(eco.balance).toBe(100)
  })

  it('isGameOver retourne true si balance = 0', () => {
    const eco2 = new Economy(0)
    expect(eco2.isGameOver()).toBe(true)
  })

  it('isGameOver retourne false si balance > 0', () => {
    expect(eco.isGameOver()).toBe(false)
  })
})

describe('paliers de mise par instance', () => {
  it('setBetOptions n\'affecte pas les autres instances', () => {
    const a = new Economy(100)
    const b = new Economy(100)
    a.setBetOptions([100, 200, 500])
    expect(a.betOptions).toEqual([100, 200, 500])
    expect(b.betOptions).toEqual([1, 2, 5, 10, 25])
  })

  it('recale la mise courante si elle sort des nouveaux paliers', () => {
    const eco = new Economy(100)
    eco.setBet(5)
    eco.setBetOptions([25, 50, 125])
    expect(eco.currentBet).toBe(25)
  })

  it('minBet suit les paliers courants', () => {
    const eco = new Economy(100)
    eco.setBetOptions([25, 50])
    expect(eco.minBet).toBe(25)
    expect(eco.isGameOver()).toBe(false)
    eco.spend(80)
    expect(eco.isGameOver()).toBe(true)
  })

  it('serialize/restore conserve les paliers', () => {
    const eco = new Economy(100)
    eco.setBetOptions([25, 50, 125])
    eco.setBet(50)
    const clone = new Economy(1)
    clone.restore(eco.serialize())
    expect(clone.betOptions).toEqual([25, 50, 125])
    expect(clone.currentBet).toBe(50)
  })
})

describe('highscore', () => {
  it('délègue au store partagé plutôt qu\'à un stockage propre', () => {
    const store = { highscore: 0, updateHighscore(v: number) { if (v > this.highscore) this.highscore = v } }
    const eco = new Economy(100, store)
    eco.addWin(500)
    expect(store.highscore).toBe(600)
    expect(eco.highscore).toBe(600)
  })

  it('deux économies branchées sur le même store le partagent', () => {
    const store = { highscore: 0, updateHighscore(v: number) { if (v > this.highscore) this.highscore = v } }
    new Economy(100, store).addWin(900)
    expect(new Economy(100, store).highscore).toBe(1000)
  })
})
