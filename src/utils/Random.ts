/**
 * Source d'aléatoire injectable.
 *
 * Toutes les fonctions ci-dessous acceptent un `rng` en dernier paramètre et
 * retombent sur `Math.random`. Cela permet de rejouer une séquence de spins à
 * l'identique dans les tests (RTP, reproduction d'un bug signalé) sans changer
 * le comportement en production.
 */
export type Rng = () => number

/**
 * PRNG déterministe (mulberry32). Réservé aux tests et au débogage :
 * le jeu utilise `Math.random`.
 */
export function createRng(seed: number): Rng {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function weightedRandom<T>(items: { value: T; weight: number }[], rng: Rng = Math.random): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0)
  let rand = rng() * total
  for (const item of items) {
    rand -= item.weight
    if (rand <= 0) return item.value
  }
  return items[items.length - 1].value
}

export function randomInt(min: number, max: number, rng: Rng = Math.random): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

export function shuffleArray<T>(arr: T[], rng: Rng = Math.random): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
