<script setup lang="ts">
import { marked } from 'marked'
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import sadMjukost from '@/assets/sad-mjukost.svg'
import LoginForm from '@/components/LoginForm.vue'
import PostForm from '@/components/PostForm.vue'
import { createPost, deletePost, listPosts, updatePost } from '@/lib/posts'
import { resolvePrivateMarkdownUrls } from '@/lib/storage'
import { useAuthStore } from '@/stores/auth'
import type { Post } from '@/types/post'
import { createCastle } from '@/world/castle'
import { FirstPersonControls } from '@/world/controls'
import { Engine, type WorldName } from '@/world/engine'
import { createForest } from '@/world/forest'

type Overlay =
  | { kind: 'read'; post: Post; html: string }
  | { kind: 'edit'; post: Post }
  | { kind: 'new'; isPrivate: boolean }
  | { kind: 'login' }

const PORTAL_PUSHBACK = 1.5

const auth = useAuthStore()
const isTouch = matchMedia('(pointer: coarse)').matches

const canvasEl = ref<HTMLCanvasElement | null>(null)
const worldName = ref<WorldName>('forest')
const loading = ref(true)
const loadError = ref(false)
const locked = ref(false)
const focusLabel = ref<string | null>(null)
const overlay = ref<Overlay | null>(null)
const busy = ref(false)
const formError = ref('')
const joystick = reactive({ active: false, originX: 0, originY: 0, x: 0, y: 0 })

let engine: Engine
let controls: FirstPersonControls
let travelling = false

async function enter(name: WorldName, from?: WorldName) {
  travelling = true
  loading.value = true
  loadError.value = false
  try {
    const posts = await listPosts({ isPrivate: name === 'castle' })
    engine.setWorld(
      name === 'castle'
        ? createCastle(posts)
        : createForest(posts, { canWrite: auth.isAuthenticated }),
      from,
    )
    controls.syncFromCamera()
    worldName.value = name
  } catch {
    loadError.value = true
  } finally {
    loading.value = false
    travelling = false
  }
}

async function rebuild() {
  const position = engine.camera.position.clone()
  const rotation = engine.camera.rotation.clone()
  await enter(worldName.value)
  engine.camera.position.copy(position)
  engine.camera.rotation.copy(rotation)
  controls.syncFromCamera()
}

function onFrame(dt: number) {
  controls.update(dt)
  locked.value = controls.locked
  Object.assign(joystick, controls.joystick)
  focusLabel.value = overlay.value ? null : (engine.focused?.label ?? null)

  const world = engine.world
  if (!world || overlay.value || travelling) return
  for (const portal of world.portals) {
    const offset = engine.camera.position.clone().sub(portal.position).setY(0)
    if (offset.length() > portal.radius) continue
    if (portal.to === 'castle' && !auth.isAuthenticated) {
      engine.camera.position
        .copy(portal.position)
        .addScaledVector(offset.normalize(), portal.radius + PORTAL_PUSHBACK)
      open({ kind: 'login' })
      return
    }
    void enter(portal.to, world.name)
    return
  }
}

function open(next: Overlay) {
  formError.value = ''
  overlay.value = next
  controls.enabled = false
  controls.unlock()
}

function close() {
  overlay.value = null
  controls.enabled = true
}

async function interact() {
  const action = engine.focused?.action
  if (!action || overlay.value) return
  if (action.kind === 'new') {
    open({ kind: 'new', isPrivate: action.isPrivate })
    return
  }
  const resolved = await resolvePrivateMarkdownUrls(action.post.body)
  open({
    kind: 'read',
    post: action.post,
    html: marked.parse(resolved, { async: false }) as string,
  })
}

async function run(task: () => Promise<unknown>, failure: string) {
  busy.value = true
  formError.value = ''
  try {
    await task()
    close()
    await rebuild()
  } catch (error) {
    formError.value = error instanceof Error ? error.message : failure
  } finally {
    busy.value = false
  }
}

