import * as Tone from 'tone'

export function createDrum(output: Tone.ToneAudioNode) {
  const membrane = new Tone.MembraneSynth({
    pitchDecay: 0.03,
    octaves: 3,
    envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 },
  }).connect(output)
  membrane.volume.value = -12
  const filter = new Tone.Filter({ frequency: 7000, type: 'highpass' }).connect(output)
  const jingles = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.02 },
  }).connect(filter)
  jingles.volume.value = -24
  return {
    hit(kind: 'drum' | 'jingle', time: number, accent: boolean) {
      const velocity = accent ? 1 : 0.6
      if (kind === 'drum') membrane.triggerAttackRelease('C2', '16n', time, velocity)
      else jingles.triggerAttackRelease('32n', time, velocity)
    },
    dispose() {
      membrane.dispose()
      jingles.dispose()
      filter.dispose()
    },
  }
}
