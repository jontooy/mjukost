import * as Tone from 'tone'

// Open fifth an octave below the final.
export function createDrone(output: Tone.ToneAudioNode) {
  const tremolo = new Tone.Tremolo({ frequency: 0.3, depth: 0.25 }).connect(output).start()
  const filter = new Tone.Filter({ frequency: 1000, type: 'lowpass', rolloff: -24 }).connect(tremolo)
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 1.5, decay: 0, sustain: 1, release: 2 },
  }).connect(filter)
  synth.volume.value = -20
  let soundingFinal: number | null = null
  return {
    sound(final: number, time: number) {
      if (final === soundingFinal) return
      if (soundingFinal !== null) synth.releaseAll(time)
      synth.triggerAttack(
        [Tone.Frequency(final - 12, 'midi').toFrequency(), Tone.Frequency(final - 5, 'midi').toFrequency()],
        time,
      )
      soundingFinal = final
    },
    silence(time: number) {
      synth.releaseAll(time)
      soundingFinal = null
    },
    dispose() {
      synth.dispose()
      filter.dispose()
      tremolo.dispose()
    },
  }
}
