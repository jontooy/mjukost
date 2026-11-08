import { ref, watch } from 'vue'
import * as Tone from 'tone'
import { MedievalEngine, type EngineSettings } from '@/audio/engine'
import type { WorldName } from '@/world/engine'

const STORAGE_KEY = 'mjukost-music'
const VOLUME = 0.5
// The dungeon has no music: only silence down there.
const WORLD_PRESETS: Record<WorldName, (Omit<EngineSettings, 'seed'> & { reverbWet: number }) | null> = {
  forest: { mode: 'dorian', danceForm: 'estampie', tempo: 132, reverbWet: 0.25 },
  castle: { mode: 'phrygian', danceForm: 'slowAir', tempo: 72, reverbWet: 0.5 },
  dungeon: null,
}

// Off unless the visitor turned it on before; the choice survives a refresh.
const isPlaying = ref(localStorage.getItem(STORAGE_KEY) === 'on')
watch(isPlaying, (on) => localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off'))

const settings: EngineSettings = {
  mode: 'dorian',
  danceForm: 'estampie',
  tempo: 132,
  seed: Math.floor(Math.random() * 4294967296),
}

let reverbWet = WORLD_PRESETS.forest!.reverbWet
let silent = false // no music where the world has no preset; the on/off choice is kept
let engine: MedievalEngine | null = null
let creating: Promise<MedievalEngine> | null = null

async function startEngine() {
  await Tone.start() // first await, so it runs inside the user gesture
  const pending = (creating ??= MedievalEngine.create(VOLUME, reverbWet))
  const created = await pending
  if (creating !== pending) return created.dispose() // disposed while loading
  engine = created
  if (isPlaying.value && !silent) engine.start(settings)
}

// Browsers block audio until the visitor interacts, so music saved as on starts at the first gesture.
function resumeOnGesture() {
  if (!isPlaying.value) return
  const resume = () => {
    window.removeEventListener('pointerdown', resume, true)
    window.removeEventListener('keydown', resume, true)
    if (isPlaying.value) void startEngine()
  }
  window.addEventListener('pointerdown', resume, true)
  window.addEventListener('keydown', resume, true)
}

resumeOnGesture()

export function useMedievalMusic() {
  function play() {
    if (isPlaying.value) return
    isPlaying.value = true
    void startEngine()
  }

  function stop() {
    isPlaying.value = false
    engine?.stop()
  }

  function toggle() {
    if (isPlaying.value) stop()
    else play()
  }

  function applyWorldPreset(world: WorldName) {
    const preset = WORLD_PRESETS[world]
    silent = preset === null
    if (!preset) return engine?.stop()
    settings.mode = preset.mode
    settings.danceForm = preset.danceForm
    settings.tempo = preset.tempo
    reverbWet = preset.reverbWet
    engine?.setReverbWet(reverbWet)
    if (isPlaying.value) engine?.restart(settings)
  }

  // Tears down the audio but keeps the visitor's on/off choice.
  function dispose() {
    engine?.dispose()
    engine = null
    creating = null
    resumeOnGesture()
  }

  return { isPlaying, play, stop, toggle, applyWorldPreset, dispose }
}
