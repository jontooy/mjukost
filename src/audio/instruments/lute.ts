import * as Tone from 'tone'

export function createLute(output: Tone.ToneAudioNode) {
  const synth = new Tone.PluckSynth({ attackNoise: 1, dampening: 3000, resonance: 0.92, release: 1 }).connect(output)
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
