import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { createBlankPainting, createOfflinePainting, createPainting, createPendingPainting, disposeObject, postWall, type PostWall } from '@/world/props'
import { EYE_HEIGHT, type Interactable, type World } from '@/world/engine'
import { seededRandom } from '@/lib/random'
import { surface } from '@/ascii/surfaces'

const HEIGHT = 4
const CORRIDOR_HALF_WIDTH = 3
const CELL_DEPTH = 3 // shallow enough to reach a note on the back wall through the bars
const CELL_LENGTH = 4
const CELLS_START = -2
const OUTER = CORRIDOR_HALF_WIDTH + CELL_DEPTH // the cells' back walls
const BODY = 0.35 // how close the player may come to a wall
const WALK_HALF_WIDTH = CORRIDOR_HALF_WIDTH - BODY
const CELL_DOOR_Z = -3.25 // centre of each cell's door, from the row's start
const CELL_DOOR_HALF = 0.6
const CELL_DOOR_HEIGHT = 2.4
const PARTITION_HALF = 0.15
const STEP = 0.1
const POSTER_Y = 2.45 // high on the back wall, clear of the skeletons and chains below
const TELEPORT = 3
const ROWS_AROUND = 8 // rows kept built on each side of the viewer; the fog hides the rest
const FOG_FAR = 28
const TORCH_LIGHTS = 4
const STAIR_HALF_WIDTH = 1.6
const STAIR_STEPS = 10
const STAIR_RISE = 0.3
const STAIR_RUN = 0.42
const SPAN = 160 // length of the floor and ceiling that follow the viewer

type Decor = 'skeleton' | 'shackled' | 'chains' | 'straw' | 'bones' | 'eyes' | 'empty'
const DECOR: Decor[] = ['skeleton', 'shackled', 'chains', 'straw', 'bones', 'bones', 'straw', 'empty', 'eyes']

interface Materials {
  stone: THREE.Material
  floor: THREE.Material
  iron: THREE.Material
  wood: THREE.Material
  bone: THREE.Material
  socket: THREE.Material
  straw: THREE.Material
  water: THREE.Material
  flame: THREE.Material
  eye: THREE.Material
}

interface Row {
  group: THREE.Group
  interactables: Interactable[]
  flames: THREE.Mesh[]
  eyes: THREE.Object3D[]
  torch: THREE.Vector3 | null
  owned: THREE.Object3D[] // the posters, which own their materials
}

