<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'
import { useMedievalMusic } from '@/composables/useMedievalMusic'
import { MODES } from '@/audio/theory/modes'
import { DANCES } from '@/audio/theory/rhythms'

const music = useMedievalMusic()
const open = ref(false)
const modes = Object.values(MODES)
const dances = Object.values(DANCES)

onBeforeUnmount(() => music.dispose())
</script>

<template>
  <div class="relative" @keydown.stop>
    <button
      type="button"
      class="min-h-11 cursor-pointer rounded-[0.35rem] border border-white/40 bg-black/40 px-3 text-[0.85rem] text-white"
      :aria-expanded="open"
      @click="open = !open"
    >
      Music
    </button>
    <div
      v-if="open"
      class="absolute top-full right-0 mt-2 flex w-64 flex-col gap-2 rounded-[0.35rem] border border-white/40 bg-black/60 p-3 text-[0.85rem] text-white"
    >
      <div class="flex gap-2">
        <button
          type="button"
          class="min-h-11 cursor-pointer rounded-[0.35rem] border border-white/40 bg-black/40 px-3 text-[0.85rem] text-white"
          @click="music.toggle()"
        >
          {{ music.isPlaying.value ? 'Stop' : 'Play' }}
        </button>
        <button
          type="button"
          class="min-h-11 cursor-pointer rounded-[0.35rem] border border-white/40 bg-black/40 px-3 text-[0.85rem] text-white"
          @click="music.regenerate()"
        >
          New tune
        </button>
      </div>
      <label class="flex flex-col gap-1">
        Mode
        <select v-model="music.settings.mode" class="text-ink">
          <option v-for="m in modes" :key="m.name" :value="m.name">{{ m.label }}</option>
        </select>
      </label>
      <label class="flex flex-col gap-1">
        Dance
        <select v-model="music.settings.danceForm" class="text-ink">
          <option v-for="d in dances" :key="d.name" :value="d.name">{{ d.label }}</option>
        </select>
      </label>
      <label class="flex flex-col gap-1">
        Tempo {{ music.settings.tempo }} bpm
        <input v-model.number="music.settings.tempo" type="range" min="60" max="180" step="1" />
      </label>
      <label class="flex flex-col gap-1">
        Volume
        <input v-model.number="music.settings.volume" type="range" min="0" max="1" step="0.05" />
      </label>
    </div>
  </div>
</template>
