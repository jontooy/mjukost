import * as Tone from 'tone'
import { MODES, type ModeName } from '@/audio/theory/modes'
import { DANCES, BAR_EIGHTHS, PHRASE_BARS, type DanceForm } from '@/audio/theory/rhythms'
import { generateSection, type Section } from '@/audio/generators/section'
import { createLute } from '@/audio/instruments/lute'
import { createRecorder } from '@/audio/instruments/recorder'
import { createDrone } from '@/audio/instruments/drone'
import { createDrum } from '@/audio/instruments/drum'
import { seededRandom } from '@/lib/random'

export interface EngineSettings {
  mode: ModeName
  danceForm: DanceForm
  tempo: number
  seed: number
}

const EIGHTH_TICKS = 96 // Tone's default PPQ is 192 per quarter note

export class MedievalEngine {
  private running = false
  private disposed = false
  private pending: EngineSettings | null = null
  private current!: EngineSettings
  private random = seededRandom(0)
  private section: Section | null = null
  private phraseIndex = 0

  private constructor(
    private readonly master: Tone.Gain,
    private readonly reverb: Tone.Reverb,
    private readonly lute: ReturnType<typeof createLute>,
    private readonly recorder: ReturnType<typeof createRecorder>,
    private readonly drone: ReturnType<typeof createDrone>,
    private readonly drum: ReturnType<typeof createDrum>,
  ) {}

  static async create(volume: number, reverbWet: number): Promise<MedievalEngine> {
    const master = new Tone.Gain(volume).toDestination()
    const reverb = new Tone.Reverb({ decay: 4, preDelay: 0.02, wet: reverbWet }).connect(master)
    await reverb.ready
    return new MedievalEngine(master, reverb, createLute(reverb), createRecorder(reverb), createDrone(reverb), createDrum(reverb))
  }

  start(settings: EngineSettings): void {
    if (this.running) return
    this.running = true
    const transport = Tone.getTransport()
    transport.cancel(0)
    transport.position = 0
    this.random = seededRandom(settings.seed)
    this.current = { ...settings }
    this.section = null
    this.phraseIndex = 0
    transport.bpm.value = settings.tempo
    this.drone.sound(MODES[settings.mode].final, Tone.now())
    this.schedulePhrase(0)
    transport.start()
  }

  stop(): void {
    if (!this.running) return
    this.running = false
    this.pending = null
    const transport = Tone.getTransport()
    transport.stop()
    transport.cancel(0)
    transport.position = 0
    const now = Tone.now()
    this.recorder.release(now)
    this.drone.silence(now)
  }

  update(settings: EngineSettings): void {
    if (this.running) this.pending = { ...settings }
  }

  setVolume(volume: number): void {
    this.master.gain.rampTo(volume, 0.05)
  }

  setReverbWet(wet: number): void {
    this.reverb.wet.rampTo(wet, 1)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.stop()
    this.lute.dispose()
    this.recorder.dispose()
    this.drone.dispose()
    this.drum.dispose()
    this.reverb.dispose()
    this.master.dispose()
  }

  private schedulePhrase(startTick: number): void {
    const transport = Tone.getTransport()
    if (!this.section || this.phraseIndex === this.section.phrases.length) {
      this.section = generateSection(MODES[this.current.mode], DANCES[this.current.danceForm], this.random)
      this.phraseIndex = 0
    }
    const phrase = this.section.phrases[this.phraseIndex++]!
    const lead = phrase.lead === 'recorder' ? this.recorder : this.lute
    for (const note of phrase.melody) {
      transport.scheduleOnce(
        (time) => lead.play(note.midi, `${note.duration * EIGHTH_TICKS}i`, time),
        `${startTick + note.time * EIGHTH_TICKS}i`,
      )
    }
    for (const note of phrase.organum) {
      transport.scheduleOnce(
        (time) => this.lute.play(note.midi, `${note.duration * EIGHTH_TICKS}i`, time),
        `${startTick + note.time * EIGHTH_TICKS}i`,
      )
    }
    for (const hit of phrase.drums) {
      transport.scheduleOnce(
        (time) => this.drum.hit(hit.kind, time, hit.accent),
        `${startTick + hit.time * EIGHTH_TICKS}i`,
      )
    }
    const endTick = startTick + PHRASE_BARS * BAR_EIGHTHS * EIGHTH_TICKS
    transport.scheduleOnce((time) => {
      if (this.pending) {
        const pending = this.pending
        const boundary = time + Tone.Ticks(EIGHTH_TICKS).toSeconds()
        const changed =
          pending.mode !== this.current.mode ||
          pending.danceForm !== this.current.danceForm ||
          pending.seed !== this.current.seed
        if (pending.seed !== this.current.seed) this.random = seededRandom(pending.seed)
        if (changed) this.section = null
        transport.bpm.setValueAtTime(pending.tempo, boundary)
        this.drone.sound(MODES[pending.mode].final, boundary)
        this.current = pending
        this.pending = null
      }
      this.schedulePhrase(endTick)
    }, `${endTick - EIGHTH_TICKS}i`)
  }
}