// Below the throne room: an endless corridor of cells. Row by row, the right cell holds the
// lower slot; each private note hangs in the cell of its slot, every other cell has an empty
// poster to write on. Posters show '...' until setPosts hangs the notes; if those could not be
// loaded, every poster is a crossed-out mjukost.
export function createDungeon(): World {
  let wall: PostWall = 'pending'
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#030304')
  scene.fog = new THREE.Fog('#030304', 4, FOG_FAR)
  scene.add(new THREE.AmbientLight('#a8b0a8', 1.6))

  const m: Materials = {
    stone: new THREE.MeshStandardMaterial({ color: '#6a655c', roughness: 0.95, flatShading: true, ...surface('stone') }),
    floor: new THREE.MeshStandardMaterial({ color: '#4a453c', roughness: 0.85, ...surface('floor') }),
    iron: new THREE.MeshStandardMaterial({ color: '#3a3a40', metalness: 0.4, roughness: 0.6, ...surface('iron') }),
    wood: new THREE.MeshStandardMaterial({ color: '#5a3e2a', roughness: 0.9, flatShading: true, ...surface('wood') }),
    bone: new THREE.MeshStandardMaterial({ color: '#cfc5aa', roughness: 0.9, ...surface('bone') }),
    socket: new THREE.MeshBasicMaterial({ color: '#000000' }),
    straw: new THREE.MeshStandardMaterial({ color: '#8a7438', roughness: 1, flatShading: true, ...surface('grass') }),
    water: new THREE.MeshStandardMaterial({ color: '#0b0d0f', metalness: 0.9, roughness: 0.12, ...surface('water') }),
    flame: new THREE.MeshBasicMaterial({ color: '#ff8a3c', ...surface('flame') }),
    eye: new THREE.MeshBasicMaterial({ color: '#ff2a1a', fog: false, ...surface('eye') }),
  }
  const add = (mesh: THREE.Object3D, x: number, y: number, z: number) => {
    mesh.position.set(x, y, z)
    scene.add(mesh)
    return mesh
  }
  const box = (w: number, h: number, d: number, material: THREE.Material) =>
    new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)

  // Floor and ceiling follow the viewer down the corridor.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(OUTER * 2, SPAN), m.floor)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(OUTER * 2, SPAN), m.stone)
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.y = HEIGHT
  scene.add(ceiling)

  // The short stretch between the stairs and the first row of cells.
  for (const side of [-1, 1]) {
    add(box(0.6, HEIGHT, -CELLS_START, m.stone), side * (CORRIDOR_HALF_WIDTH + 0.3), HEIGHT / 2, CELLS_START / 2)
    const sideWidth = CORRIDOR_HALF_WIDTH + 0.6 - STAIR_HALF_WIDTH
    add(box(sideWidth, HEIGHT, 0.6, m.stone), side * (STAIR_HALF_WIDTH + sideWidth / 2), HEIGHT / 2, 0.3)
    add(box(CELL_DEPTH, HEIGHT, 0.3, m.stone), side * (CORRIDOR_HALF_WIDTH + CELL_DEPTH / 2), HEIGHT / 2, CELLS_START)
  }
  const web = new THREE.MeshBasicMaterial({ color: '#cfcfcf', transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
  add(new THREE.Mesh(new THREE.CircleGeometry(1.1, 10, -Math.PI / 2, Math.PI / 2), web), -STAIR_HALF_WIDTH - 0.2, HEIGHT, -0.01)
  add(new THREE.Mesh(new THREE.CircleGeometry(1.1, 10, Math.PI, Math.PI / 2), web), CORRIDOR_HALF_WIDTH, HEIGHT, -0.01)

  // The stairs up to the throne room, with a little warm light from above.
  for (let i = 0; i < STAIR_STEPS; i++) {
    const height = (i + 1) * STAIR_RISE
    add(box(STAIR_HALF_WIDTH * 2, height, STAIR_RUN, m.stone), 0, height / 2, 0.6 + STAIR_RUN / 2 + i * STAIR_RUN)
  }
  const stairTop = 0.6 + STAIR_STEPS * STAIR_RUN
  for (const side of [-1, 1]) {
    add(box(0.6, 7, stairTop, m.stone), side * (STAIR_HALF_WIDTH + 0.3), 3.5, stairTop / 2)
  }
  add(box(STAIR_HALF_WIDTH * 2, 7 - HEIGHT, 0.6, m.stone), 0, (7 + HEIGHT) / 2, 0.3)
  add(box(STAIR_HALF_WIDTH * 2 + 1.2, 7, 0.6, m.stone), 0, 3.5, stairTop + 0.3)
  const stairCeiling = new THREE.Mesh(new THREE.PlaneGeometry(STAIR_HALF_WIDTH * 2, stairTop), m.stone)
  stairCeiling.rotation.x = Math.PI / 2
  add(stairCeiling, 0, 7, stairTop / 2)
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(STAIR_HALF_WIDTH * 2 - 0.4, 2.6), new THREE.MeshBasicMaterial({ color: '#4a2c12', ...surface('glow') }))
  glow.rotation.y = Math.PI
  add(glow, 0, STAIR_STEPS * STAIR_RISE + 1.3, stairTop - 0.01)
  add(new THREE.PointLight('#ff9a3c', 2.5, 7, 1.6), 0, STAIR_STEPS * STAIR_RISE + 1, stairTop - 1)

  // A few torch lights are moved to the torches nearest the viewer.
  const torchLights = Array.from({ length: TORCH_LIGHTS }, () => {
    const light = new THREE.PointLight('#ff7a30', 0, 9, 1.6)
    scene.add(light)
    return light
  })

  const rows = new Map<number, Row>()
  const interactables: Interactable[] = []
  const random = seededRandom(13)
  let blinkAt = 3

  function sync(viewerZ: number) {
    const current = Math.max(0, Math.floor((CELLS_START - viewerZ) / CELL_LENGTH))
    const first = Math.max(0, current - ROWS_AROUND)
    const last = current + ROWS_AROUND
    for (const [index, row] of rows) {
      if (index >= first && index <= last) continue
      scene.remove(row.group)
      disposeRow(row)
      rows.delete(index)
    }
    for (let index = first; index <= last; index++) {
      if (rows.has(index)) continue
      const row = buildRow(index, wall, m)
      scene.add(row.group)
      rows.set(index, row)
    }
    interactables.length = 0
    for (const row of rows.values()) interactables.push(...row.interactables)

    // Floor and ceiling reach from just past the stairs' foot to well beyond the fog.
    const near = Math.min(0, viewerZ + FOG_FAR + 4)
    floor.position.z = near - SPAN / 2
    ceiling.position.z = near - SPAN / 2

    const torches = [...rows.values()]
      .flatMap((row) => (row.torch ? [row.torch] : []))
      .sort((a, b) => Math.abs(a.z - viewerZ) - Math.abs(b.z - viewerZ))
    torchLights.forEach((light, index) => {
      const torch = torches[index]
      light.visible = !!torch
      if (torch) light.position.copy(torch)
    })
  }

  const arrival = { position: new THREE.Vector3(0, EYE_HEIGHT, -2.5), yaw: 0 }
  sync(arrival.position.z)
  let syncedRow = -1
  const last = new THREE.Vector3(arrival.position.x, 0, arrival.position.z)
  return {
    name: 'dungeon',
    scene,
    spawn: arrival,
    arrivals: { castle: arrival },
    interactables,
    portals: [{ position: new THREE.Vector3(0, EYE_HEIGHT, 0.4), radius: 1.2, to: 'castle' }],
    clamp(position) {
      position.y = Math.min(position.y, HEIGHT - 0.3)
      const moved = Math.hypot(position.x - last.x, position.z - last.z)
      // A teleport or a restored position: take it if it is open, else bring it into the corridor.
      if (moved > TELEPORT) {
        if (blocked(position.x, position.z)) {
          position.x = THREE.MathUtils.clamp(position.x, -WALK_HALF_WIDTH, WALK_HALF_WIDTH)
          position.z = Math.min(position.z, -0.3)
        }
        last.set(position.x, 0, position.z)
        return
      }
      // Walk the move in short steps, keeping each axis only where it is open, so walls slide
      // and nothing thinner than a step can be passed through.
      const steps = Math.max(1, Math.ceil(moved / STEP))
      const dx = (position.x - last.x) / steps
      const dz = (position.z - last.z) / steps
      for (let i = 0; i < steps; i++) {
        if (!blocked(last.x + dx, last.z)) last.x += dx
        if (!blocked(last.x, last.z + dz)) last.z += dz
      }
      position.x = last.x
      position.z = last.z
    },
    update(_dt, elapsed, viewer) {
      const row = Math.floor((CELLS_START - viewer.z) / CELL_LENGTH)
      if (row !== syncedRow) {
        syncedRow = row
        sync(viewer.z)
      }
      torchLights.forEach((torch, index) => {
        torch.intensity = 4.5 + Math.sin(elapsed * 11 + index * 2.3) * 0.6 + random() * 0.9
      })
      if (elapsed > blinkAt) blinkAt = elapsed + 2.5 + random() * 4
      for (const built of rows.values()) {
        for (const flame of built.flames) flame.scale.y = 0.85 + random() * 0.3
        for (const eyes of built.eyes) eyes.visible = blinkAt - elapsed > 0.18
      }
    },
    setPosts(posts) {
      wall = postWall(posts)
      for (const built of rows.values()) {
        scene.remove(built.group)
        disposeRow(built)
      }
      rows.clear()
      interactables.length = 0
      syncedRow = NaN
    },
    dispose: () => {
      for (const built of rows.values()) disposeRow(built)
      disposeObject(scene)
    },
  }
}

