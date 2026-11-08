<script setup lang="ts">
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import * as THREE from 'three'
import { nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import sadMjukost from '@/assets/sad-mjukost.svg'
import MusicPlayer from '@/components/MusicPlayer.vue'
import { useMedievalMusic } from '@/composables/useMedievalMusic'
import { createPost, deletePost, listPosts, updatePost } from '@/lib/posts'
import { resolvePrivateMarkdownUrls, uploadPostImage } from '@/lib/storage'
import { useAuthStore } from '@/stores/auth'
import type { Post } from '@/types/post'
import { createCastle } from '@/world/castle'
import { FirstPersonControls } from '@/world/controls'
import type { DoorItem } from '@/world/door'
import { EYE_HEIGHT, Engine, type Portal, type WorldName } from '@/world/engine'
import { createForest } from '@/world/forest'
import type { Field } from '@/world/paperCanvas'
import { WritingBoard, type BoardItem } from '@/world/writingBoard'

type Mode = 'walk' | 'read' | 'write' | 'door'

interface Photo {
  alt: string
  url: string
}

interface WriteSession {
  board: WritingBoard
  post: Post | null
  isPrivate: boolean
  photos: Photo[]
}

interface Hover {
  label: string
  x: number
  y: number
}

interface SavedPosition {
  world: WorldName
  x: number
  y: number
  z: number
  yaw: number
  pitch: number
  flying: boolean
}

const PORTAL_PUSHBACK = 1.5
const CAMERA_SECONDS = 0.9
const IMAGE_PATTERN = /!\[([^\]]*)\]\(([^)\s]+)\)/g
const POSITION_KEY = 'mjukost-position'

const auth = useAuthStore()
const music = useMedievalMusic()
const isTouch = matchMedia('(pointer: coarse)').matches

const canvasEl = ref<HTMLCanvasElement | null>(null)
const titleInput = ref<HTMLInputElement | null>(null)
const bodyInput = ref<HTMLTextAreaElement | null>(null)
const emailInput = ref<HTMLInputElement | null>(null)
const passwordInput = ref<HTMLInputElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const worldName = ref<WorldName>('forest')
const mode = ref<Mode>('walk')
const loading = ref(true)
const loadError = ref(false)
const locked = ref(false)
const focusLabel = ref<string | null>(null)
const hover = ref<Hover | null>(null)
const reading = ref<{ post: Post; html: string } | null>(null)
const busy = ref(false)
const readError = ref('')
const joystick = reactive({ active: false, originX: 0, originY: 0, x: 0, y: 0 })
const consoleOpen = ref(false)
const consoleLine = ref('')
const consoleMessage = ref('')
const consoleInput = ref<HTMLInputElement | null>(null)
const coordinates = ref('')
const flying = ref(false)

const form = reactive({ title: '', body: '', email: '', password: '' })
const status = reactive({ text: '', isError: false })

let engine: Engine
let controls: FirstPersonControls
let travelling = false
let session: WriteSession | null = null
let returnTo: { position: THREE.Vector3; quaternion: THREE.Quaternion } | null = null
let lastDrawn = ''
const pointer = new THREE.Vector2()

