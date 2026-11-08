import { ref } from 'vue'
import * as Tone from 'tone'
import { MedievalEngine, type EngineSettings } from '@/audio/engine'
import type { WorldName } from '@/world/engine'

const VOLUME = 0.5
const WORLD_PRESETS: Record<WorldName, Omit<EngineSettings, 'seed'> & { reverbWet: number }> = {
  forest: { mode: 'dorian', danceForm: 'estampie', tempo: 132, reverbWet: 0.25 },
  castle: { mode: 'phrygian', danceForm: 'slowAir', tempo: 72, reverbWet: 0.5 },
}

const isPlaying = ref(false)
const settings: EngineSettings = {
  mode: 'dorian',
  danceForm: 'estampie',
  tempo: 132,
  seed: Math.floor(Math.random() * 4294967296),
}

let reverbWet = WORLD_PRESETS.forest.reverbWet
let engine: MedievalEngine | null = null
let creating: Promise<MedievalEngine> | null = null

export function useMedievalMusic() {
  async function play() {
    if (isPlaying.value) return
    isPlaying.value = true
    await Tone.start() // first await, so it runs inside the click gesture
    const pending = (creating ??= MedievalEngine.create(VOLUME, reverbWet))
    const created = await pending
    if (creating !== pending) return created.dispose() // disposed while loading
    engine = created
    if (isPlaying.value) engine.start(settings)
  }

  function stop() {
    isPlaying.value = false
    engine?.stop()
  }

  function toggle() {
    if (isPlaying.value) stop()
    else void play()
  }

  function applyWorldPreset(world: WorldName) {
    const preset = WORLD_PRESETS[world]
    settings.mode = preset.mode
    settings.danceForm = preset.danceForm
    settings.tempo = preset.tempo
    reverbWet = preset.reverbWet
    engine?.update(settings)
    engine?.setReverbWet(reverbWet)
  }

  function dispose() {
    stop()
    engine?.dispose()
    engine = null
    creating = null
  }

  return { isPlaying, play, stop, toggle, applyWorldPreset, dispose }
}
