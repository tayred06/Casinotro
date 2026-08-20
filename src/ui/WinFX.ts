import { getWinTier, getTierDef, tierRank, type WinTierId } from '../game/WinTier.ts'

/**
 * Effets visuels de gain — DOM + CSS uniquement, aucune dépendance PixiJS.
 *
 * `WinFX` possède ses propres calques (flash, rayons, sigil, particules) qu'il
 * injecte dans l'élément racine fourni, et pilote en plus la bannière existante
 * si on la lui passe. La séquence est skippable : `play()` résout au clic, à la
 * barre d'espace, ou à l'expiration du `holdMs` du palier.
 */

export interface WinFXTargets {
  /** Conteneur des calques d'effet + cible du shake. Typiquement `.machine`. */
  root: HTMLElement
  /** Overlay de bannière à afficher/masquer (facultatif). */
  overlay?: HTMLElement | null
  /** Bannière recevant la classe de palier (facultatif). */
  banner?: HTMLElement | null
  label?: HTMLElement | null
  amount?: HTMLElement | null
  detail?: HTMLElement | null
}

type ShakeKind = 'none' | 'soft' | 'hard' | 'quake'

interface TierFx {
  /** Durée pendant laquelle la bannière reste affichée avant résolution. */
  holdMs: number
  /** Durée du compteur qui roule. */
  countMs: number
  /** Nombre de braises projetées. */
  embers: number
  shake: ShakeKind
  /** Opacité du flash plein écran (0 = pas de flash). */
  flash: number
  /** Rayons tournants derrière la bannière. */
  rays: boolean
  /** Anneau de sigil qui se dilate. */
  sigil: boolean
  /** Pluie de ⛧ sur toute la machine. */
  rain: boolean
  /** Couleur dominante du palier. */
  color: string
}

export const TIER_FX: Readonly<Record<WinTierId, TierFx>> = Object.freeze({
  none: {
    holdMs: 0, countMs: 260, embers: 0, shake: 'none',
    flash: 0, rays: false, sigil: false, rain: false, color: '#b6f36a',
  },
  nice: {
    holdMs: 0, countMs: 420, embers: 10, shake: 'none',
    flash: 0, rays: false, sigil: true, rain: false, color: '#d9f36a',
  },
  big: {
    holdMs: 700, countMs: 700, embers: 22, shake: 'soft',
    flash: .18, rays: false, sigil: true, rain: false, color: '#f2c14b',
  },
  mega: {
    holdMs: 1300, countMs: 1000, embers: 40, shake: 'hard',
    flash: .3, rays: true, sigil: true, rain: false, color: '#ff8a3c',
  },
  epic: {
    holdMs: 2100, countMs: 1500, embers: 64, shake: 'hard',
    flash: .45, rays: true, sigil: true, rain: true, color: '#ff5a2d',
  },
  legendary: {
    holdMs: 3000, countMs: 2200, embers: 96, shake: 'quake',
    flash: .62, rays: true, sigil: true, rain: true, color: '#ff2d55',
  },
})

const SHAKE_CLASS: Record<ShakeKind, string> = {
  none: '', soft: 'wfx-shake-soft', hard: 'wfx-shake-hard', quake: 'wfx-shake-quake',
}

/**
 * Facteur de vitesse lu sur `--wfx-speed` (1 par défaut). Les keyframes CSS
 * s'y adossent déjà ; le JS le relit pour que les durées de hold suivent le
 * ralenti de la page de test.
 */
const speedFactor = (): number => {
  if (typeof getComputedStyle !== 'function') return 1
  const raw = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--wfx-speed'))
  return Number.isFinite(raw) && raw > 0 ? raw : 1
}

const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

export class WinFX {
  #targets: WinFXTargets
  #layer: HTMLElement
  #flash: HTMLElement
  #rays: HTMLElement
  #sigil: HTMLElement
  #parts: HTMLElement

  #timers: number[] = []
  #frame = 0
  #countEnd: (() => void) | null = null
  #resolve: (() => void) | null = null
  #onKey: ((e: KeyboardEvent) => void) | null = null
  #onClick: (() => void) | null = null

