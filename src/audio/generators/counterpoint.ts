import { degreeToMidi, type Mode } from '@/audio/theory/modes'

// Parallel 4ths below the melody, a 5th where the 4th would be a tritone, unison at the cadence.
export function organumDegrees(mode: Mode, melody: readonly number[]): number[] {
  const last = melody.length - 1
  return melody.map((degree, i) => {
    if (i === last) return degree
    if (i === last - 1) return degree - 2
    const fourth = degree - 3
    return degreeToMidi(mode, degree) - degreeToMidi(mode, fourth) === 6 ? degree - 4 : fourth
  })
}
