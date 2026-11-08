import { ref, reactive, watch } from 'vue'
import * as Tone from 'tone'
import { MedievalEngine, type EngineSettings } from '@/audio/engine'
import type { ModeName } from '@/audio/theory/modes'
import type { DanceForm } from '@/audio/theory/rhythms'
import type { WorldName } from '@/world/engine'

export interface MusicSettings {
  mode: ModeName
  danceForm: DanceForm
  tempo: number
  volume: number
  seed: number
}

const WORLD_PRESETS: Record<WorldName, { mode: ModeName; danceForm: DanceForm; tempo: number; reverbWet: number }> = {
  forest: { mode: 'dorian', danceForm: 'estampie', tempo: 132, reverbWet: 0.25 },
  castle: { mode: 'phrygian', danceForm: 'slowAir', tempo: 72, reverbWet: 0.5 },
}

const newSeed = () => Math.floor(Math.random() * 4294967296)

const isPlaying = ref(false)
const settings = reactive<MusicSettings>({
  mode: 'dorian',
  danceForm: 'estampie',
  tempo: 132,
  volume: 0.5,
  seed: newSeed(),
})

let reverbWet = WORLD_PRESETS.forest.reverbWet
let engine: MedievalEngine | null = null
let creating: Promise<MedievalEngine> | null = null

const engineSettings = (): EngineSettings => ({
  mode: settings.mode,
  danceForm: settings.danceForm,
  tempo: settings.tempo,
  seed: settings.seed,
})

watch(
  () => [settings.mode, settings.danceForm, settings.tempo, settings.seed],
  () => engine?.update(engineSettings()),
)
watch(() => settings.volume, (volume) => engine?.setVolume(volume))

export function useMedievalMusic() {
  async function play() {
    if (isPlaying.value) return
    isPlaying.value = true
    await Tone.start() // first await, so it runs inside the click gesture
    const pending = (creating ??= MedievalEngine.create(settings.volume, reverbWet))
    const created = await pending
    if (creating !== pending) return created.dispose() // disposed while loading
    engine = created
    if (isPlaying.value) engine.start(engineSettings())
  }

  function stop() {
    isPlaying.value = false
    engine?.stop()
  }

  function toggle() {
    if (isPlaying.value) stop()
    else void play()
  }

  function regenerate() {
    settings.seed = newSeed()
  }

  function applyWorldPreset(world: WorldName) {
    const preset = WORLD_PRESETS[world]
    settings.mode = preset.mode
    settings.danceForm = preset.danceForm
    settings.tempo = preset.tempo
    reverbWet = preset.reverbWet
    engine?.setReverbWet(reverbWet)
  }

  function dispose() {
    stop()
    engine?.dispose()
    engine = null
    creating = null
  }

  return { isPlaying, settings, play, stop, toggle, regenerate, applyWorldPreset, dispose }
}
