export type DanceForm = 'estampie' | 'saltarello' | 'slowAir'

export interface DrumHit {
  at: number
  kind: 'drum' | 'jingle'
  accent: boolean
} // at: eighth within the bar, 0..5

export interface DanceRhythm {
  name: DanceForm
  label: string
  cells: readonly (readonly number[])[] // one bar each, durations in eighths, each sums to 6
  cadenceCell: readonly number[] // last bar of every phrase, sums to 6
  drumPatterns: readonly (readonly DrumHit[])[]
}

export const BAR_EIGHTHS = 6
export const PHRASE_BARS = 4

export const DANCES: Record<DanceForm, DanceRhythm> = {
  estampie: {
    name: 'estampie',
    label: 'Estampie',
    cells: [
      [2, 2, 2],
      [2, 1, 1, 2],
      [1, 1, 2, 2],
      [3, 1, 2],
      [2, 2, 1, 1],
    ],
    cadenceCell: [2, 4],
    drumPatterns: [
      [
        { at: 0, kind: 'drum', accent: true },
        { at: 2, kind: 'drum', accent: false },
        { at: 4, kind: 'drum', accent: false },
      ],
      [
        { at: 0, kind: 'drum', accent: true },
        { at: 1, kind: 'jingle', accent: false },
        { at: 2, kind: 'drum', accent: false },
        { at: 3, kind: 'jingle', accent: false },
        { at: 4, kind: 'drum', accent: false },
        { at: 5, kind: 'jingle', accent: false },
      ],
      [
        { at: 0, kind: 'drum', accent: true },
        { at: 3, kind: 'drum', accent: false },
        { at: 4, kind: 'jingle', accent: false },
      ],
    ],
  },
  saltarello: {
    name: 'saltarello',
    label: 'Saltarello',
    cells: [
      [3, 3],
      [2, 1, 2, 1],
      [2, 1, 3],
      [1, 1, 1, 2, 1],
      [3, 2, 1],
    ],
    cadenceCell: [2, 1, 3],
    drumPatterns: [
      [
        { at: 0, kind: 'drum', accent: true },
        { at: 3, kind: 'drum', accent: false },
      ],
      [
        { at: 0, kind: 'drum', accent: true },
        { at: 2, kind: 'jingle', accent: false },
        { at: 3, kind: 'drum', accent: false },
        { at: 5, kind: 'jingle', accent: false },
      ],
      [
        { at: 0, kind: 'drum', accent: true },
        { at: 2, kind: 'drum', accent: false },
        { at: 3, kind: 'drum', accent: false },
        { at: 5, kind: 'jingle', accent: false },
      ],
    ],
  },
  slowAir: {
    name: 'slowAir',
    label: 'Slow air',
    cells: [
      [4, 2],
      [6],
      [2, 4],
      [3, 1, 2],
    ],
    cadenceCell: [6],
    drumPatterns: [
      [{ at: 0, kind: 'drum', accent: true }],
      [
        { at: 0, kind: 'drum', accent: true },
        { at: 4, kind: 'jingle', accent: false },
      ],
    ],
  },
}
