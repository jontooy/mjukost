<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { uploadPostImage } from '@/lib/storage'
import { useAuthStore } from '@/stores/auth'

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

const auth = useAuthStore()

const title = ref(props.title ?? '')
const body = ref(props.body ?? '')
const bodyEl = ref<HTMLTextAreaElement | null>(null)
const uploading = ref(false)
const uploadError = ref('')

watch(
  () => [props.title, props.body] as const,
  ([nextTitle, nextBody]) => {
    title.value = nextTitle ?? ''
    body.value = nextBody ?? ''
  },
)

const label = computed(() => props.submitLabel ?? 'Save')
const busy = computed(() => !!props.loading || uploading.value)

function insertAtCursor(snippet: string) {
  const el = bodyEl.value
  if (!el) {
    body.value = body.value ? `${body.value}\n\n${snippet}` : snippet
    return
  }

  const start = el.selectionStart
  const end = el.selectionEnd
  const before = body.value.slice(0, start)
  const after = body.value.slice(end)
  const needsLeadingNewline = before.length > 0 && !before.endsWith('\n')
  const needsTrailingNewline = after.length > 0 && !after.startsWith('\n')
  const text = `${needsLeadingNewline ? '\n\n' : ''}${snippet}${needsTrailingNewline ? '\n\n' : ''}`

  body.value = `${before}${text}${after}`

  const cursor = before.length + text.length
  requestAnimationFrame(() => {
    el.focus()
    el.setSelectionRange(cursor, cursor)
  })
}

async function onImageSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''

  if (!file) return

  const userId = auth.user?.id
  if (!userId) {
    uploadError.value = 'You must be signed in to upload images'
    return
  }

  uploading.value = true
  uploadError.value = ''

  try {
    const url = await uploadPostImage(file, userId)
    const alt = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')
    insertAtCursor(`![${alt}](${url})`)
  } catch (error) {
    uploadError.value = error instanceof Error ? error.message : 'Failed to upload image'
  } finally {
    uploading.value = false
  }
}

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
      <input v-model="title" type="text" required maxlength="200" :disabled="busy" />
    </label>

    <label>
      Body (markdown)
      <textarea ref="bodyEl" v-model="body" rows="14" required :disabled="busy" />
    </label>

    <div class="image-row">
      <label class="file-label">
        {{ uploading ? 'Uploading…' : 'Add image' }}
        <input
          type="file"
          accept="image/*"
          :disabled="busy"
          @change="onImageSelected"
        />
      </label>
      <p v-if="uploadError" class="error" role="alert">{{ uploadError }}</p>
    </div>

    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <button type="submit" :disabled="busy">
      {{ props.loading ? 'Saving…' : label }}
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

.image-row {
  display: grid;
  gap: 0.35rem;
}

.file-label {
  justify-self: start;
  display: inline-flex;
  align-items: center;
  padding: 0.45rem 0.7rem;
  border: 1px solid #ccc;
  border-radius: 0.35rem;
  background: #fff;
  font-size: 0.9rem;
  cursor: pointer;
}

.file-label:has(input:disabled) {
  opacity: 0.6;
  cursor: not-allowed;
}

.file-label input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
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