  constructor(targets: WinFXTargets) {
    this.#targets = targets

    this.#layer = document.createElement('div')
    this.#layer.className = 'wfx-layer'
    this.#layer.setAttribute('aria-hidden', 'true')
    this.#layer.innerHTML =
      '<div class="wfx-flash"></div>' +
      '<div class="wfx-rays"></div>' +
      '<div class="wfx-sigil"></div>' +
      '<div class="wfx-parts"></div>'

    this.#flash = this.#layer.querySelector('.wfx-flash')!
    this.#rays  = this.#layer.querySelector('.wfx-rays')!
    this.#sigil = this.#layer.querySelector('.wfx-sigil')!
    this.#parts = this.#layer.querySelector('.wfx-parts')!

    targets.root.appendChild(this.#layer)
  }

  /** Palier d'un gain — exposé pour que l'appelant décide sans recalculer. */
  static tierOf(win: number, bet: number): WinTierId {
    return getWinTier(win, bet)
  }

  /**
   * Joue la séquence complète. Résout quand la bannière peut disparaître :
   * immédiatement après le compteur pour les petits gains, après `holdMs` (ou
   * un skip du joueur) pour les gros.
   */
  play(win: number, bet: number, label?: string): Promise<void> {
    return this.playTier(getWinTier(win, bet), win, label)
  }

  /** Variante à palier forcé — utilisée par la page de test des animations. */
  playTier(tier: WinTierId, amount: number, label?: string): Promise<void> {
    this.stop()

    const fx = TIER_FX[tier]
    const reduced = prefersReducedMotion()
    const root = this.#targets.root

    root.style.setProperty('--wfx-color', fx.color)
    this.#layer.dataset.tier = tier

    this.#applyBanner(tier, amount, label, reduced ? 0 : fx.countMs * speedFactor())

    if (!reduced) {
      if (fx.flash) this.#playFlash(fx.flash)
      if (fx.rays)  this.#toggle(this.#rays, 'active')
      if (fx.sigil) this.#pulse(this.#sigil, 'burst', 900)
      if (fx.embers) this.#spawnEmbers(fx.embers, fx.color)
      if (fx.rain) this.#spawnRain(tierRank(tier) >= 5 ? 26 : 16)
      if (fx.shake !== 'none') this.#shake(SHAKE_CLASS[fx.shake])
    }

    const speed = speedFactor()
    const hold = reduced ? 0 : fx.holdMs * speed
    const total = (reduced ? 0 : fx.countMs * speed) + hold

    return new Promise<void>(resolve => {
      this.#resolve = resolve
      if (hold > 0) this.#armSkip()
      this.#after(total, () => this.#finish())
    })
  }

  /** Interrompt la séquence en cours et résout sa promesse. */
  skip() { this.#finish() }

  /** Nettoie tout : timers, classes, particules, écouteurs de skip. */
  stop() {
    this.#clearTimers()
    this.#disarmSkip()
    this.#parts.textContent = ''
    this.#rays.classList.remove('active')
    this.#sigil.classList.remove('burst')
    this.#flash.style.removeProperty('--wfx-flash-opacity')
    this.#flash.classList.remove('active')
    this.#countEnd = null
    for (const cls of Object.values(SHAKE_CLASS)) {
      if (cls) this.#targets.root.classList.remove(cls)
    }
    this.#targets.banner?.removeAttribute('data-tier')
    this.#resolve = null
  }

  /** Retire les calques du DOM. */
  destroy() {
    this.stop()
    this.#layer.remove()
  }

  // ── interne ──────────────────────────────────────────────

  #applyBanner(tier: WinTierId, amount: number, label: string | undefined, countMs: number) {
    const { overlay, banner, label: labelEl, amount: amountEl } = this.#targets
    overlay?.classList.remove('hidden')
    if (banner) {
      banner.dataset.tier = tier
      // Relance l'animation d'entrée même si la bannière était déjà visible.
      banner.classList.remove('wfx-enter')
      void banner.offsetWidth
      banner.classList.add('wfx-enter')
    }
    if (labelEl) labelEl.textContent = label ?? getTierDef(tier).label
    if (amountEl) this.#countUp(amountEl, amount, countMs)
  }

  #countUp(el: HTMLElement, target: number, durationMs: number) {
    const fmt = (v: number) => `+⛧${v.toFixed(2)}`
    this.#countEnd = () => { el.textContent = fmt(target) }
    if (durationMs <= 0) { this.#countEnd(); return }

    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      // Ease-out cubique : le compteur ralentit en approchant du total.
      const eased = 1 - Math.pow(1 - t, 3)
      el.textContent = fmt(target * eased)
      if (t < 1) this.#frame = requestAnimationFrame(step)
      else el.textContent = fmt(target)
    }
    this.#frame = requestAnimationFrame(step)
  }