// One row: a cell on each side, with bars toward the corridor. Static parts are merged per material.
function buildRow(index: number, wall: PostWall, m: Materials): Row {
  const row: Row = { group: new THREE.Group(), interactables: [], flames: [], eyes: [], torch: null, owned: [] }
  const cells: THREE.Group[] = []
  const start = CELLS_START - index * CELL_LENGTH
  row.group.position.z = start
  const statics = new THREE.Group()
  const put = (object: THREE.Object3D, x: number, y: number, z: number) => {
    object.position.set(x, y, z)
    statics.add(object)
    return object
  }
  const random = seededRandom(index * 7919 + 17)

  for (const side of [1, -1] as const) {
    put(new THREE.Mesh(new THREE.BoxGeometry(0.6, HEIGHT, CELL_LENGTH), m.stone), side * (OUTER + 0.3), HEIGHT / 2, -CELL_LENGTH / 2)
    put(new THREE.Mesh(new THREE.BoxGeometry(CELL_DEPTH, HEIGHT, 0.3), m.stone), side * (CORRIDOR_HALF_WIDTH + CELL_DEPTH / 2), HEIGHT / 2, -CELL_LENGTH)
    // The bars, with a gap for the cell's door.
    for (let z = -0.25; z > -CELL_LENGTH + 0.1; z -= 0.25) {
      if (Math.abs(z - CELL_DOOR_Z) <= CELL_DOOR_HALF) continue
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, HEIGHT, 6), m.iron), side * CORRIDOR_HALF_WIDTH, HEIGHT / 2, z)
    }
    for (const z of [CELL_DOOR_Z + CELL_DOOR_HALF, CELL_DOOR_Z - CELL_DOOR_HALF]) {
      put(new THREE.Mesh(new THREE.BoxGeometry(0.1, HEIGHT, 0.1), m.iron), side * CORRIDOR_HALF_WIDTH, HEIGHT / 2, z)
    }
    put(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, CELL_LENGTH), m.iron), side * CORRIDOR_HALF_WIDTH, CELL_DOOR_HEIGHT, -CELL_LENGTH / 2)
    const railToDoor = -(CELL_DOOR_Z + CELL_DOOR_HALF)
    put(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, railToDoor), m.iron), side * CORRIDOR_HALF_WIDTH, 0.3, -railToDoor / 2)

    // The cell's back wall faces the corridor; a cell's contents are laid out facing +z, then turned.
    const cell = new THREE.Group()
    cell.position.set(side * OUTER, 0, -CELL_LENGTH / 2)
    cell.rotation.y = -side * (Math.PI / 2)
    row.group.add(cell)
    cells.push(cell)
    // Every cell has a poster on its back wall, above the grim things on its floor: the note of
    // its slot, or an empty one to write the note of this cell on.
    const slot = index * 2 + (side === 1 ? 0 : 1)
    const note = wall instanceof Map ? wall.get(slot) : undefined
    const poster =
      wall === 'pending'
        ? createPendingPainting('#5a4630')
        : wall === 'offline'
          ? createOfflinePainting('#5a4630')
          : note
            ? createPainting(note, '#5a4630')
            : createBlankPainting('#5a4630')
    poster.position.set(0, POSTER_Y, 0.05)
    cell.add(poster)
    row.owned.push(poster)
    if (note) {
      row.interactables.push({ object: poster, label: note.title || 'Untitled', action: { kind: 'read', post: note } })
    } else if (wall instanceof Map) {
      row.interactables.push({ object: poster, label: 'Write a note here', action: { kind: 'new', isPrivate: true, slot } })
    }
    const eyes = furnishCell(cell, DECOR[Math.floor(random() * DECOR.length)]!, m, random)
    if (eyes) row.eyes.push(eyes)
    const hook = createChain(m.iron, 8)
    hook.position.set(side === 1 ? -1.2 : 1.2, 3.2, 0.06)
    cell.add(hook)
  }

  // A torch on every other partition, alternating sides.
  if (index % 2 === 1) {
    const side = (index - 1) % 4 === 0 ? -1 : 1
    const x = side * (CORRIDOR_HALF_WIDTH - 0.1)
    put(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.12), m.iron), x, 2.3, -CELL_LENGTH)
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 6), m.flame)
    flame.position.set(x, 2.6, -CELL_LENGTH)
    row.group.add(flame)
    row.flames.push(flame)
    row.torch = new THREE.Vector3(side * (CORRIDOR_HALF_WIDTH - 0.8), 2.6, start - CELL_LENGTH)
  }

  // Now and then a puddle of standing water in the corridor.
  if (random() < 0.4) {
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.3 + random() * 0.4, 16), m.water)
    puddle.rotation.x = -Math.PI / 2
    puddle.scale.set(1.5, 1, 1)
    put(puddle, random() * 3 - 1.5, 0.005, -random() * CELL_LENGTH)
  }

  // Decorations in the cells are static too: move them into the merge, keeping the live parts apart.
  const live = (child: THREE.Object3D) => row.owned.includes(child) || row.eyes.includes(child)
  for (const cell of cells) {
    cell.updateMatrix()
    for (const child of cell.children.filter((child) => !live(child))) {
      child.applyMatrix4(cell.matrix)
      statics.add(child)
    }
  }
  for (const mesh of mergeByMaterial(statics)) row.group.add(mesh)
  return row
}

