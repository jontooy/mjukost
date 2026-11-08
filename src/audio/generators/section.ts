import { degreeToMidi, type Mode } from '@/audio/theory/modes'
import { BAR_EIGHTHS, PHRASE_BARS, type DanceRhythm, type DrumHit } from '@/audio/theory/rhythms'
import { generateMelody, phraseRhythm, varyMelody } from '@/audio/generators/melody'
import { organumDegrees } from '@/audio/generators/counterpoint'

export interface PhraseNote {
  time: number
  duration: number
  midi: number
} // eighths from phrase start

export interface DrumEvent {
  time: number
  kind: DrumHit['kind']
  accent: boolean
}

export interface Phrase {
  lead: 'recorder' | 'lute'
  melody: PhraseNote[]
  organum: PhraseNote[]
  drums: DrumEvent[]
}

export interface Section {
  form: 'AABB' | 'ABAB'
  phrases: Phrase[]
}

export function generateSection(mode: Mode, dance: DanceRhythm, random: () => number): Section {
  const form: Section['form'] = random() < 0.5 ? 'AABB' : 'ABAB'

  const rhythmA = phraseRhythm(dance, random)
  const rhythmB = phraseRhythm(dance, random)

  const a = generateMelody(rhythmA.length, 0, random)
  const b = generateMelody(rhythmB.length, mode.reciting, random)

  const a2 = varyMelody(a, random)
  const b2 = varyMelody(b, random)

  const pattern = dance.drumPatterns[Math.floor(random() * dance.drumPatterns.length)]!

  const drums: DrumEvent[] = []
  for (let bar = 0; bar < PHRASE_BARS; bar++) {
    for (const hit of pattern) {
      drums.push({ time: bar * BAR_EIGHTHS + hit.at, kind: hit.kind, accent: hit.accent })
    }
  }

  function notes(rhythm: readonly number[], degrees: readonly number[]): PhraseNote[] {
    const result: PhraseNote[] = []
    let time = 0
    for (let i = 0; i < rhythm.length; i++) {
      result.push({ time, duration: rhythm[i]!, midi: degreeToMidi(mode, degrees[i]!) })
      time += rhythm[i]!
    }
    return result
  }

  const makeA = (d: readonly number[]): Phrase => ({
    lead: 'recorder',
    melody: notes(rhythmA, d),
    organum: notes(rhythmA, organumDegrees(mode, d)),
    drums,
  })

  const makeB = (d: readonly number[]): Phrase => ({
    lead: 'lute',
    melody: notes(rhythmB, d),
    organum: [],
    drums,
  })

  const phrases =
    form === 'AABB'
      ? [makeA(a), makeA(a2), makeB(b), makeB(b2)]
      : [makeA(a), makeB(b), makeA(a2), makeB(b2)]

  return { form, phrases }
}
