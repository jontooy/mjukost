<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { MAX_LEVEL, useMedievalMusic } from '@/composables/useMedievalMusic'

const music = useMedievalMusic()

onBeforeUnmount(() => music.dispose())
</script>

<!-- mousedown.prevent keeps focus off the buttons, so Space and WASD still reach the world. -->
<template>
  <div
    role="group"
    aria-label="Music volume"
    class="flex min-h-11 items-center border border-[#c79f5e] bg-black font-mono text-[14px] text-[#ffd479]"
  >
    <button
      type="button"
      class="min-h-11 cursor-pointer border-0 bg-transparent px-2 font-mono text-inherit disabled:cursor-default disabled:opacity-40"
      aria-label="Volume down"
      title="Volume down"
      :disabled="music.level.value === 0"
      @mousedown.prevent
      @click="music.setLevel(music.level.value - 1)"
    >
      [ - ]
    </button>
    <button
      v-for="n in MAX_LEVEL"
      :key="n"
      type="button"
      class="min-h-11 cursor-pointer border-0 bg-transparent px-[3px] font-mono text-inherit"
      :class="n <= music.level.value ? '' : 'opacity-25'"
      :aria-label="`Volume ${n} of ${MAX_LEVEL}`"
      :aria-pressed="n <= music.level.value"
      :title="`Volume ${n}`"
      @mousedown.prevent
      @click="music.setLevel(n)"
    >
      █
    </button>
    <button
      type="button"
      class="min-h-11 cursor-pointer border-0 bg-transparent px-2 font-mono text-inherit disabled:cursor-default disabled:opacity-40"
      aria-label="Volume up"
      title="Volume up"
      :disabled="music.level.value === MAX_LEVEL"
      @mousedown.prevent
      @click="music.setLevel(music.level.value + 1)"
    >
      [ + ]
    </button>
  </div>
</template>
