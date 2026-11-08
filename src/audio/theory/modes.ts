export type ModeName = 'dorian' | 'mixolydian' | 'phrygian' | 'lydian'

export interface Mode {
  name: ModeName
  label: string
  final: number
  steps: readonly number[]
  reciting: number
}

export const MODES: Record<ModeName, Mode> = {
  dorian: {
    name: 'dorian',
    label: 'Dorian (D)',
    final: 62,
    steps: [0, 2, 3, 5, 7, 9, 10],
    reciting: 4,
  },
  mixolydian: {
    name: 'mixolydian',
    label: 'Mixolydian (G)',
    final: 67,
    steps: [0, 2, 4, 5, 7, 9, 10],
    reciting: 4,
  },
  phrygian: {
    name: 'phrygian',
    label: 'Phrygian (E)',
    final: 64,
    steps: [0, 1, 3, 5, 7, 8, 10],
    reciting: 5,
  },
  lydian: {
    name: 'lydian',
    label: 'Lydian (F)',
    final: 65,
    steps: [0, 2, 4, 6, 7, 9, 11],
    reciting: 4,
  },
}

export function degreeToMidi(mode: Mode, degree: number): number {
  const octave = Math.floor(degree / 7)
  const index = degree - octave * 7
  return mode.final + 12 * octave + mode.steps[index]!
}
