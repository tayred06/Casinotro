// ─── RNG ──────────────────────────────────────────────────
// Un seul point d'entrée aléatoire pour tout le jeu, remplaçable par une
// séquence déterministe. Sans ça, ni test reproductible ni simulation RTP.

export type Rng = () => number

/** mulberry32 — petit, rapide, distribution correcte pour du gameplay. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6D2B79F5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let current: Rng = Math.random

/** Fixe une graine — la séquence devient reproductible. */
export function seedRng(seed: number): void { current = createRng(seed) }

/** Injecte un RNG arbitraire, ou `null` pour revenir à Math.random. */
export function setRng(rng: Rng | null): void { current = rng ?? Math.random }

/** Source aléatoire du jeu. Ne jamais appeler Math.random() ailleurs. */
export function random(): number { return current() }

// ─── Helpers ──────────────────────────────────────────────

export function weightedRandom<T>(items: { value: T; weight: number }[]): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0)
  let rand = random() * total
  for (const item of items) {
    rand -= item.weight
    if (rand <= 0) return item.value
  }
  return items[items.length - 1].value
}

export function randomInt(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min
}

export function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
