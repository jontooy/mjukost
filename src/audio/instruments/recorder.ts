import * as Tone from 'tone'

export function createRecorder(output: Tone.ToneAudioNode) {
  const vibrato = new Tone.Vibrato({ frequency: 5, depth: 0 }).connect(output)
  const synth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.06, decay: 0.1, sustain: 0.85, release: 0.25 },
  }).connect(vibrato)
  synth.volume.value = -10
  return {
    play(midi: number, duration: string, time: number) {
      synth.triggerAttackRelease(Tone.Frequency(midi, 'midi').toFrequency(), duration, time)
      vibrato.depth.cancelScheduledValues(time)
      vibrato.depth.setValueAtTime(0, time)
      vibrato.depth.linearRampToValueAtTime(0.08, time + 0.3)
    },
    release(time: number) {
      synth.triggerRelease(time)
    },
    dispose() {
      synth.dispose()
      vibrato.dispose()
    },
  }
}
