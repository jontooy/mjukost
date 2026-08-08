<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { uploadPostImage } from '@/lib/storage'
import { useAuthStore } from '@/stores/auth'
import { usePrivateModeStore } from '@/stores/privateMode'

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
const privateMode = usePrivateModeStore()

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
    const url = await uploadPostImage(file, userId, { isPrivate: privateMode.active })
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
  <form class="grid gap-4" @submit.prevent="onSubmit">
    <label class="grid gap-[0.35rem] text-[0.9rem]">
      Title
      <input
        v-model="title"
        class="w-full min-h-11 rounded-[0.35rem] border border-border bg-surface px-[0.7rem] py-[0.6rem] text-base font-inherit text-ink disabled:cursor-not-allowed disabled:opacity-60"
        type="text"
        required
        maxlength="200"
        :disabled="busy"
      />
    </label>

    <label class="grid gap-[0.35rem] text-[0.9rem]">
      Body (markdown)
      <textarea
        ref="bodyEl"
        v-model="body"
        class="min-h-[12rem] w-full resize-y rounded-[0.35rem] border border-border bg-surface px-[0.7rem] py-[0.6rem] font-mono text-base leading-[1.45] text-ink disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[18rem]"
        rows="10"
        required
        :disabled="busy"
      />
    </label>

    <div class="grid gap-[0.35rem]">
      <label
        class="inline-flex min-h-11 cursor-pointer items-center justify-self-stretch rounded-[0.35rem] border border-border bg-surface px-[0.7rem] py-[0.45rem] text-[0.9rem] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 sm:justify-self-start"
      >
        {{ uploading ? 'Uploading…' : 'Add image' }}
        <input
          class="sr-only"
          type="file"
          accept="image/*"
          :disabled="busy"
          @change="onImageSelected"
        />
      </label>
      <p v-if="uploadError" class="m-0 text-[0.9rem] text-danger" role="alert">{{ uploadError }}</p>
    </div>

    <p v-if="errorMessage" class="m-0 text-[0.9rem] text-danger" role="alert">{{ errorMessage }}</p>

    <button
      type="submit"
      class="w-full min-h-11 cursor-pointer rounded-[0.35rem] border-0 bg-ink px-[0.9rem] py-[0.65rem] font-inherit text-page disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:justify-self-start"
      :disabled="busy"
    >
      {{ props.loading ? 'Saving…' : label }}
    </button>
  </form>
</template>