// Bakes every mesh under root into one mesh per material, and frees the originals.
function mergeByMaterial(root: THREE.Object3D) {
  root.updateMatrixWorld(true)
  const parts = new Map<THREE.Material, THREE.BufferGeometry[]>()
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return
    const material = node.material as THREE.Material
    if (!parts.has(material)) parts.set(material, [])
    parts.get(material)!.push(node.geometry.clone().applyMatrix4(node.matrixWorld))
    node.geometry.dispose()
  })
  return [...parts].map(([material, geometries]) => {
    const merged = new THREE.Mesh(mergeGeometries(geometries), material)
    merged.receiveShadow = true
    for (const geometry of geometries) geometry.dispose()
    return merged
  })
}

// Materials are shared by the whole dungeon; only the notes and the empty poster own theirs.
function disposeRow(row: Row) {
  for (const object of row.owned) disposeObject(object)
  row.group.traverse((node) => {
    if (node instanceof THREE.Mesh) node.geometry.dispose()
  })
}

// Whether a player standing at (x, z) would be inside a wall: the corridor is open, the bars only
// at each cell's door, and inside a cell everything but its partitions and back wall.
function blocked(x: number, z: number) {
  const across = Math.abs(x)
  if (z > -0.3 || across > OUTER - BODY) return true
  if (across <= CORRIDOR_HALF_WIDTH - BODY) return false
  if (z > CELLS_START - BODY) return true // the walls between the stairs and the first row
  const rowStart = CELLS_START - Math.floor((CELLS_START - z) / CELL_LENGTH) * CELL_LENGTH
  const along = z - rowStart
  if (across < CORRIDOR_HALF_WIDTH + BODY) return Math.abs(along - CELL_DOOR_Z) > CELL_DOOR_HALF - BODY
  return along > -PARTITION_HALF - BODY || along < -CELL_LENGTH + PARTITION_HALF + BODY
}

