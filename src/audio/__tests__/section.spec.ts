import { describe, it, expect } from 'vitest'
import { MODES, degreeToMidi, type Mode } from '@/audio/theory/modes'
import { DANCES, BAR_EIGHTHS, PHRASE_BARS } from '@/audio/theory/rhythms'
import { generateSection, type Section } from '@/audio/generators/section'
import { seededRandom } from '@/lib/random'

function forAll(fn: (mode: Mode, section: Section) => void) {
  for (const mode of Object.values(MODES)) {
    for (const dance of Object.values(DANCES)) {
      for (let seed = 1; seed <= 20; seed++) {
        const section = generateSection(mode, dance, seededRandom(seed))
        fn(mode, section)
      }
    }
  }
}

describe('generateSection', () => {
  it('every melody and organum note midi belongs to the mode', () => {
    forAll((mode, section) => {
      for (const phrase of section.phrases) {
        for (const note of phrase.melody) {
          const semitone = ((note.midi - mode.final) % 12 + 12) % 12
          expect(mode.steps.includes(semitone)).toBe(true)
        }
        for (const note of phrase.organum) {
          const semitone = ((note.midi - mode.final) % 12 + 12) % 12
          expect(mode.steps.includes(semitone)).toBe(true)
        }
      }
    })
  })

  it('every phrase ends on the final with a step before it', () => {
    forAll((mode, section) => {
      for (const phrase of section.phrases) {
        const melody = phrase.melody
        expect(melody[melody.length - 1]!.midi).toBe(mode.final)
        const secondToLast = melody[melody.length - 2]!.midi
        expect([degreeToMidi(mode, 1), degreeToMidi(mode, -1)]).toContain(secondToLast)
      }
    })
  })

  it('recorder phrases have matching organum; lute phrases have empty organum', () => {
    forAll((_mode, section) => {
      for (const phrase of section.phrases) {
        if (phrase.lead === 'recorder') {
          expect(phrase.organum.length).toBe(phrase.melody.length)
          expect(phrase.organum[phrase.organum.length - 1]!.midi).toBe(phrase.melody[phrase.melody.length - 1]!.midi)
        } else {
          expect(phrase.organum).toEqual([])
        }
      }
    })
  })

  it('melody notes are contiguous with first time 0 and total duration of 4 bars', () => {
    forAll((_mode, section) => {
      for (const phrase of section.phrases) {
        const melody = phrase.melody
        expect(melody[0]!.time).toBe(0)
        for (let i = 1; i < melody.length; i++) {
          expect(melody[i]!.time).toBe(melody[i - 1]!.time + melody[i - 1]!.duration)
        }
        const total = melody.reduce((sum, note) => sum + note.duration, 0)
        expect(total).toBe(PHRASE_BARS * BAR_EIGHTHS)
      }
    })
  })

  it('every melody midi is within the mode range', () => {
    forAll((mode, section) => {
      const low = degreeToMidi(mode, -1)
      const high = degreeToMidi(mode, 7)
      for (const phrase of section.phrases) {
        for (const note of phrase.melody) {
          expect(note.midi).toBeGreaterThanOrEqual(low)
          expect(note.midi).toBeLessThanOrEqual(high)
        }
      }
    })
  })

  it('same seed gives the same output; different seeds give different output', () => {
    const a = generateSection(MODES.dorian, DANCES.estampie, seededRandom(42))
    const b = generateSection(MODES.dorian, DANCES.estampie, seededRandom(42))
    expect(a).toEqual(b)

    const c = generateSection(MODES.dorian, DANCES.estampie, seededRandom(1))
    const d = generateSection(MODES.dorian, DANCES.estampie, seededRandom(2))
    expect(c).not.toEqual(d)
  })
})
