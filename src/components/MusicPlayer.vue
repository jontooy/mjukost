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
    class="flex min-h-11 min-w-11 cursor-pointer items-center justify-center border border-[#c79f5e] bg-black font-mono text-[14px] text-[#ffd479]"
    :aria-label="music.isPlaying.value ? 'Mute music' : 'Play music'"
    :title="music.isPlaying.value ? 'Mute music' : 'Play music'"
    @mousedown.prevent
    @click="music.toggle()"
  >
    <span aria-hidden="true">{{ icon }}</span>
  </button>
</template>
