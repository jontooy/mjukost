import { PHRASE_BARS, type DanceRhythm } from '@/audio/theory/rhythms'

export const TOP_DEGREE = 7

export function phraseRhythm(dance: DanceRhythm, random: () => number): number[] {
  const durations: number[] = []
  for (let bar = 0; bar < PHRASE_BARS - 1; bar++) {
    const cell = dance.cells[Math.floor(random() * dance.cells.length)]!
    durations.push(...cell)
  }
  durations.push(...dance.cadenceCell)
  return durations
}

export function generateMelody(noteCount: number, start: number, random: () => number): number[] {
  const degrees = [start]
  let previousMove = 0
  for (let i = 1; i <= noteCount - 3; i++) {
    const cur = degrees[i - 1]!
    let move: number
    if (Math.abs(previousMove) >= 3) {
      move = -Math.sign(previousMove)
    } else {
      const r = random()
      const size = r < 0.6 ? 1 : r < 0.85 ? 2 : r < 0.95 ? (random() < 0.5 ? 3 : 4) : 0
      move = random() < 0.5 ? size : -size
    }
    let next = cur + move
    if (next < 0 || next > TOP_DEGREE) next = cur - move
    next = Math.min(Math.max(next, 0), TOP_DEGREE)
    degrees.push(next)
    previousMove = next - cur
  }
  const last = degrees[degrees.length - 1]!
  degrees.push(last >= 1 ? 1 : -1, 0)
  return degrees
}

export function varyMelody(degrees: readonly number[], random: () => number): number[] {
  const copy = [...degrees]
  if (copy.length < 4) return copy
  const index = 1 + Math.floor(random() * (copy.length - 3))
  const delta = random() < 0.5 ? 1 : -1
  const value = copy[index]! + delta
  copy[index] = value < 0 || value > TOP_DEGREE ? copy[index]! - delta : value
  return copy
}
