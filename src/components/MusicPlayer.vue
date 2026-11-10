<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue'
import { useMedievalMusic } from '@/composables/useMedievalMusic'

const music = useMedievalMusic()
const icon = computed(() => (music.isPlaying.value ? '<|))' : '<|x'))

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
    <span aria-hidden="true">{{ icon }}</span>
  </button>
</template>
