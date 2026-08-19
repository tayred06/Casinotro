import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Monte le vrai index.html dans jsdom.
 *
 * Les modules de src/ui vont chercher leurs éléments par id au moment de la
 * construction : les tester contre un DOM inventé ne prouverait rien. En
 * chargeant le fichier réellement livré, un id renommé dans le HTML casse
 * ici plutôt qu'en production.
 */
export function mountIndexHtml(): void {
  // innerHTML est sûr ici : la source est index.html du dépôt, lu sur disque,
  // et ce module ne sert qu'aux tests — il n'est jamais inclus dans le bundle.
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf-8')
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? ''
  // Le <script type="module"> n'a pas à s'exécuter ici.
  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/gi, '')
  localStorage.clear()
}

/** Texte des chips de mise actuellement affichées. */
export function betChipLabels(): string[] {
  return [...document.querySelectorAll('#bet-chips .chip')].map(el => el.textContent ?? '')
}

/** Noms des bonus actifs listés dans la boutique. */
export function bonusTagLabels(): string[] {
  return [...document.querySelectorAll('#bonuses-list .bonus-tag')].map(el => el.textContent ?? '')
}

/** Contenu de la colonne d'offres de la boutique. */
export function shopItemLabels(): string[] {
  return [...document.querySelectorAll('#shop-items .shop-item')].map(el => el.textContent ?? '')
}