// Fills an empty cell; returns the eyes if something is watching from it.
function furnishCell(cell: THREE.Group, decor: Decor, m: Materials, random: () => number) {
  switch (decor) {
    case 'skeleton':
    case 'shackled':
      cell.add(createSkeleton(m, decor === 'shackled'))
      return null
    case 'chains': {
      for (const x of [-0.95, 0.95]) {
        const chain = createChain(m.iron, 12)
        chain.position.set(x, 2.8, 0.06)
        cell.add(chain)
      }
      const skull = createSkull(m.bone, m.socket)
      skull.position.set(0.8, 0.12, 1.4)
      skull.rotation.set(0.2, -0.6, 0.3)
      cell.add(skull)
      return null
    }
    case 'straw': {
      for (let i = 0; i < 4; i++) {
        const heap = new THREE.Mesh(new THREE.BoxGeometry(0.9 + random() * 0.5, 0.15, 0.6 + random() * 0.4), m.straw)
        heap.position.set(-0.6 + random() * 1.2, 0.07, 0.5 + random() * 1)
        heap.rotation.y = random() * Math.PI
        cell.add(heap)
      }
      const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.35, 10, 1, true), m.wood)
      bucket.position.set(1.1, 0.17, 1.8)
      cell.add(bucket)
      return null
    }
    case 'bones':
      cell.add(createBones(m, random, 6))
      return null
    case 'eyes': {
      // Something waits in the dark at the back of this cell.
      const eyes = new THREE.Group()
      for (const x of [-0.09, 0.09]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), m.eye)
        eye.position.x = x
        eyes.add(eye)
      }
      eyes.position.set(-0.875, 1.1, 0.6)
      cell.add(eyes)
      return eyes
    }
    case 'empty':
      return null
  }
}

