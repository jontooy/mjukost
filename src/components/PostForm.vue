<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  title?: string
  body?: string
  submitLabel?: string
  loading?: boolean
  errorMessage?: string
}>()

const emit = defineEmits<{
  submit: [payload: { title: string; body: string }]
}>()

const title = ref(props.title ?? '')
const body = ref(props.body ?? '')

watch(
  () => [props.title, props.body] as const,
  ([nextTitle, nextBody]) => {
    title.value = nextTitle ?? ''
    body.value = nextBody ?? ''
  },
)

const label = computed(() => props.submitLabel ?? 'Save')

function onSubmit() {
  emit('submit', {
    title: title.value.trim(),
    body: body.value,
  })
}
</script>

<template>
  <form class="form" @submit.prevent="onSubmit">
    <label>
      Title
      <input v-model="title" type="text" required maxlength="200" />
    </label>

    <label>
      Body (markdown)
      <textarea v-model="body" rows="14" required />
    </label>

    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <button type="submit" :disabled="loading">
      {{ loading ? 'Saving…' : label }}
    </button>
  </form>
</template>

<style scoped>
.form {
  display: grid;
  gap: 1rem;
}

label {
  display: grid;
  gap: 0.35rem;
  font-size: 0.9rem;
}

input,
textarea {
  padding: 0.6rem 0.7rem;
  border: 1px solid #ccc;
  border-radius: 0.35rem;
  font: inherit;
}

textarea {
  resize: vertical;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  line-height: 1.45;
}

button {
  justify-self: start;
  padding: 0.65rem 0.9rem;
  border: none;
  border-radius: 0.35rem;
  background: #1a1a1a;
  color: #fff;
  font: inherit;
  cursor: pointer;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  margin: 0;
  color: #b00020;
  font-size: 0.9rem;
}
</style>