function onCreate(isPrivate: boolean, payload: { title: string; body: string }) {
  void run(
    () => createPost({ ...payload, is_private: isPrivate, user_id: auth.user!.id }),
    'Failed to create post',
  )
}

function onUpdate(post: Post, payload: { title: string; body: string }) {
  void run(
    () => updatePost(post.id, { ...payload, is_private: post.is_private }),
    'Failed to update post',
  )
}

function onDelete(post: Post) {
  if (!confirm(`Delete "${post.title}"?`)) return
  void run(() => deletePost(post.id), 'Failed to delete post')
}

async function onSignedIn() {
  close()
  await enter('castle', 'forest')
}

async function onSignOut() {
  await auth.signOut()
  close()
  await enter('forest', worldName.value === 'castle' ? 'castle' : undefined)
}

function onKeyDown(event: KeyboardEvent) {
  if (event.code === 'Escape' && overlay.value) close()
}

watch(worldName, (name) =>
  document.documentElement.classList.toggle('private-mode', name === 'castle'),
)

onMounted(() => {
  engine = new Engine(canvasEl.value!)
  controls = new FirstPersonControls(engine, canvasEl.value!)
  controls.onInteract = () => void interact()
  engine.onFrame = onFrame
  engine.start()
  window.addEventListener('keydown', onKeyDown)
  void enter('forest')
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  controls.dispose()
  engine.dispose()
  document.documentElement.classList.remove('private-mode')
})
</script>

