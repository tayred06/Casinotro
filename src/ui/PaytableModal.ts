import type { MachineConfig } from '../types/index.ts'
import { getSymbolById, WILD_ID, SCATTER_ID } from '../game/Symbols.ts'

/** Nombre de free spins accordés par un déclenchement scatter (voir GameLoop.handleSpin). */
const FREE_SPINS_AWARD = 8

/**
 * Modal « Comment ça paie » — explique la mécanique de la machine courante et affiche
 * sa table de paiement. Tout est dérivé du MachineConfig : aucune donnée dupliquée ici.
 */
export class PaytableModal {
  #overlay: HTMLElement
  #body: HTMLElement

  constructor() {
    this.#overlay = document.getElementById('paytable-modal-overlay')!
    this.#body    = document.getElementById('ptm-body')!

    this.#overlay.addEventListener('click', e => {
      if (e.target === this.#overlay) this.close()
    })
    document.getElementById('ptm-close')?.addEventListener('click', () => this.close())
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !this.#overlay.classList.contains('hidden')) this.close()
    })
  }

  open(machine: MachineConfig) {
    document.getElementById('ptm-title')!.textContent = machine.name
    document.getElementById('ptm-sub')!.textContent   = this.#geometryLabel(machine)

    this.#body.textContent = ''
    this.#body.appendChild(this.#sectionHow(machine))
    this.#body.appendChild(this.#sectionSpecials(machine))
    if (machine.evaluator === 'lines' && machine.paylines?.length) {
      this.#body.appendChild(this.#sectionPaylines(machine))
    }
    this.#body.appendChild(this.#sectionPaytable(machine))

    this.#overlay.classList.remove('hidden')
    this.#body.scrollTop = 0
  }

  close() { this.#overlay.classList.add('hidden') }

  isOpen() { return !this.#overlay.classList.contains('hidden') }

  // ── Sections ───────────────────────────────────────────

  #geometryLabel(m: MachineConfig): string {
    const geometry = m.rows.kind === 'fixed'
      ? `${m.reelCount} rouleaux × ${m.rows.count} lignes`
      : `${m.reelCount} rouleaux × ${m.rows.min}-${m.rows.max} symboles`
    const mode = m.evaluator === 'lines'
      ? `${m.paylines?.length ?? 0} lignes de paie`
      : 'Ways — toutes positions'
    return `${mode} · ${geometry} · RTP ${Math.round(m.rtpTarget * 100)}%`
  }

  #sectionHow(m: MachineConfig): HTMLElement {
    const sec = this.#section('Comment ça paie')
    const rules: string[] = []

    rules.push(
      `Un gain se lit de <b>gauche à droite</b> : il doit démarrer sur le rouleau 1 et ` +
      `occuper au moins <b>${m.minMatch} rouleaux consécutifs</b>.`
    )

    if (m.evaluator === 'ways') {
      rules.push(
        `Mécanique <b>Ways</b> : la position verticale n'a aucune importance. Un symbole ` +
        `compte n'importe où dans sa colonne.`
      )
      rules.push(
        `Le gain est payé <b>une fois par chemin distinct</b> : on multiplie le nombre ` +
        `d'occurrences du symbole sur chaque rouleau de la chaîne. 2 symboles sur le ` +
        `rouleau 1, 3 sur le 2 et 1 sur le 3 → 2 × 3 × 1 = <b>6 combinaisons payées</b>.`
      )
      rules.push(
        `C'est pourquoi les montants de la table ci-dessous sont faibles : ils sont ` +
        `<b>par combinaison</b>, pas par gain total.`
      )
      if (m.rows.kind === 'variable') {
        rules.push(
          `La hauteur de chaque colonne est <b>retirée au hasard à chaque spin</b> ` +
          `(${m.rows.min} à ${m.rows.max} symboles) : le nombre de chemins possibles ` +
          `change d'un tour à l'autre.`
        )
      }
    } else {
      rules.push(
        `Mécanique <b>lignes fixes</b> : seules les <b>${m.paylines?.length ?? 0} lignes ` +
        `tracées</b> paient. La position compte — un symbole hors ligne ne rapporte rien.`
      )
      rules.push(
        `Chaque ligne traverse <b>une seule case par rouleau</b>. Le symbole de référence ` +
        `est le premier non-wild rencontré sur la ligne.`
      )
      rules.push(
        `Chaque ligne est évaluée séparément et les gains s'additionnent. La table ` +
        `ci-dessous est donc <b>par ligne</b>, multipliée par la mise.`
      )
    }

    rules.push(`Tous les montants de la table sont des <b>multiplicateurs de la mise</b>.`)

    sec.appendChild(this.#list(rules))
    return sec
  }

  #sectionSpecials(m: MachineConfig): HTMLElement {
    const sec = this.#section('Symboles spéciaux')
    const wrap = document.createElement('div')
    wrap.className = 'ptm-specials'

    if (m.symbolPool.includes(WILD_ID)) {
      wrap.appendChild(this.#special(
        WILD_ID,
        `Remplace n'importe quel symbole payant pour compléter une chaîne. ` +
        `Ne remplace jamais le scatter et ne paie pas seul.`
      ))
    }
    if (m.symbolPool.includes(SCATTER_ID)) {
      wrap.appendChild(this.#special(
        SCATTER_ID,
        `Ne forme jamais de combinaison. <b>${m.scatterMin} scatters ou plus</b> ` +
        `n'importe où sur la grille déclenchent <b>${FREE_SPINS_AWARD} tours gratuits</b>.`
      ))
    }

    sec.appendChild(wrap)
    return sec
  }

  #special(id: string, text: string): HTMLElement {
    const sym = getSymbolById(id)
    const row = document.createElement('div')
    row.className = 'ptm-special'

    const tile = document.createElement('span')
    tile.className = 'ptm-sym'
    tile.style.color = `#${(sym?.color ?? 0xffffff).toString(16).padStart(6, '0')}`
    tile.textContent = sym?.emoji ?? '?'

    const body = document.createElement('div')
    body.className = 'ptm-special-body'
    const name = document.createElement('span')
    name.className = 'ptm-special-name'
    name.textContent = sym?.name ?? id
    const desc = document.createElement('p')
    desc.className = 'ptm-special-text'
    desc.innerHTML = text

    body.append(name, desc)
    row.append(tile, body)
    return row
  }

  #sectionPaylines(m: MachineConfig): HTMLElement {
    const lines = m.paylines!
    const rowCount = m.rows.kind === 'fixed' ? m.rows.count : m.rows.max
    const sec = this.#section(`Les ${lines.length} lignes de paie`)

    const grid = document.createElement('div')
    grid.className = 'ptm-lines'

    lines.forEach((line, i) => {
      const cell = document.createElement('div')
      cell.className = 'ptm-line'

      const label = document.createElement('span')
      label.className = 'ptm-line-lbl'
      label.textContent = String(i + 1).padStart(2, '0')

      const mini = document.createElement('div')
      mini.className = 'ptm-line-grid'
      mini.style.gridTemplateColumns = `repeat(${m.reelCount}, 1fr)`

      for (let r = 0; r < rowCount; r++) {
        for (let c = 0; c < m.reelCount; c++) {
          const dot = document.createElement('span')
          dot.className = line[c] === r ? 'ptm-dot on' : 'ptm-dot'
          dot.style.gridColumn = String(c + 1)
          dot.style.gridRow    = String(r + 1)
          mini.appendChild(dot)
        }
      }

      cell.append(label, mini)
      grid.appendChild(cell)
    })

    sec.appendChild(grid)
    return sec
  }

  #sectionPaytable(m: MachineConfig): HTMLElement {
    const unit = m.evaluator === 'ways' ? 'par combinaison' : 'par ligne'
    const sec = this.#section(`Table de paiement — ${unit}`)

    // Colonnes = tailles de chaîne présentes dans la table, triées.
    const counts = [...new Set(
      Object.values(m.paytable).flatMap(rows => Object.keys(rows).map(Number))
    )].sort((a, b) => a - b)

    // Symboles payants du pool, du plus cher au moins cher (référence : chaîne max).
    const ids = m.symbolPool.filter(id => id !== WILD_ID && id !== SCATTER_ID && m.paytable[id])
    const top = counts[counts.length - 1]
    ids.sort((a, b) => (m.paytable[b][top] ?? 0) - (m.paytable[a][top] ?? 0))

    const table = document.createElement('table')
    table.className = 'ptm-table'

    const thead = document.createElement('thead')
    const hr = document.createElement('tr')
    hr.appendChild(this.#cell('th', 'Symbole'))
    for (const c of counts) hr.appendChild(this.#cell('th', `${c}×`))
    thead.appendChild(hr)

    const tbody = document.createElement('tbody')
    for (const id of ids) {
      const sym = getSymbolById(id)
      const tr = document.createElement('tr')

      const nameCell = document.createElement('td')
      nameCell.className = 'ptm-td-sym'
      const tile = document.createElement('span')
      tile.className = 'ptm-sym sm'
      tile.style.color = `#${(sym?.color ?? 0xffffff).toString(16).padStart(6, '0')}`
      tile.textContent = sym?.emoji ?? '?'
      const nm = document.createElement('span')
      nm.textContent = sym?.name ?? id
      nameCell.append(tile, nm)
      tr.appendChild(nameCell)

      for (const c of counts) {
        const v = m.paytable[id][c]
        tr.appendChild(this.#cell('td', v === undefined ? '—' : `×${this.#fmt(v)}`))
      }
      tbody.appendChild(tr)
    }

    table.append(thead, tbody)
    sec.appendChild(table)

    const note = document.createElement('p')
    note.className = 'ptm-note'
    note.textContent = m.evaluator === 'ways'
      ? 'Gain = multiplicateur × mise × nombre de combinaisons.'
      : 'Gain = multiplicateur × mise, cumulé sur toutes les lignes gagnantes.'
    sec.appendChild(note)

    return sec
  }

  // ── Helpers ────────────────────────────────────────────

  #fmt(v: number): string {
    if (v >= 100) return v.toFixed(0)
    if (v >= 10)  return v.toFixed(1)
    return v.toFixed(2)
  }

  #section(title: string): HTMLElement {
    const sec = document.createElement('section')
    sec.className = 'ptm-section'
    const h = document.createElement('h3')
    h.className = 'ptm-h'
    h.textContent = title
    sec.appendChild(h)
    return sec
  }

  #list(items: string[]): HTMLElement {
    const ul = document.createElement('ul')
    ul.className = 'ptm-list'
    for (const it of items) {
      const li = document.createElement('li')
      li.innerHTML = it
      ul.appendChild(li)
    }
    return ul
  }

  #cell(tag: 'th' | 'td', text: string): HTMLElement {
    const el = document.createElement(tag)
    el.textContent = text
    return el
  }
}
