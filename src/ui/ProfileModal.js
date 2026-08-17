export class ProfileModal {
  #overlay
  #onClose

  constructor() {
    this.#overlay = document.getElementById('profile-modal-overlay')
    this.#overlay.addEventListener('click', e => {
      if (e.target === this.#overlay) this.close()
    })
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !this.#overlay.classList.contains('hidden')) this.close()
    })
  }

  open(character, economy, runState, bonusSystem) {
    const modifiers   = bonusSystem.getModifiers()
    const activeBonuses = bonusSystem.activeBonus
    const pct = Math.min(100, Math.round((economy.balance / runState.goal) * 100))

    document.getElementById('pm-emoji').textContent = character.emoji
    document.getElementById('pm-name').textContent  = character.name
    document.getElementById('pm-sin').textContent   = character.sin.toUpperCase()
    document.getElementById('pm-desc').textContent  = character.description

    document.getElementById('pm-level').textContent   = String(runState.level)
    document.getElementById('pm-goal').textContent    = `$${runState.goal.toLocaleString('fr-FR')}`
    document.getElementById('pm-progress').textContent = `${pct}%`
    document.getElementById('pm-balance').textContent = `$${economy.balance.toFixed(2)}`
    document.getElementById('pm-best').textContent    = `$${economy.highscore.toFixed(2)}`
    document.getElementById('pm-bet').textContent     = `$${economy.currentBet}`
    document.getElementById('pm-luck').textContent    = modifiers.luck > 0 ? `+${modifiers.luck}` : String(modifiers.luck)

    this.#renderBonuses(activeBonuses, modifiers)
    this.#renderEffect(character)

    this.#overlay.classList.remove('hidden')
  }

  close() {
    this.#overlay.classList.add('hidden')
  }

  #renderBonuses(activeBonuses, modifiers) {
    const container = document.getElementById('pm-bonuses')
    container.textContent = ''

    if (!activeBonuses.length) {
      const empty = document.createElement('span')
      empty.className = 'pm-empty'
      empty.textContent = 'Aucun bonus actif.'
      container.appendChild(empty)
      return
    }

    for (const bonus of activeBonuses) {
      const row = document.createElement('div')
      row.className = 'pm-bonus-row'

      const left = document.createElement('div')
      left.className = 'pm-bonus-left'

      const name = document.createElement('span')
      name.className = 'pm-bonus-name'
      name.textContent = bonus.name

      const desc = document.createElement('span')
      desc.className = 'pm-bonus-desc'
      desc.textContent = this.#bonusDetail(bonus, modifiers)

      left.appendChild(name)
      left.appendChild(desc)

      row.appendChild(left)

      if (bonus.remainingUses !== null) {
        const uses = document.createElement('span')
        uses.className = 'pm-bonus-uses'
        uses.textContent = `${bonus.remainingUses} spin${bonus.remainingUses > 1 ? 's' : ''}`
        row.appendChild(uses)
      }

      container.appendChild(row)
    }
  }

  #bonusDetail(bonus, modifiers) {
    const target = bonus.target
    switch (bonus.effect) {
      case 'column_multiplier': return target !== null ? `Colonne ${target + 1} → ×2` : bonus.description
      case 'wild_column':       return target !== null ? `Colonne ${target + 1} Wild` : bonus.description
      case 'symbol_multiplier': {
        const mult = modifiers.symbolMultipliers[target] ?? 2
        return target ? `${target} → ×${mult}` : bonus.description
      }
      case 'global_multiplier': return `×3 sur tous les gains — ${bonus.remainingUses} spin${bonus.remainingUses > 1 ? 's' : ''} restant${bonus.remainingUses > 1 ? 's' : ''}`
      case 'lucky_streak':      return `+30 chance — ${bonus.remainingUses} spin${bonus.remainingUses > 1 ? 's' : ''} restant${bonus.remainingUses > 1 ? 's' : ''}`
      case 'chain': {
        const syms = modifiers.symbolMultipliers
        const bonusMult = target ? (syms[target] ?? 1) : 1
        return target ? `${target} — chaîne active (×${bonusMult.toFixed(2)})` : bonus.description
      }
      default: return bonus.description
    }
  }

  #renderEffect(character) {
    const section = document.getElementById('pm-effect-section')
    const container = document.getElementById('pm-effect-rows')
    container.textContent = ''

    const params = character.params
    if (!params || !Object.keys(params).length) {
      section.style.display = 'none'
      return
    }

    section.style.display = ''

    const PARAM_LABELS = {
      rareSymbolWeightMultiplier: ['Symboles rares', v => `×${v} plus fréquents`],
      upkeepPercent:              ['Entretien / spin', v => `${(v * 100).toFixed(0)}% du solde`],
      upkeepRamp:                 null,
      upkeepRampEvery:            null,
      upkeepLabel:                null,
      betEscalationPercent:       ['Escalade de mise', v => `+${(v * 100).toFixed(0)}% / spin`],
      betEscalationFloor:         ['Mise plancher', v => `$${v}`],
      playerControlsBet:          null,
      devourResetsEscalation:     null,
      devourRefundPercent:        null,
      winMultiplier:              ['Multiplicateur gains', v => `×${v}`],
      strikeSpinMultiplier:       ['Bonus frappe', v => `×${v} sur free spin`],
      slotLives:                  ['Vies par slot', v => String(v)],
      shatterChanceBase:          ['Risque de casse', v => `${(v * 100).toFixed(0)}% de base`],
      shatterChancePerStrike:     ['Escalade casse', v => `+${(v * 100).toFixed(0)}% / frappe`],
      machineCount:               ['Machines', v => String(v)],
      activeDecayPerSpin:         ['Déclin (machine active)', v => `-${(v * 100).toFixed(0)}% / spin`],
      idleGrowthPerSpin:          ['Croissance (machines libres)', v => `+${(v * 100).toFixed(0)}% / spin`],
      idleMultiplierCap:          ['Plafond multiplicateur', v => `×${v}`],
      baseTimerSeconds:           ['Temps / spin', v => `${v}s`],
      timerCapSeconds:            ['Temps max cumulable', v => `${v}s`],
      timeGainPerWin:             ['Gain de temps (victoire)', v => `+${v}s`],
      timerTightenPerTier:        ['Réduction / palier', v => `-${v}s`],
      timerFloorSeconds:          ['Temps minimum', v => `${v}s`],
      goalIsTheoreticallyReachable: ['Objectif', () => 'Théoriquement atteignable'],
    }

    for (const [key, value] of Object.entries(params)) {
      const entry = PARAM_LABELS[key]
      if (!entry) continue
      const [label, fmt] = entry

      const row = document.createElement('div')
      row.className = 'pm-effect-row'

      const lbl = document.createElement('span')
      lbl.className = 'pm-effect-lbl'
      lbl.textContent = label

      const val = document.createElement('span')
      val.className = 'pm-effect-val'
      val.textContent = fmt(value)

      row.appendChild(lbl)
      row.appendChild(val)
      container.appendChild(row)
    }
  }
}