async function enter(name: WorldName, from?: WorldName) {
  travelling = true
  loading.value = true
  loadError.value = false
  try {
    const posts = await listPosts({ isPrivate: name === 'castle' })
    engine.setWorld(
      name === 'castle'
        ? createCastle(posts)
        : createForest(posts, { signedIn: auth.isAuthenticated }),
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

function setStatus(text: string, isError = false) {
  status.text = text
  status.isError = isError
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function fieldOf(
  input: HTMLInputElement | HTMLTextAreaElement | null,
  text: string,
  caretOn: boolean,
): Field {
  const focused = !!input && document.activeElement === input
  return { text, caret: focused && caretOn ? (input.selectionStart ?? text.length) : null }
}

function drawFocusSurface() {
  const caretOn = Math.floor(performance.now() / 530) % 2 === 0
  if (mode.value === 'write' && session) {
    const title = fieldOf(titleInput.value, form.title, caretOn)
    const body = fieldOf(bodyInput.value, form.body, caretOn)
    const heading = `${session.post ? 'Editing' : 'A new'} ${session.isPrivate ? 'note' : 'post'}`
    const key = JSON.stringify([heading, title, body, status])
    if (key === lastDrawn) return
    lastDrawn = key
    session.board.render({
      heading,
      title,
      body,
      status: status.text,
      statusIsError: status.isError,
    })
    session.board.setPhotos(session.photos.map((photo) => photo.url))
  } else if (mode.value === 'door' && engine.world?.door) {
    const email = fieldOf(emailInput.value, form.email, caretOn)
    const password = fieldOf(passwordInput.value, form.password, caretOn)
    const key = JSON.stringify([email, password, status])
    if (key === lastDrawn) return
    lastDrawn = key
    engine.world.door.render({
      email,
      password,
      status: status.text,
      statusIsError: status.isError,
    })
  }
}

function onFrame(dt: number) {
  controls.update(dt)
  locked.value = controls.locked
  Object.assign(joystick, controls.joystick)
  focusLabel.value = mode.value === 'walk' ? (engine.focused?.label ?? null) : null
  if (consoleOpen.value) {
    const { x, y, z } = engine.camera.position
    coordinates.value = `XYZ: ${x.toFixed(1)} / ${(y - EYE_HEIGHT).toFixed(1)} / ${z.toFixed(1)}`
  }
  drawFocusSurface()

  const world = engine.world
  if (!world || mode.value !== 'walk' || travelling) return
  for (const portal of world.portals) {
    const offset = engine.camera.position.clone().sub(portal.position)
    if (offset.length() > portal.radius) continue
    if (portal.to === 'castle' && !auth.isAuthenticated) {
      pushOutOfPortal(portal, offset)
      void startDoor()
      return
    }
    void enter(portal.to, world.name)
    return
  }
}

function pushOutOfPortal(portal: Portal, offset: THREE.Vector3) {
  const y = engine.camera.position.y
  engine.camera.position
    .copy(portal.position)
    .addScaledVector(offset.setY(0).normalize(), portal.radius + PORTAL_PUSHBACK)
    .setY(y)
}

async function focusOn(next: Mode, view: { position: THREE.Vector3; lookAt: THREE.Vector3 }) {
  controls.enabled = false
  controls.unlock()
  engine.centerPick = false
  returnTo = {
    position: engine.camera.position.clone(),
    quaternion: engine.camera.quaternion.clone(),
  }
  setStatus('')
  lastDrawn = ''
  mode.value = next
  travelling = true
  await engine.moveCamera(view.position, view.lookAt, CAMERA_SECONDS)
  travelling = false
}

async function leaveFocus() {
  hover.value = null
  ;(document.activeElement as HTMLElement | null)?.blur()
  if (returnTo) {
    const target = returnTo
    const from = {
      position: engine.camera.position.clone(),
      quaternion: engine.camera.quaternion.clone(),
    }
    travelling = true
    await engine.animate(CAMERA_SECONDS * 0.8, (t) => {
      engine.camera.position.lerpVectors(from.position, target.position, t)
      engine.camera.quaternion.slerpQuaternions(from.quaternion, target.quaternion, t)
    })
    travelling = false
  }
  returnTo = null
  mode.value = 'walk'
  engine.centerPick = true
  controls.syncFromCamera()
  controls.enabled = true
}

function splitBody(body: string) {
  const photos = [...body.matchAll(IMAGE_PATTERN)].map((match) => ({
    alt: match[1]!,
    url: match[2]!,
  }))
  const text = body
    .replace(IMAGE_PATTERN, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { text, photos }
}

async function startWriting(isPrivate: boolean, post: Post | null) {
  const world = engine.world
  const desk = world?.interactables.find((i) => i.action.kind === 'new')?.object
  if (!world || !desk) return
  reading.value = null
  const board = new WritingBoard(
    desk,
    post ? 'Seal the changes' : isPrivate ? 'Seal the note' : 'Seal and publish',
  )
  world.scene.add(board.group)
  const { text, photos } = splitBody(post?.body ?? '')
  form.title = post?.title ?? ''
  form.body = text
  session = { board, post, isPrivate, photos }
  await focusOn('write', board.view(engine.camera.aspect))
  if (!isTouch) focusInput(titleInput.value)
}

async function endWriting() {
  if (!session) return
  const { board } = session
  session = null
  board.mirror.stop()
  await leaveFocus()
  board.dispose()
}

function focusInput(input: HTMLInputElement | HTMLTextAreaElement | null) {
  if (!input) return
  input.focus({ preventScroll: true })
  input.setSelectionRange(input.value.length, input.value.length)
}

async function pinPhoto(file: File) {
  if (!session) return
  const active = session
  setStatus('Pinning the photo…')
  try {
    const url = await uploadPostImage(file, { isPrivate: active.isPrivate })
    const alt = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')
    active.photos.push({ alt, url })
    setStatus('')
  } catch (error) {
    setStatus(errorText(error, 'The photo would not pin'), true)
  }
}

async function useMirror() {
  if (!session || busy.value) return
  const { board } = session
  busy.value = true
  try {
    if (!board.mirror.live) {
      setStatus('Looking into the mirror…')
      await board.liftMirror(engine, engine.camera.aspect)
      await board.mirror.start()
      board.showFlip()
      setStatus('')
      return
    }
    const file = await board.mirror.capture()
    board.mirror.stop()
    await board.lowerMirror(engine)
    await pinPhoto(file)
  } catch (error) {
    board.mirror.stop()
    await board.lowerMirror(engine)
    setStatus(errorText(error, 'The mirror stayed dark'), true)
  } finally {
    busy.value = false
  }
}

async function seal() {
  if (!session || busy.value) return
  const active = session
  const title = form.title.trim()
  if (!title) {
    setStatus('The title is still empty', true)
    focusInput(titleInput.value)
    return
  }
  const body = [form.body.trim(), ...active.photos.map((photo) => `![${photo.alt}](${photo.url})`)]
    .filter(Boolean)
    .join('\n\n')
  busy.value = true
  setStatus('Sealing…')
  try {
    if (active.post) {
      await updatePost(active.post.id, { title, body, is_private: active.post.is_private })
    } else {
      await createPost({ title, body, is_private: active.isPrivate })
    }
    await endWriting()
    await rebuild()
  } catch (error) {
    setStatus(errorText(error, 'The seal would not set'), true)
  } finally {
    busy.value = false
  }
}

function onBoardItem(item: BoardItem) {
  if (!session) return
  switch (item.kind) {
    case 'title':
      return focusInput(titleInput.value)
    case 'body':
      return focusInput(bodyInput.value)
    case 'photos':
      return fileInput.value?.click()
    case 'photo':
      session.photos.splice(item.index, 1)
      lastDrawn = ''
      return
    case 'mirror':
      return void useMirror()
    case 'flip':
      return void session.board.mirror
        .flip()
        .catch((error) => setStatus(errorText(error, 'The mirror would not turn'), true))
    case 'seal':
      return void seal()
    case 'leave':
      return void endWriting()
  }
}

async function startDoor() {
  const door = engine.world?.door
  if (!door) return
  form.email = ''
  form.password = ''
  await focusOn('door', door.view(engine.camera.aspect))
  if (!isTouch) focusInput(emailInput.value)
}

async function turnKey() {
  const world = engine.world
  if (!world?.door || busy.value) return
  busy.value = true
  try {
    setStatus('The key is turning…')
    await auth.signIn(form.email.trim(), form.password)
    ;(document.activeElement as HTMLElement | null)?.blur()
    setStatus('')
    await world.door.unlock(engine)
    const doorway = world.portals[0]!.position
    await engine.moveCamera(
      doorway.clone().setY(EYE_HEIGHT),
      doorway
        .clone()
        .setY(EYE_HEIGHT)
        .setZ(doorway.z - 5),
      1,
    )
    returnTo = null
    mode.value = 'walk'
    engine.centerPick = true
    controls.enabled = true
    await enter('castle', 'forest')
  } catch (error) {
    setStatus(errorText(error, 'The key will not turn'), true)
  } finally {
    busy.value = false
  }
}

function onDoorItem(item: DoorItem) {
  switch (item) {
    case 'email':
      return focusInput(emailInput.value)
    case 'password':
      return focusInput(passwordInput.value)
    case 'key':
      return void turnKey()
  }
}

function pickFocused() {
  if (travelling || busy.value) return null
  if (mode.value === 'write' && session) {
    const pick = engine.pickAt(pointer, session.board.targets)
    return pick ? session.board.itemAt(pick) : null
  }
  const door = engine.world?.door
  if (mode.value === 'door' && door) {
    const pick = engine.pickAt(pointer, door.targets)
    return pick ? door.itemAt(pick) : null
  }
  return null
}

function updatePointer(event: PointerEvent | MouseEvent) {
  const rect = canvasEl.value!.getBoundingClientRect()
  pointer.set(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  )
}

function onPointerMove(event: PointerEvent) {
  if (mode.value !== 'write' && mode.value !== 'door') return
  updatePointer(event)
  const found = pickFocused()
  hover.value = found ? { label: found.label, x: event.clientX, y: event.clientY } : null
}

function onCanvasClick(event: MouseEvent) {
  if (mode.value !== 'write' && mode.value !== 'door') return
  updatePointer(event)
  const found = pickFocused()
  if (!found) return
  if (mode.value === 'write') onBoardItem(found.item as BoardItem)
  else onDoorItem(found.item as DoorItem)
}

function stepBack() {
  if (busy.value) return
  if (mode.value === 'write') void endWriting()
  else if (mode.value === 'door') void leaveFocus()
}

async function onFileChosen(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) await pinPhoto(file)
}

function openRead(post: Post, html: string) {
  readError.value = ''
  reading.value = { post, html }
  mode.value = 'read'
  controls.enabled = false
  controls.unlock()
}

function closeRead() {
  reading.value = null
  mode.value = 'walk'
  controls.enabled = true
}

async function interact() {
  const action = engine.focused?.action
  if (!action || mode.value !== 'walk') return
  if (action.kind === 'new') {
    await startWriting(action.isPrivate, null)
    return
  }
  const resolved = await resolvePrivateMarkdownUrls(action.post.body)
  openRead(action.post, DOMPurify.sanitize(marked.parse(resolved, { async: false }) as string))
}

async function editReading() {
  const post = reading.value?.post
  if (!post) return
  mode.value = 'walk'
  await startWriting(post.is_private, post)
}

async function onDelete(post: Post) {
  if (!confirm(`Delete "${post.title}"?`)) return
  busy.value = true
  readError.value = ''
  try {
    await deletePost(post.id)
    closeRead()
    await rebuild()
  } catch (error) {
    readError.value = errorText(error, 'Failed to delete post')
  } finally {
    busy.value = false
  }
}

async function onSignOut() {
  if (session) await endWriting()
  if (consoleOpen.value) closeConsole()
  flying.value = false
  await auth.signOut()
  closeRead()
  await enter('forest', worldName.value === 'castle' ? 'castle' : undefined)
}

function openConsole() {
  consoleOpen.value = true
  consoleLine.value = ''
  consoleMessage.value = ''
  controls.enabled = false
  controls.unlock()
  void nextTick(() => consoleInput.value?.focus())
}

function closeConsole() {
  consoleOpen.value = false
  controls.enabled = true
}

async function teleportToSpawn() {
  const world = engine.world
  if (!world || worldName.value !== 'forest') return enter('forest')
  engine.camera.position.copy(world.spawn.position)
  engine.camera.rotation.set(0, world.spawn.yaw, 0, 'YXZ')
  controls.syncFromCamera()
}

// While focused on the desk or door, the camera is posed; save where the player stood instead.
function savePosition() {
  if (!engine.world) return
  const position = returnTo?.position ?? engine.camera.position
  const rotation = new THREE.Euler().setFromQuaternion(
    returnTo?.quaternion ?? engine.camera.quaternion,
    'YXZ',
  )
  const saved: SavedPosition = {
    world: worldName.value,
    x: position.x,
    y: position.y,
    z: position.z,
    yaw: rotation.y,
    pitch: rotation.x,
    flying: flying.value,
  }
  sessionStorage.setItem(POSITION_KEY, JSON.stringify(saved))
}

async function restorePosition() {
  const saved = JSON.parse(sessionStorage.getItem(POSITION_KEY) ?? 'null') as SavedPosition | null
  if (!saved || (saved.world === 'castle' && !auth.isAuthenticated)) return enter('forest')
  await enter(saved.world)
  if (loadError.value) return
  engine.camera.position.set(saved.x, saved.y, saved.z)
  engine.camera.rotation.set(saved.pitch, saved.yaw, 0, 'YXZ')
  controls.syncFromCamera()
  flying.value = saved.flying
}

interface ConsoleCommand {
  name: string
  usage: string
  description: string
  run: (args: string) => unknown
}

const COMMANDS: ConsoleCommand[] = [
  {
    name: '/help',
    usage: '/help',
    description: 'List all commands',
    run: () => {
      consoleMessage.value = COMMANDS.map((c) => `${c.usage}  ${c.description}`).join('\n')
    },
  },
  {
    name: '/tp',
    usage: '/tp x y z | /tp castle',
    description: 'Teleport to coordinates, or back to the starting position',
    run: (args) => {
      if (args === 'castle') {
        closeConsole()
        return teleportToSpawn()
      }
      const numbers = args.replace(/[(),]/g, ' ').trim().split(/\s+/).map(Number)
      if (numbers.length !== 3 || !numbers.every(Number.isFinite)) {
        consoleMessage.value = 'Usage: /tp x y z | /tp castle'
        return
      }
      const [x, y, z] = numbers as [number, number, number]
      closeConsole()
      engine.camera.position.set(x, y + EYE_HEIGHT, z)
      engine.world?.clamp(engine.camera.position)
      // Teleporting never travels between worlds; the castle is only entered through its gate.
      for (const portal of engine.world?.portals ?? []) {
        const offset = engine.camera.position.clone().sub(portal.position)
        if (offset.length() <= portal.radius) pushOutOfPortal(portal, offset)
      }
    },
  },
  {
    name: '/fly',
    usage: '/fly [on|off]',
    description: 'Toggle flying, or set it: Space to rise, Shift to sink',
    run: (args) => {
      if (args !== '' && args !== 'on' && args !== 'off') {
        consoleMessage.value = 'Usage: /fly [on|off]'
        return
      }
      flying.value = args === '' ? !flying.value : args === 'on'
      closeConsole()
    },
  },
  {
    name: '/music',
    usage: '/music [on|off]',
    description: 'Toggle the music, or set it',
    run: (args) => {
      if (args !== '' && args !== 'on' && args !== 'off') {
        consoleMessage.value = 'Usage: /music [on|off]'
        return
      }
      if (args === 'on') music.play()
      else if (args === 'off') music.stop()
      else music.toggle()
      closeConsole()
    },
  },
]

async function runCommand() {
  const line = consoleLine.value.trim()
  consoleLine.value = ''
  const [name, ...args] = line.split(/\s+/)
  const command = COMMANDS.find((c) => c.name === name)
  if (!command) {
    consoleMessage.value = `Unknown command: ${line}. Type /help for commands.`
    return
  }
  await command.run(args.join(' '))
}

function onKeyDown(event: KeyboardEvent) {
  const canToggle = consoleOpen.value || (mode.value === 'walk' && !loading.value && !travelling)
  if (event.code === 'Tab' && !isTouch && auth.isAuthenticated && canToggle) {
    event.preventDefault()
    if (consoleOpen.value) closeConsole()
    else openConsole()
    return
  }
  if (event.code !== 'Escape') return
  if (consoleOpen.value) closeConsole()
  else if (mode.value === 'read') closeRead()
  else stepBack()
}

watch(worldName, (name) => {
  document.documentElement.classList.toggle('private-mode', name === 'castle')
  music.applyWorldPreset(name)
})

watch(flying, (on) => (controls.flying = on))

onMounted(() => {
  engine = new Engine(canvasEl.value!)
  controls = new FirstPersonControls(engine, canvasEl.value!)
  controls.onInteract = () => void interact()
  engine.onFrame = onFrame
  engine.start()
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('pagehide', savePosition)
  void restorePosition()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('pagehide', savePosition)
  session?.board.dispose()
  controls.dispose()
  engine.dispose()
  document.documentElement.classList.remove('private-mode')
})
</script>

<template>
  <div class="fixed inset-0 overflow-hidden bg-black select-none">
    <canvas
      ref="canvasEl"
      class="block h-full w-full touch-none"
      :class="hover ? 'cursor-pointer' : ''"
      @pointermove="onPointerMove"
      @click="onCanvasClick"
    />

    <input
      ref="titleInput"
      v-model="form.title"
      class="pointer-events-none fixed top-0 left-0 size-px opacity-0"
      aria-label="Title"
      maxlength="200"
      @keydown.enter.prevent="focusInput(bodyInput)"
    />
    <textarea
      ref="bodyInput"
      v-model="form.body"
      class="pointer-events-none fixed top-0 left-0 size-px opacity-0"
      aria-label="Text"
    />
    <input
      ref="emailInput"
      v-model="form.email"
      class="pointer-events-none fixed top-0 left-0 size-px opacity-0"
      type="text"
      inputmode="email"
      autocapitalize="off"
      spellcheck="false"
      autocomplete="username"
      aria-label="Email"
      @keydown.enter.prevent="focusInput(passwordInput)"
    />
    <input
      ref="passwordInput"
      v-model="form.password"
      class="pointer-events-none fixed top-0 left-0 size-px opacity-0"
      type="password"
      autocomplete="current-password"
      aria-label="Password"
      @keydown.enter.prevent="turnKey"
    />
    <input ref="fileInput" class="hidden" type="file" accept="image/*" @change="onFileChosen" />

    <div
      v-if="mode === 'walk'"
      class="pointer-events-none absolute top-1/2 left-1/2 size-1.5 -translate-1/2 rounded-full bg-white/80"
    />

    <div class="absolute top-3 right-3 left-3 flex items-start justify-between gap-3 text-white">
      <div class="flex flex-col gap-1">
        <p v-if="worldName === 'castle'" class="m-0 font-serif text-lg tracking-wide drop-shadow">
          The castle of notes
        </p>
        <p v-if="consoleOpen" class="m-0 w-fit bg-black/50 px-2 py-0.5 font-mono text-[0.95rem]">
          {{ coordinates }}
        </p>
      </div>
      <div class="ml-auto flex gap-2">
        <MusicPlayer />
        <button
          v-if="mode === 'write' || mode === 'door'"
          type="button"
          class="min-h-11 cursor-pointer rounded-[0.35rem] border border-white/40 bg-black/40 px-3 text-[0.85rem] text-white"
          @click="stepBack"
        >
          Step back
        </button>
        <button
          v-if="auth.isAuthenticated && mode === 'walk'"
          type="button"
          class="min-h-11 cursor-pointer rounded-[0.35rem] border border-white/40 bg-black/40 px-3 text-[0.85rem] text-white"
          @click="onSignOut"
        >
          Sign out
        </button>
      </div>
    </div>

    <p
      v-if="focusLabel"
      class="pointer-events-none absolute top-[56%] left-1/2 m-0 -translate-x-1/2 rounded bg-black/55 px-3 py-1 text-center font-serif text-white"
    >
      {{ focusLabel }}
      <span v-if="!isTouch" class="text-white/70"> · E</span>
    </p>

    <p
      v-if="hover"
      class="pointer-events-none absolute m-0 rounded bg-black/65 px-2 py-0.5 font-serif text-[0.9rem] text-white"
      :style="{ left: `${hover.x + 14}px`, top: `${hover.y + 14}px` }"
    >
      {{ hover.label }}
    </p>

    <p
      v-if="!isTouch && !locked && !consoleOpen && mode === 'walk' && !loading"
      class="pointer-events-none absolute bottom-6 left-1/2 m-0 -translate-x-1/2 rounded bg-black/55 px-4 py-2 text-center text-[0.9rem] text-white"
    >
      Click to look around · WASD to
      {{ flying ? 'fly · Space up · Shift down' : 'walk · Shift to run' }} · E to interact
    </p>

    <form
      v-if="consoleOpen"
      class="absolute right-3 bottom-3 left-3 font-mono text-[0.95rem] text-white"
      @submit.prevent="runCommand"
    >
      <p v-if="consoleMessage" class="m-0 mb-1 w-fit bg-black/50 px-2 py-0.5 whitespace-pre-line">
        {{ consoleMessage }}
      </p>
      <input
        ref="consoleInput"
        v-model="consoleLine"
        class="block w-full border-0 bg-black/50 px-2 py-1 text-white outline-none"
        aria-label="Console"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
      />
    </form>

    <template v-if="isTouch && mode === 'walk'">
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
      v-if="reading"
      class="absolute inset-0 grid place-items-center bg-black/50 p-3"
      @click.self="closeRead"
    >
      <section
        class="max-h-[85vh] w-full max-w-[40rem] overflow-y-auto rounded-md border border-border bg-page p-5 text-ink shadow-2xl"
      >
        <div class="mb-4 flex items-start justify-between gap-4">
          <h1 class="m-0 text-xl font-normal break-words sm:text-2xl">{{ reading.post.title }}</h1>
          <button
            type="button"
            class="min-h-11 shrink-0 cursor-pointer border-0 bg-transparent px-2 text-xl text-muted"
            aria-label="Close"
            @click="closeRead"
          >
            ✕
          </button>
        </div>
        <time class="text-[0.85rem] text-subtle" :datetime="reading.post.created_at">
          {{ new Date(reading.post.created_at).toLocaleDateString() }}
        </time>
        <div class="post-body mt-3" v-html="reading.html" />
        <div v-if="auth.isAuthenticated" class="mt-6 flex items-center gap-3">
          <button
            type="button"
            class="min-h-11 cursor-pointer rounded-[0.35rem] border border-border bg-surface px-3 text-[0.85rem] text-ink"
            @click="editReading"
          >
            Edit at the desk
          </button>
          <button
            type="button"
            class="min-h-11 cursor-pointer rounded-[0.35rem] border border-border bg-surface px-3 text-[0.85rem] text-ink disabled:opacity-60"
            :disabled="busy"
            @click="onDelete(reading.post)"
          >
            {{ busy ? 'Deleting…' : 'Delete' }}
          </button>
        </div>
        <p v-if="readError" class="mt-3 text-[0.9rem] text-danger" role="alert">
          {{ readError }}
        </p>
      </section>
    </div>
  </div>
</template>
