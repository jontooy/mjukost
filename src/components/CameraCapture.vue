<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const emit = defineEmits<{
  capture: [file: File]
  cancel: []
}>()

const videoEl = ref<HTMLVideoElement | null>(null)
const errorMessage = ref('')
const starting = ref(true)
const capturing = ref(false)
const live = ref(false)
const canFlip = ref(false)
const facingMode = ref<'user' | 'environment'>('environment')

let stream: MediaStream | null = null

async function detectFlipSupport() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    canFlip.value = devices.filter((device) => device.kind === 'videoinput').length > 1
  } catch {
    canFlip.value = false
  }
}

function stop() {
  stream?.getTracks().forEach((track) => track.stop())
  stream = null
  live.value = false
  if (videoEl.value) {
    videoEl.value.srcObject = null
  }
}

async function start() {
  stop()
  starting.value = true
  errorMessage.value = ''

  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera is not supported in this browser')
    }

    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: facingMode.value },
      },
      audio: false,
    })

    const video = videoEl.value
    if (!video) return

    video.srcObject = stream
    await video.play()
    live.value = true
    await detectFlipSupport()
  } catch (error) {
    live.value = false
    const name = error instanceof DOMException ? error.name : ''
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      errorMessage.value = 'Camera permission was denied'
    } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      errorMessage.value = 'No camera was found'
    } else {
      errorMessage.value = error instanceof Error ? error.message : 'Could not access camera'
    }
  } finally {
    starting.value = false
  }
}

async function flipCamera() {
  if (capturing.value || starting.value) return
  facingMode.value = facingMode.value === 'environment' ? 'user' : 'environment'
  await start()
}

async function takePhoto() {
  const video = videoEl.value
  if (!video || !video.videoWidth || capturing.value) return

  capturing.value = true
  errorMessage.value = ''

  try {
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Failed to capture photo')

    // Match the mirrored selfie preview so the saved photo matches what the user saw.
    if (facingMode.value === 'user') {
      context.translate(canvas.width, 0)
      context.scale(-1, 1)
    }
    context.drawImage(video, 0, 0)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92),
    )
    if (!blob) throw new Error('Failed to capture photo')

    const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' })
    stop()
    emit('capture', file)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to capture photo'
  } finally {
    capturing.value = false
  }
}

function onCancel() {
  stop()
  emit('cancel')
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    onCancel()
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  void start()
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  stop()
})
</script>

<template>
  <div
    class="fixed inset-0 z-50 grid place-items-center bg-ink/80 p-3 sm:p-6"
    role="dialog"
    aria-modal="true"
    aria-label="Take photo"
    @click.self="onCancel"
  >
    <div
      class="grid w-full max-w-lg gap-3 rounded-[0.35rem] border border-border bg-surface p-3 text-ink sm:gap-4 sm:p-4"
    >
      <div class="relative aspect-[4/3] overflow-hidden rounded-[0.35rem] bg-code-bg">
        <video
          ref="videoEl"
          class="h-full w-full object-cover"
          :class="facingMode === 'user' ? 'scale-x-[-1]' : ''"
          playsinline
          muted
          autoplay
        />
        <div
          v-if="starting"
          class="absolute inset-0 grid place-items-center text-[0.9rem] text-muted"
        >
          Starting camera…
        </div>
      </div>

      <p v-if="errorMessage" class="m-0 text-[0.9rem] text-danger" role="alert">
        {{ errorMessage }}
      </p>

      <div class="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
        <button
          type="button"
          class="min-h-11 cursor-pointer rounded-[0.35rem] border border-border bg-surface px-[0.9rem] py-[0.45rem] text-[0.9rem] font-inherit text-ink"
          @click="onCancel"
        >
          Cancel
        </button>
        <button
          v-if="canFlip"
          type="button"
          class="min-h-11 cursor-pointer rounded-[0.35rem] border border-border bg-surface px-[0.9rem] py-[0.45rem] text-[0.9rem] font-inherit text-ink disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="starting || capturing || !live"
          @click="flipCamera"
        >
          Flip
        </button>
        <button
          type="button"
          class="min-h-11 cursor-pointer rounded-[0.35rem] border-0 bg-ink px-[0.9rem] py-[0.45rem] text-[0.9rem] font-inherit text-page disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="starting || capturing || !live"
          @click="takePhoto"
        >
          {{ capturing ? 'Capturing…' : 'Capture' }}
        </button>
      </div>
    </div>
  </div>
</template>
