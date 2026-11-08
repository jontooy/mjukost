<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { useMedievalMusic } from '@/composables/useMedievalMusic'

const music = useMedievalMusic()

onBeforeUnmount(() => music.dispose())
</script>

<!-- mousedown.prevent keeps focus off the button, so Space and WASD still reach the world. -->
<template>
  <button
    type="button"
    class="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-[0.35rem] border border-white/40 bg-black/40 text-white"
    :aria-label="music.isPlaying.value ? 'Mute music' : 'Play music'"
    :title="music.isPlaying.value ? 'Mute music' : 'Play music'"
    @mousedown.prevent
    @click="music.toggle()"
  >
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M11 5 6 9H2v6h4l5 4V5z" fill="currentColor" />
      <template v-if="music.isPlaying.value">
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        <path d="M19 5a10 10 0 0 1 0 14" />
      </template>
      <template v-else>
        <path d="m16 9 6 6" />
        <path d="m22 9-6 6" />
      </template>
    </svg>
  </button>
</template>