  #playFlash(opacity: number) {
    this.#flash.style.setProperty('--wfx-flash-opacity', String(opacity))
    this.#pulse(this.#flash, 'active', 620)
  }

  #shake(cls: string) {
    const root = this.#targets.root
    root.classList.remove(cls)
    void root.offsetWidth
    root.classList.add(cls)
    this.#after(900, () => root.classList.remove(cls))
  }

  #spawnEmbers(count: number, color: string) {
    const frag = document.createDocumentFragment()
    for (let i = 0; i < count; i++) {
      const p = document.createElement('span')
      p.className = 'wfx-ember'
      // Éventail centré vers le haut, avec assez de dispersion pour ne pas
      // lire comme une grille.
      const angle = (-90 + (Math.random() - .5) * 150) * Math.PI / 180
      const dist  = 90 + Math.random() * 260
      p.style.setProperty('--dx', `${Math.cos(angle) * dist}px`)
      p.style.setProperty('--dy', `${Math.sin(angle) * dist}px`)
      p.style.setProperty('--rot', `${(Math.random() - .5) * 540}deg`)
      p.style.setProperty('--size', `${3 + Math.random() * 6}px`)
      p.style.setProperty('--delay', `${Math.random() * 240}ms`)
      p.style.setProperty('--dur', `${700 + Math.random() * 900}ms`)
      p.style.background = color
      frag.appendChild(p)
    }
    this.#parts.appendChild(frag)
  }

  #spawnRain(count: number) {
    const frag = document.createDocumentFragment()
    for (let i = 0; i < count; i++) {
      const s = document.createElement('span')
      s.className = 'wfx-rain'
      s.textContent = '⛧'
      s.style.setProperty('--x', `${Math.random() * 100}%`)
      s.style.setProperty('--delay', `${Math.random() * 900}ms`)
      s.style.setProperty('--dur', `${1100 + Math.random() * 900}ms`)
      s.style.setProperty('--scale', `${.6 + Math.random() * 1.1}`)
      frag.appendChild(s)
    }
    this.#parts.appendChild(frag)
  }

  #toggle(el: HTMLElement, cls: string) { el.classList.add(cls) }

  #pulse(el: HTMLElement, cls: string, ms: number) {
    el.classList.remove(cls)
    void el.offsetWidth
    el.classList.add(cls)
    this.#after(ms, () => el.classList.remove(cls))
  }

  #armSkip() {
    this.#onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') {
        e.preventDefault()
        this.#finish()
      }
    }
    this.#onClick = () => this.#finish()
    window.addEventListener('keydown', this.#onKey)
    window.addEventListener('pointerdown', this.#onClick)
  }

  #disarmSkip() {
    if (this.#onKey) window.removeEventListener('keydown', this.#onKey)
    if (this.#onClick) window.removeEventListener('pointerdown', this.#onClick)
    this.#onKey = null
    this.#onClick = null
  }

  #after(ms: number, fn: () => void) {
    this.#timers.push(window.setTimeout(fn, ms))
  }

  #clearTimers() {
    for (const t of this.#timers) clearTimeout(t)
    this.#timers = []
    if (this.#frame) cancelAnimationFrame(this.#frame)
    this.#frame = 0
  }

  #finish() {
    const resolve = this.#resolve
    this.#resolve = null
    this.#clearTimers()
    this.#disarmSkip()
    // Le montant final doit rester lisible même si le joueur a coupé court.
    this.#countEnd?.()
    this.#countEnd = null
    resolve?.()
  }
}