function createSkull(bone: THREE.Material, socket: THREE.Material) {
  const skull = new THREE.Group()
  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), bone)
  cranium.scale.set(1, 0.95, 1.15)
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.1), bone)
  jaw.position.set(0, -0.11, 0.06)
  skull.add(cranium, jaw)
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), socket)
    eye.position.set(side * 0.045, 0, 0.115)
    skull.add(eye)
  }
  return skull
}

// A skeleton sitting against the wall, facing +z; shackled ones hang by their wrists.
function createSkeleton(m: Materials, shackled: boolean) {
  const skeleton = new THREE.Group()
  const limb = (length: number, x: number, y: number, z: number, rx: number, rz: number) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, length, 6), m.bone)
    mesh.position.set(x, y, z)
    mesh.rotation.set(rx, 0, rz)
    skeleton.add(mesh)
  }
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.16), m.bone)
  pelvis.position.set(0, 0.1, 0.2)
  skeleton.add(pelvis)
  limb(0.6, 0, 0.45, 0.15, -0.15, 0)
  for (let i = 0; i < 4; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.13 - i * 0.012, 0.012, 6, 16), m.bone)
    rib.rotation.x = Math.PI / 2
    rib.scale.set(1, 0.7, 1)
    rib.position.set(0, 0.45 + i * 0.07, 0.2)
    skeleton.add(rib)
  }
  const skull = createSkull(m.bone, m.socket)
  skull.position.set(0.03, 0.88, 0.17)
  skull.rotation.set(0.5, 0.2, 0.35)
  skeleton.add(skull)
  for (const side of [-1, 1]) {
    limb(0.45, side * 0.1, 0.05, 0.45, Math.PI / 2, 0)
    limb(0.42, side * 0.12, 0.05, 0.9, Math.PI / 2, side * 0.1)
    if (shackled) {
      limb(0.5, side * 0.3, 0.95, 0.12, 0, -side * 0.6)
      const chain = createChain(m.iron, 6)
      chain.position.set(side * 0.45, 1.6, 0.06)
      skeleton.add(chain)
    } else {
      limb(0.5, side * 0.2, 0.45, 0.3, 0.4, side * 0.2)
    }
  }
  return skeleton
}

function createBones(m: Materials, random: () => number, count: number) {
  const pile = new THREE.Group()
  for (let i = 0; i < count; i++) {
    const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.3 + random() * 0.25, 6), m.bone)
    bone.rotation.set(Math.PI / 2, random() * Math.PI, 0)
    bone.position.set(random() * 0.8 - 0.4, 0.03, random() * 0.8 + 0.6)
    pile.add(bone)
  }
  const skull = createSkull(m.bone, m.socket)
  skull.position.set(0.1, 0.1, 1)
  skull.rotation.set(-0.2, 0.7, 0.1)
  pile.add(skull)
  return pile
}

// A vertical chain of iron links hanging down from its top, merged into one mesh.
function createChain(iron: THREE.Material, links: number) {
  const link = new THREE.TorusGeometry(0.04, 0.012, 6, 10)
  const turned = link.clone().rotateY(Math.PI / 2)
  const parts = Array.from({ length: links }, (_, i) => (i % 2 ? turned : link).clone().translate(0, -i * 0.07, 0))
  const chain = new THREE.Mesh(mergeGeometries(parts), iron)
  for (const geometry of [link, turned, ...parts]) geometry.dispose()
  return chain
}
