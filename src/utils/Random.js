export function weightedRandom(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0)
  let rand = Math.random() * total
  for (const item of items) {
    rand -= item.weight
    if (rand <= 0) return item.value
  }
  return items[items.length - 1].value
}

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function shuffleArray(arr) {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
