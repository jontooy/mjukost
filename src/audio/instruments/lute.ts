import * as Tone from 'tone'

// A plain Synth with a plucked envelope; Tone's PluckSynth needs an AudioWorklet that fails to load in Chrome.
export function createLute(output: Tone.ToneAudioNode) {
  const synth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.005, decay: 1.2, sustain: 0, release: 1 },
  }).connect(output)
  synth.volume.value = -6
  return {
    play(midi: number, duration: string, time: number) {
      synth.triggerAttackRelease(Tone.Frequency(midi, 'midi').toFrequency(), duration, time)
    },
    dispose() {
      synth.dispose()
    },
  }
}