<template>
  <div class="fixed inset-0 overflow-hidden bg-black select-none">
    <canvas ref="canvasEl" class="block h-full w-full touch-none" />

    <div
      v-if="!overlay"
      class="pointer-events-none absolute top-1/2 left-1/2 size-1.5 -translate-1/2 rounded-full bg-white/80"
    />

    <div class="absolute top-3 right-3 left-3 flex items-start justify-between gap-3 text-white">
      <p class="m-0 font-serif text-lg tracking-wide drop-shadow">
        {{ worldName === 'castle' ? 'The castle of notes' : 'mjukost forest' }}
      </p>
      <button
        v-if="auth.isAuthenticated"
        type="button"
        class="min-h-11 cursor-pointer rounded-[0.35rem] border border-white/40 bg-black/40 px-3 text-[0.85rem] text-white"
        @click="onSignOut"
      >
        Sign out
      </button>
    </div>

    <p
      v-if="focusLabel"
      class="pointer-events-none absolute top-[56%] left-1/2 m-0 -translate-x-1/2 rounded bg-black/55 px-3 py-1 text-center font-serif text-white"
    >
      {{ focusLabel }}
      <span v-if="!isTouch" class="text-white/70"> · E</span>
    </p>

    <p
      v-if="!isTouch && !locked && !overlay && !loading"
      class="pointer-events-none absolute bottom-6 left-1/2 m-0 -translate-x-1/2 rounded bg-black/55 px-4 py-2 text-center text-[0.9rem] text-white"
    >
      Click to look around · WASD to walk · Shift to run · E to interact
    </p>

    <template v-if="isTouch && !overlay">
      <div
        v-if="joystick.active"
        class="pointer-events-none absolute size-30 -translate-1/2 rounded-full border-2 border-white/40"
        :style="{ left: `${joystick.originX}px`, top: `${joystick.originY}px` }"
      >
        <div
          class="absolute top-1/2 left-1/2 size-12 -translate-1/2 rounded-full bg-white/50"
          :style="{
            transform: `translate(calc(-50% + ${joystick.x}px), calc(-50% + ${joystick.y}px))`,
          }"
        />
      </div>
      <button
        v-if="focusLabel"
        type="button"
        class="absolute right-6 bottom-8 size-18 rounded-full border-2 border-white/60 bg-black/50 font-serif text-white"
        @click="interact"
      >
        Use
      </button>
    </template>

    <div
      v-if="loading || loadError"
      class="absolute inset-0 grid place-items-center bg-black/60 text-center text-white"
      :role="loadError ? 'alert' : 'status'"
    >
      <div v-if="loadError">
        <img :src="sadMjukost" alt="" class="mx-auto mb-5 h-36 w-auto" />
        <p class="m-0 text-lg">Ups! Something went wrong...</p>
        <button
          type="button"
          class="mt-5 min-h-11 cursor-pointer rounded-[0.35rem] border border-white/40 bg-black/40 px-4 text-[0.9rem] text-white"
          @click="enter(worldName)"
        >
          Try again
        </button>
      </div>
      <div
        v-else
        class="h-7 w-7 animate-spin rounded-full border-2 border-white/30 border-t-white"
      />
    </div>

    <div
      v-if="overlay"
      class="absolute inset-0 grid place-items-center bg-black/50 p-3"
      @click.self="close"
    >
      <section
        class="max-h-[85vh] w-full max-w-[40rem] overflow-y-auto rounded-md border border-border bg-page p-5 text-ink shadow-2xl"
      >
        <div class="mb-4 flex items-start justify-between gap-4">
          <h1 class="m-0 text-xl font-normal break-words sm:text-2xl">
            <template v-if="overlay.kind === 'read'">{{ overlay.post.title }}</template>
            <template v-else-if="overlay.kind === 'edit'">
              {{ overlay.post.is_private ? 'Edit note' : 'Edit post' }}
            </template>
            <template v-else-if="overlay.kind === 'new'">
              {{ overlay.isPrivate ? 'New note' : 'New post' }}
            </template>
            <template v-else>The castle gate is sealed</template>
          </h1>
          <button
            type="button"
            class="min-h-11 shrink-0 cursor-pointer border-0 bg-transparent px-2 text-xl text-muted"
            aria-label="Close"
            @click="close"
          >
            ✕
          </button>
        </div>

        <template v-if="overlay.kind === 'read'">
          <time class="text-[0.85rem] text-subtle" :datetime="overlay.post.created_at">
            {{ new Date(overlay.post.created_at).toLocaleDateString() }}
          </time>
          <div class="post-body mt-3" v-html="overlay.html" />
          <div v-if="auth.isAuthenticated" class="mt-6 flex items-center gap-3">
            <button
              type="button"
              class="min-h-11 cursor-pointer rounded-[0.35rem] border border-border bg-surface px-3 text-[0.85rem] text-ink"
              @click="open({ kind: 'edit', post: overlay.post })"
            >
              Edit
            </button>
            <button
              type="button"
              class="min-h-11 cursor-pointer rounded-[0.35rem] border border-border bg-surface px-3 text-[0.85rem] text-ink disabled:opacity-60"
              :disabled="busy"
              @click="onDelete(overlay.post)"
            >
              {{ busy ? 'Deleting…' : 'Delete' }}
            </button>
          </div>
          <p v-if="formError" class="mt-3 text-[0.9rem] text-danger" role="alert">
            {{ formError }}
          </p>
        </template>

        <PostForm
          v-else-if="overlay.kind === 'edit'"
          :is-private="overlay.post.is_private"
          :title="overlay.post.title"
          :body="overlay.post.body"
          submit-label="Save"
          :loading="busy"
          :error-message="formError"
          @submit="onUpdate(overlay.post, $event)"
        />

        <PostForm
          v-else-if="overlay.kind === 'new'"
          :is-private="overlay.isPrivate"
          :submit-label="overlay.isPrivate ? 'Save note' : 'Publish'"
          :loading="busy"
          :error-message="formError"
          @submit="onCreate(overlay.isPrivate, $event)"
        />

        <template v-else>
          <p class="mt-0 mb-4 text-muted">Speak the words to enter.</p>
          <LoginForm @signed-in="onSignedIn" />
        </template>
      </section>
    </div>
  </div>
</template>
