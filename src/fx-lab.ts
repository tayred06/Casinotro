/**
 * Labo d'animations — page autonome (`/fx.html`) pour régler les effets de gain
 * sans avoir à jouer une run. Ne fait partie d'aucun chemin du jeu.
 */
import './styles/main.scss'
import './styles/fx-lab.scss'
import { WinFX, TIER_FX } from './ui/WinFX.ts'
import { WINFX_THEMES, loadThemeId, saveThemeId, type WinFXThemeId } from './ui/winfx-themes.ts'
import { WIN_TIERS, getWinTier, getTierDef, type WinTierId } from './game/WinTier.ts'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

const stage    = $('machine-area')
const overlay  = $('win-overlay')
const status   = $('fx-status')
const readout  = $('fx-readout')
const winInput = $<HTMLInputElement>('fx-win')
const betInput = $<HTMLInputElement>('fx-bet')
const loopChk  = $<HTMLInputElement>('fx-loop')
const slowChk  = $<HTMLInputElement>('fx-slow')

// ── Décor : une grille figée derrière les effets ───────────
const FAKE = [
  ['A', 'K', '♠', 'Q', '7', '♦'],
  ['7', '7', '7', '7', '7', 'K'],
  ['♥', 'J', '10', '♣', 'W', '♠'],
  ['Q', '♦', 'A', '⛧', 'J', '♥'],
]
const CLS: Record<string, string> = {
  '7': 'cell-seven', 'W': 'cell-wild', '⛧': 'cell-scatter',
  '♠': 'cell-suit black', '♣': 'cell-suit black',
  '♥': 'cell-suit red', '♦': 'cell-suit red',
}

function buildGrid() {
  const container = $('reels-container')
  container.innerHTML = ''
  for (let col = 0; col < 6; col++) {
    const reel = document.createElement('div')
    reel.className = 'reel'
    for (let row = 0; row < FAKE.length; row++) {
      const cell = document.createElement('div')
      cell.className = 'cell'
      const inner = document.createElement('div')
      const text = FAKE[row][col]
      inner.className = CLS[text] ?? 'cell-card'
      inner.textContent = text
      cell.appendChild(inner)
      reel.appendChild(cell)
    }
    container.appendChild(reel)
  }
}

buildGrid()

let themeId: WinFXThemeId = loadThemeId()

const fx = new WinFX({
  root:    stage,
  overlay,
  banner:  overlay.querySelector('.win-banner'),
  label:   $('win-label'),
  amount:  $('win-amount'),
  detail:  $('win-detail'),
  theme:   themeId,
})

// ── Lecture ────────────────────────────────────────────────
let loopTimer: number | null = null

function applySlowMo() {
  // Le ralenti passe par une variable CSS globale plutôt que par du JS : toutes
  // les keyframes de _winfx.scss en héritent d'un coup.
  document.documentElement.style.setProperty('--wfx-speed', slowChk.checked ? '4' : '1')
}

async function playTier(tier: WinTierId, amount: number) {
  applySlowMo()
  status.textContent = `${tier} — ⛧${amount.toFixed(2)}`
  await fx.playTier(tier, amount)
  overlay.classList.add('hidden')
  fx.stop()
  status.textContent = `${tier} — terminé`
}

function currentWinBet(): [number, number] {
  return [Math.max(0, Number(winInput.value) || 0), Math.max(0.01, Number(betInput.value) || 1)]
}

function playCurrent() {
  const [win, bet] = currentWinBet()
  void playTier(getWinTier(win, bet), win)
}

function refreshReadout() {
  const [win, bet] = currentWinBet()
  const tier = getWinTier(win, bet)
  readout.textContent = `×${(win / bet).toFixed(1)} → ${tier} · « ${getTierDef(tier).label} »`
}

function stopLoop() {
  if (loopTimer !== null) { clearInterval(loopTimer); loopTimer = null }
}

// ── Contrôles ──────────────────────────────────────────────
const tiersBox = $('fx-tiers')
for (const def of [...WIN_TIERS].reverse()) {
  const btn = document.createElement('button')
  btn.className = 'fxlab-btn tier'
  btn.dataset.tier = def.id
  btn.style.setProperty('--tier-color', WINFX_THEMES[themeId].colors[def.id])
  btn.innerHTML = `<strong>${def.id}</strong><span>×${def.minRatio}+</span>`
  btn.addEventListener('click', () => {
    const bet = Math.max(0.01, Number(betInput.value) || 1)
    // Un peu au-dessus du seuil : on veut voir le palier, pas sa frontière.
    const amount = bet * Math.max(1, def.minRatio) * 1.4
    winInput.value = amount.toFixed(2)
    refreshReadout()
    void playTier(def.id, amount)
  })
  tiersBox.appendChild(btn)
}

const table = $('fx-table')
function refreshTable() {
  table.innerHTML =
  '<tr><th>palier</th><th>×mise</th><th>hold</th><th>braises</th><th>shake</th></tr>' +
  [...WIN_TIERS].reverse().map(def => {
    const f = TIER_FX[def.id]
    const theme = WINFX_THEMES[themeId]
    const parts = Math.round(f.embers * theme.particleScale)
    return `<tr><td style="color:${theme.colors[def.id]}">${def.id}</td><td>×${def.minRatio}</td>` +
           `<td>${f.holdMs} ms</td><td>${parts}</td><td>${f.shake}</td></tr>`
  }).join('')

  tiersBox.querySelectorAll<HTMLElement>('.fxlab-btn.tier').forEach(btn => {
    const id = btn.dataset.tier as WinTierId
    btn.style.setProperty('--tier-color', WINFX_THEMES[themeId].colors[id])
  })
}
refreshTable()

const themesBox = $('fx-themes')
const themeDesc = $('fx-theme-desc')

function selectTheme(id: WinFXThemeId, replay = true) {
  themeId = id
  fx.setTheme(id)
  saveThemeId(id)
  themeDesc.textContent = WINFX_THEMES[id].description
  themesBox.querySelectorAll<HTMLElement>('.fxlab-btn.theme')
    .forEach(b => b.classList.toggle('active', b.dataset.theme === id))
  refreshTable()
  // Le thème choisi est aussi celui que la vraie machine utilisera.
  if (replay) playCurrent()
}

for (const theme of Object.values(WINFX_THEMES)) {
  const btn = document.createElement('button')
  btn.className = 'fxlab-btn theme'
  btn.dataset.theme = theme.id
  btn.textContent = theme.label
  btn.addEventListener('click', () => selectTheme(theme.id))
  themesBox.appendChild(btn)
}
selectTheme(themeId, false)

$('fx-play').addEventListener('click', playCurrent)
$('fx-stop').addEventListener('click', () => {
  stopLoop()
  loopChk.checked = false
  fx.stop()
  overlay.classList.add('hidden')
  status.textContent = 'prêt'
})

loopChk.addEventListener('change', () => {
  stopLoop()
  if (loopChk.checked) {
    playCurrent()
    loopTimer = window.setInterval(playCurrent, 2500)
  }
})

slowChk.addEventListener('change', applySlowMo)
winInput.addEventListener('input', refreshReadout)
betInput.addEventListener('input', refreshReadout)

refreshReadout()
applySlowMo()
