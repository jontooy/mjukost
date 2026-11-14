import { computed, ref, watch } from 'vue'
import * as Tone from 'tone'
import { MedievalEngine, type EngineSettings } from '@/audio/engine'
import type { WorldName } from '@/world/engine'

const STORAGE_KEY = 'mjukost-music-level'
export const MAX_LEVEL = 5
const DEFAULT_LEVEL = 3
const GAIN_PER_LEVEL = 0.15
// The dungeon has no music: only silence down there.
const WORLD_PRESETS: Record<WorldName, (Omit<EngineSettings, 'seed'> & { reverbWet: number }) | null> = {
  forest: { mode: 'dorian', danceForm: 'estampie', tempo: 132, reverbWet: 0.25 },
  castle: { mode: 'phrygian', danceForm: 'slowAir', tempo: 72, reverbWet: 0.5 },
  dungeon: null,
  colosseum: { mode: 'mixolydian', danceForm: 'saltarello', tempo: 120, reverbWet: 0.4 },
}

// Off unless the visitor turned it up before; the level survives a refresh.
const level = ref(Math.min(MAX_LEVEL, Math.max(0, Number(localStorage.getItem(STORAGE_KEY)) || 0)))
const isPlaying = computed(() => level.value > 0)
let lastLevel = level.value || DEFAULT_LEVEL // what "on" restores after a mute
watch(level, (n) => {
  localStorage.setItem(STORAGE_KEY, String(n))
  if (n > 0) lastLevel = n
})

const gain = (n: number) => n * GAIN_PER_LEVEL

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
  const pending = (creating ??= MedievalEngine.create(gain(level.value), reverbWet))
  const created = await pending
  if (creating !== pending) return created.dispose() // disposed while loading
  engine = created
  engine.setVolume(gain(level.value)) // the level may have changed while it loaded
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
  function setLevel(n: number) {
    const next = Math.min(MAX_LEVEL, Math.max(0, n))
    if (next === level.value) return
    const wasPlaying = isPlaying.value
    level.value = next
    if (next === 0) return engine?.stop()
    engine?.setVolume(gain(next))
    if (!wasPlaying) void startEngine()
  }

  const play = () => setLevel(level.value || lastLevel)
  const stop = () => setLevel(0)
  const toggle = () => setLevel(level.value ? 0 : lastLevel)

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

  // Tears down the audio but keeps the visitor's volume level.
  function dispose() {
    engine?.dispose()
    engine = null
    creating = null
    resumeOnGesture()
  }

  return { level, isPlaying, setLevel, play, stop, toggle, applyWorldPreset, dispose }
}
