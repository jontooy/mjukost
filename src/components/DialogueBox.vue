<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { playVoice, stopVoice } from '@/audio/voice'
import type { Dialogue, DialogueChoice } from '@/world/dialogue'

const props = defineProps<{ dialogue: Dialogue }>()
const emit = defineEmits<{ end: [] }>()

const nodeId = ref(props.dialogue.start)
const node = computed(() => props.dialogue.nodes[nodeId.value]!)

// Each later line speaks as it appears; the opening line is voiced by whoever starts the conversation.
// Closing the box cuts the speaker off.
watch(node, ({ voice }) => {
  if (voice) void playVoice(voice)
  else stopVoice()
})

function choose(choice: DialogueChoice) {
  if (choice.next) nodeId.value = choice.next
  else emit('end')
}

// Replies are picked with their letter key; Enter or Space leaves once the speaker has the last word.
// Held keys are ignored, so a visitor strafing into the gate with A does not pick reply A.
function onKeyDown(event: KeyboardEvent) {
  if (event.repeat) return
  if (event.code === 'Escape') return emit('end')
  const { choices } = node.value
  if (choices.length === 0) {
    if (event.code !== 'Enter' && event.code !== 'Space') return
    event.preventDefault()
    return emit('end')
  }
  const choice = /^Key[A-Z]$/.test(event.code) ? choices[event.code.charCodeAt(3) - 65] : undefined
  if (!choice) return
  event.preventDefault()
  choose(choice)
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  stopVoice()
})
</script>

<template>
  <div
    role="dialog"
    :aria-label="node.speaker"
    class="absolute right-3 bottom-3 left-3 font-mono text-[0.95rem] text-white"
  >
    <p class="m-0 mb-1 w-fit bg-black/50 px-2 py-0.5">{{ node.speaker }}: {{ node.text }}</p>
    <template v-if="node.choices.length > 0">
      <p class="m-0 mb-1 w-fit bg-black/50 px-2 py-0.5">You:</p>
      <button
        v-for="(choice, i) in node.choices"
        :key="`${nodeId}-${i}`"
        type="button"
        class="mb-1 block w-full cursor-pointer border-0 bg-black/50 px-2 py-1 text-left text-white last:mb-0 hover:bg-black/70"
        @click="choose(choice)"
      >
        {{ String.fromCharCode(65 + i) }}. {{ choice.text }}<span v-if="choice.tag" class="text-white/60"> ({{ choice.tag }})</span>
      </button>
    </template>
    <button
      v-else
      type="button"
      class="block w-full cursor-pointer border-0 bg-black/50 px-2 py-1 text-left text-white hover:bg-black/70"
      @click="emit('end')"
    >
      Leave
    </button>
  </div>
</template>
