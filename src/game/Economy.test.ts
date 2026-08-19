import { describe, it, expect, beforeEach } from 'vitest'
import { Economy, BET_OPTIONS } from './Economy.ts'

describe('BET_OPTIONS', () => {
  it('contient les 5 mises attendues', () => {
    expect(BET_OPTIONS).toEqual([1, 2, 5, 10, 25])
  })

  it('est immuable : setBetOptions ne doit pas le réécrire', () => {
    const eco = new Economy(100)
    eco.setBetOptions([25, 50, 125, 250, 625])
    expect(BET_OPTIONS).toEqual([1, 2, 5, 10, 25])
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

describe('Economy', () => {
  let eco

  beforeEach(() => {
    eco = new Economy(100)
    eco.highscore // charger highscore (simulé)
  })

  it('initialise avec le solde de départ', () => {
    expect(eco.balance).toBe(100)
  })

  it('setBet change la mise si elle est dans BET_OPTIONS', () => {
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

  it('addWin met à jour highscore si balance dépasse le précédent', () => {
    eco.addWin(500)
    expect(eco.highscore).toBe(600)
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
