import * as Tone from 'tone'

// Offsets in seconds that follow the stages of CastleDoor.unlock in src/world/door.ts.
const KEY_SEATED = 1.05 // the key slides in (0.7 s) and seats (0.35 s)
const DOOR_MOVES = 1.55 // the key turns (0.5 s), the latch gives, the leaves start to swing
const SWING = 1.4

// A key click, a latch clack and a creaking hinge, timed to the castle door opening.
export async function playDoorOpening() {
  await Tone.start()
  const now = Tone.now()
  const output = new Tone.Gain(0.8).toDestination()

  const lock = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.08, release: 0.05 },
    harmonicity: 3.1,
    modulationIndex: 16,
    resonance: 3000,
    octaves: 1,
  }).connect(output)
  lock.volume.value = -22
  lock.triggerAttackRelease(400, 0.05, now + KEY_SEATED, 0.5)
  lock.triggerAttackRelease(250, 0.1, now + DOOR_MOVES, 1)

  const latch = new Tone.MembraneSynth({
    pitchDecay: 0.02,
    octaves: 2,
    envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 },
  }).connect(output)
  latch.volume.value = -12
  latch.triggerAttackRelease('A1', 0.1, now + DOOR_MOVES)

  // Stick-slip: a slow sawtooth whose pulses ring a wandering wooden resonance.
  const start = now + DOOR_MOVES
  const wood = new Tone.Filter({ type: 'bandpass', frequency: 700, Q: 6 }).connect(output)
  const swell = new Tone.AmplitudeEnvelope({ attack: 0.15, decay: 0, sustain: 1, release: 0.3 }).connect(wood)
  const hinge = new Tone.Oscillator({ type: 'sawtooth', frequency: 40 }).connect(swell)
  hinge.volume.value = -8
  hinge.frequency.setValueAtTime(40, start)
  hinge.frequency.linearRampToValueAtTime(75, start + SWING * 0.35)
  hinge.frequency.linearRampToValueAtTime(55, start + SWING * 0.65)
  hinge.frequency.linearRampToValueAtTime(30, start + SWING)
  wood.frequency.setValueAtTime(700, start)
  wood.frequency.linearRampToValueAtTime(1300, start + SWING * 0.5)
  wood.frequency.linearRampToValueAtTime(800, start + SWING)
  swell.triggerAttackRelease(SWING - 0.3, start)
  hinge.onstop = () => {
    for (const node of [lock, latch, hinge, swell, wood, output]) node.dispose()
  }
  hinge.start(start).stop(start + SWING + 0.5)
}
