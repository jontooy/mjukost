import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { Post } from '@/types/post'
import { EYE_HEIGHT, type Interactable, type World } from '@/world/engine'
import { seededRandom } from '@/lib/random'
import { createDesk, createPainting, disposeObject } from '@/world/props'

const HEIGHT = 4
const CORRIDOR_HALF_WIDTH = 3
const CELL_DEPTH = 4
const CELL_LENGTH = 4
const CELLS = 5
const CELLS_START = -2
const CHAMBER_FRONT = CELLS_START - CELLS * CELL_LENGTH - 2
const CHAMBER_MIN_DEPTH = 10
const NOTE_SPACING = 2.4
const CHAMBER_HALF_WIDTH = 6.3
const CHAMBER_HEIGHT = 5
const STAIR_HALF_WIDTH = 1.6
const STAIR_STEPS = 10
const STAIR_RISE = 0.3
const STAIR_RUN = 0.42
const OUTER = CORRIDOR_HALF_WIDTH + CELL_DEPTH // the cells' back walls
const WALK_HALF_WIDTH = CORRIDOR_HALF_WIDTH - 0.6
const CHAMBER_WALK_FRONT = CHAMBER_FRONT - 0.5

type CellKind = 'skeleton' | 'chains' | 'straw' | 'bones' | 'eyes'
const CELL_KINDS: Record<-1 | 1, CellKind[]> = {
  [-1]: ['chains', 'skeleton', 'straw', 'bones', 'skeleton'],
  [1]: ['skeleton', 'straw', 'eyes', 'bones', 'chains'],
}

interface Materials {
  stone: THREE.Material
  floor: THREE.Material
  iron: THREE.Material
  wood: THREE.Material
  bone: THREE.Material
  socket: THREE.Material
  straw: THREE.Material
  flame: THREE.Material
}

// Below the throne room: a corridor of barred cells that ends in a torture chamber,
// where the private notes hang and the desk for writing them stands.
export function createDungeon(notes: Post[]): World {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#030304')
  scene.fog = new THREE.Fog('#030304', 4, 30)
  scene.add(new THREE.AmbientLight('#a8b0a8', 1.6))

  const m: Materials = {
    stone: new THREE.MeshStandardMaterial({ color: '#6a655c', roughness: 0.95, flatShading: true }),
    floor: new THREE.MeshStandardMaterial({ color: '#4a453c', roughness: 0.85 }),
    iron: new THREE.MeshStandardMaterial({ color: '#3a3a40', metalness: 0.4, roughness: 0.6 }),
    wood: new THREE.MeshStandardMaterial({ color: '#5a3e2a', roughness: 0.9, flatShading: true }),
    bone: new THREE.MeshStandardMaterial({ color: '#cfc5aa', roughness: 0.9 }),
    socket: new THREE.MeshBasicMaterial({ color: '#000000' }),
    straw: new THREE.MeshStandardMaterial({ color: '#8a7438', roughness: 1, flatShading: true }),
    flame: new THREE.MeshBasicMaterial({ color: '#ff8a3c' }),
  }
  const random = seededRandom(13)
  const add = (mesh: THREE.Object3D, x: number, y: number, z: number) => {
    mesh.position.set(x, y, z)
    scene.add(mesh)
    return mesh
  }
  const box = (w: number, h: number, d: number, material: THREE.Material) =>
    new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)

  // Floor and ceilings.
  const chamberDepth = Math.max(CHAMBER_MIN_DEPTH, Math.ceil(notes.length / 2) * NOTE_SPACING + 5)
  const chamberBack = CHAMBER_FRONT - chamberDepth
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(OUTER * 2, -chamberBack), m.floor)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  add(floor, 0, 0, chamberBack / 2)
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(OUTER * 2, -CHAMBER_FRONT), m.stone)
  ceiling.rotation.x = Math.PI / 2
  add(ceiling, 0, HEIGHT, CHAMBER_FRONT / 2)
  const chamberCeiling = new THREE.Mesh(new THREE.PlaneGeometry(CHAMBER_HALF_WIDTH * 2, chamberDepth), m.stone)
  chamberCeiling.rotation.x = Math.PI / 2
  add(chamberCeiling, 0, CHAMBER_HEIGHT, CHAMBER_FRONT - chamberDepth / 2)

  // Corridor walls before and after the cells, and the wall around the foot of the stairs.
  const cellsEnd = CELLS_START - CELLS * CELL_LENGTH
  for (const side of [-1, 1]) {
    add(box(0.6, HEIGHT, -CELLS_START, m.stone), side * (CORRIDOR_HALF_WIDTH + 0.3), HEIGHT / 2, CELLS_START / 2)
    add(box(0.6, HEIGHT, cellsEnd - CHAMBER_FRONT, m.stone), side * (CORRIDOR_HALF_WIDTH + 0.3), HEIGHT / 2, (cellsEnd + CHAMBER_FRONT) / 2)
    const sideWidth = CORRIDOR_HALF_WIDTH + 0.6 - STAIR_HALF_WIDTH
    add(box(sideWidth, HEIGHT, 0.6, m.stone), side * (STAIR_HALF_WIDTH + sideWidth / 2), HEIGHT / 2, 0.3)
    add(box(0.6, HEIGHT, -cellsEnd + CELLS_START, m.stone), side * (OUTER + 0.3), HEIGHT / 2, (CELLS_START + cellsEnd) / 2)
  }

  // Cells: stone partitions, iron bars on the corridor side, something grim inside each.
  const bars = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.025, 0.025, HEIGHT, 6),
    m.iron,
    2 * CELLS * Math.floor(CELL_LENGTH / 0.25),
  )
  const matrix = new THREE.Matrix4()
  let bar = 0
  let eyes: THREE.Group | null = null
  for (const side of [-1, 1] as const) {
    for (let i = 0; i <= CELLS; i++) {
      add(box(CELL_DEPTH, HEIGHT, 0.3, m.stone), side * (CORRIDOR_HALF_WIDTH + CELL_DEPTH / 2), HEIGHT / 2, CELLS_START - i * CELL_LENGTH)
    }
    for (let i = 0; i < CELLS; i++) {
      const start = CELLS_START - i * CELL_LENGTH
      for (let z = start - 0.25; z > start - CELL_LENGTH + 0.1; z -= 0.25) {
        bars.setMatrixAt(bar++, matrix.makeTranslation(side * CORRIDOR_HALF_WIDTH, HEIGHT / 2, z))
      }
      add(box(0.08, 0.08, CELL_LENGTH, m.iron), side * CORRIDOR_HALF_WIDTH, 0.3, start - CELL_LENGTH / 2)
      add(box(0.08, 0.08, CELL_LENGTH, m.iron), side * CORRIDOR_HALF_WIDTH, 2.4, start - CELL_LENGTH / 2)
      const furnished = furnishCell(CELL_KINDS[side][i]!, side, m, random)
      furnished.position.set(side * (OUTER - 0.25), 0, start - CELL_LENGTH / 2)
      furnished.rotation.y = -side * (Math.PI / 2)
      scene.add(furnished)
      if (CELL_KINDS[side][i] === 'eyes') eyes = furnished.getObjectByName('eyes') as THREE.Group
    }
  }
  bars.count = bar
  scene.add(bars)

  // Three torches along the corridor, on the ends of the partitions.
  const torches: THREE.PointLight[] = []
  const flames: THREE.Mesh[] = []
  for (const [i, side] of [
    [1, -1],
    [3, 1],
    [5, -1],
  ] as const) {
    const z = CELLS_START - i * CELL_LENGTH
    add(box(0.12, 0.35, 0.12, m.iron), side * (CORRIDOR_HALF_WIDTH - 0.1), 2.3, z)
    flames.push(add(new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 6), m.flame), side * (CORRIDOR_HALF_WIDTH - 0.1), 2.6, z) as THREE.Mesh)
    torches.push(add(new THREE.PointLight('#ff7a30', 3, 9, 1.6), side * (CORRIDOR_HALF_WIDTH - 0.8), 2.6, z) as THREE.PointLight)
  }

  // Cobwebs in the upper corners at both ends of the corridor.
  const web = new THREE.MeshBasicMaterial({ color: '#cfcfcf', transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
  for (const [x, z, start] of [
    [-STAIR_HALF_WIDTH - 0.2, -0.01, -Math.PI / 2],
    [CORRIDOR_HALF_WIDTH, -0.01, Math.PI],
    [-CHAMBER_HALF_WIDTH, chamberBack + 0.01, -Math.PI / 2],
    [CHAMBER_HALF_WIDTH, chamberBack + 0.01, Math.PI],
  ] as const) {
    const y = z === -0.01 ? HEIGHT : CHAMBER_HEIGHT
    add(new THREE.Mesh(new THREE.CircleGeometry(1.1, 10, start, Math.PI / 2), web), x, y, z)
  }

  // Puddles of standing water.
  const water = new THREE.MeshStandardMaterial({ color: '#0b0d0f', metalness: 0.9, roughness: 0.12 })
  for (const [x, z, r] of [
    [-1, -5, 0.5],
    [1.4, -11, 0.7],
    [-0.6, -17.5, 0.4],
    [2, -28, 0.8],
  ] as const) {
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(r, 16), water)
    puddle.rotation.x = -Math.PI / 2
    puddle.scale.set(1.5, 1, 1)
    add(puddle, x, 0.005, z)
  }

  // The chamber.
  for (const side of [-1, 1]) {
    const frontWidth = CHAMBER_HALF_WIDTH + 0.3 - CORRIDOR_HALF_WIDTH
    add(box(frontWidth, CHAMBER_HEIGHT, 0.6, m.stone), side * (CORRIDOR_HALF_WIDTH + frontWidth / 2), CHAMBER_HEIGHT / 2, CHAMBER_FRONT)
    add(box(0.6, CHAMBER_HEIGHT, chamberDepth, m.stone), side * (CHAMBER_HALF_WIDTH + 0.3), CHAMBER_HEIGHT / 2, CHAMBER_FRONT - chamberDepth / 2)
  }
  add(box(CORRIDOR_HALF_WIDTH * 2, CHAMBER_HEIGHT - HEIGHT, 0.6, m.stone), 0, (CHAMBER_HEIGHT + HEIGHT) / 2, CHAMBER_FRONT)
  add(box(CHAMBER_HALF_WIDTH * 2 + 1.2, CHAMBER_HEIGHT, 0.6, m.stone), 0, CHAMBER_HEIGHT / 2, chamberBack - 0.3)

  // The brazier, cage and block stay near the entrance however long the chamber grows.
  const chamberMid = CHAMBER_FRONT - CHAMBER_MIN_DEPTH / 2
  const brazier = createBrazier(m)
  add(brazier.group, 0, 0, chamberMid)
  const brazierLight = add(new THREE.PointLight('#ff4a1a', 6, 12, 1.5), 0, 1.6, chamberMid) as THREE.PointLight
  const cage = createCage(m)
  add(cage, -3.4, CHAMBER_HEIGHT, chamberMid - 1.5)
  const block = createChoppingBlock(m)
  add(block, 3.4, 0, chamberMid - 1)
  const shackled = createSkeleton(m, true)
  add(shackled, 0, 0, chamberBack + 0.25)
  for (const x of [-2.5, 2.5]) add(createChain(m.iron, 16), x, 3.6, chamberBack + 0.08)
  add(createBones(m, random, 7), -2, 0, chamberBack + 1.2)

  // The private notes hang along the chamber walls, which grow with them; the desk stands at the back.
  const interactables: Interactable[] = []
  notes.forEach((note, index) => {
    const side = index % 2 === 0 ? -1 : 1
    const painting = createPainting(note, '#5a4630')
    painting.rotation.y = (-side * Math.PI) / 2
    add(painting, side * (CHAMBER_HALF_WIDTH - 0.05), 2, CHAMBER_FRONT - 1.6 - Math.floor(index / 2) * NOTE_SPACING)
    interactables.push({ object: painting, label: note.title, action: { kind: 'read', post: note } })
  })
  const desk = createDesk('#3a2a1c')
  add(desk, 3, 0, chamberBack + 1.6)
  interactables.push({ object: desk, label: 'Write a private note', action: { kind: 'new', isPrivate: true } })
  // A torch for every stretch of chamber beyond the brazier's reach.
  for (let z = chamberMid - 8, side = 1; z > chamberBack + 2; z -= 8, side = -side) {
    add(box(0.12, 0.35, 0.12, m.iron), side * (CHAMBER_HALF_WIDTH - 0.1), 3, z)
    flames.push(add(new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 6), m.flame), side * (CHAMBER_HALF_WIDTH - 0.1), 3.3, z) as THREE.Mesh)
    torches.push(add(new THREE.PointLight('#ff7a30', 3, 12, 1.4), side * (CHAMBER_HALF_WIDTH - 1), 3.3, z) as THREE.PointLight)
  }

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
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(STAIR_HALF_WIDTH * 2 - 0.4, 2.6), new THREE.MeshBasicMaterial({ color: '#4a2c12' }))
  glow.rotation.y = Math.PI
  add(glow, 0, STAIR_STEPS * STAIR_RISE + 1.3, stairTop - 0.01)
  add(new THREE.PointLight('#ff9a3c', 2.5, 7, 1.6), 0, STAIR_STEPS * STAIR_RISE + 1, stairTop - 1)

  const arrival = { position: new THREE.Vector3(0, EYE_HEIGHT, -2.5), yaw: 0 }
  let blinkAt = 3
  return {
    name: 'dungeon',
    scene,
    spawn: arrival,
    arrivals: { castle: arrival },
    interactables,
    portals: [{ position: new THREE.Vector3(0, EYE_HEIGHT, 0.4), radius: 1.2, to: 'castle' }],
    clamp(position) {
      position.z = THREE.MathUtils.clamp(position.z, chamberBack + 0.6, -0.3)
      position.x = THREE.MathUtils.clamp(position.x, -CHAMBER_HALF_WIDTH + 0.6, CHAMBER_HALF_WIDTH - 0.6)
      // Outside the chamber only the corridor is open: push out along the shallower side.
      const intoSide = Math.abs(position.x) - WALK_HALF_WIDTH
      const intoWall = position.z - CHAMBER_WALK_FRONT
      if (intoSide > 0 && intoWall > 0) {
        if (intoWall < intoSide) position.z = CHAMBER_WALK_FRONT
        else position.x = Math.sign(position.x) * WALK_HALF_WIDTH
      }
      position.y = Math.min(position.y, HEIGHT - 0.3)
    },
    update(_dt, elapsed) {
      torches.forEach((torch, index) => {
        torch.intensity = 4.5 + Math.sin(elapsed * 11 + index * 2.3) * 0.6 + random() * 0.9
        flames[index]!.scale.y = 0.85 + random() * 0.3
      })
      brazierLight.intensity = 5 + Math.sin(elapsed * 3) * 1.2 + random()
      for (const coal of brazier.flames) coal.scale.y = 0.7 + random() * 0.6
      cage.rotation.z = Math.sin(elapsed * 0.7) * 0.06
      if (eyes) {
        if (elapsed > blinkAt) blinkAt = elapsed + 2.5 + random() * 4
        eyes.visible = blinkAt - elapsed > 0.18
      }
    },
    dispose: () => disposeObject(scene),
  }
}

// Each cell is built facing +z, with its back against the wall at z = 0.
function furnishCell(kind: CellKind, side: -1 | 1, m: Materials, random: () => number) {
  const cell = new THREE.Group()
  const chainX = side === 1 ? -1.2 : 1.2
  switch (kind) {
    case 'skeleton':
      cell.add(createSkeleton(m, random() < 0.5))
      break
    case 'chains': {
      for (const x of [-0.5, 0.5]) {
        const chain = createChain(m.iron, 12)
        chain.position.set(x, 2.8, 0.06)
        cell.add(chain)
      }
      const skull = createSkull(m.bone, m.socket)
      skull.position.set(0.8, 0.12, 1.4)
      skull.rotation.set(0.2, -0.6, 0.3)
      cell.add(skull)
      break
    }
    case 'straw': {
      for (let i = 0; i < 4; i++) {
        const heap = new THREE.Mesh(new THREE.BoxGeometry(0.9 + random() * 0.5, 0.15, 0.6 + random() * 0.4), m.straw)
        heap.position.set(-0.6 + random() * 1.2, 0.07, 0.5 + random() * 1.2)
        heap.rotation.y = random() * Math.PI
        cell.add(heap)
      }
      const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.35, 10, 1, true), m.wood)
      bucket.position.set(1.1, 0.17, 2)
      cell.add(bucket)
      break
    }
    case 'bones':
      cell.add(createBones(m, random, 6))
      break
    case 'eyes': {
      // Something waits in the dark at the back of this cell.
      const eyes = new THREE.Group()
      eyes.name = 'eyes'
      const glow = new THREE.MeshBasicMaterial({ color: '#ff2a1a', fog: false })
      for (const x of [-0.09, 0.09]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), glow)
        eye.position.set(x, 0, 0)
        eyes.add(eye)
      }
      eyes.position.set(-0.875, 1.1, 0.6)
      cell.add(eyes)
      break
    }
  }
  const hook = createChain(m.iron, 8)
  hook.position.set(chainX, 3.2, 0.06)
  cell.add(hook)
  return cell
}

export function createSkull(bone: THREE.Material, socket: THREE.Material) {
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

function createBrazier(m: Materials) {
  const group = new THREE.Group()
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 6), m.iron)
    leg.position.set(Math.cos(angle) * 0.35, 0.5, Math.sin(angle) * 0.35)
    leg.rotation.set(Math.sin(angle) * 0.25, 0, -Math.cos(angle) * 0.25)
    group.add(leg)
  }
  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.35, 0.35, 14, 1, true),
    new THREE.MeshStandardMaterial({ color: '#26262a', metalness: 0.7, roughness: 0.55, side: THREE.DoubleSide }),
  )
  bowl.position.y = 1.1
  group.add(bowl)
  const coals = new THREE.MeshBasicMaterial({ color: '#ff3a10' })
  const fire = new THREE.MeshBasicMaterial({ color: '#ff7a1a', transparent: true, opacity: 0.85 })
  const flames: THREE.Mesh[] = []
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2
    const coal = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), coals)
    coal.position.set(Math.cos(angle) * 0.3, 1.2, Math.sin(angle) * 0.3)
    group.add(coal)
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5, 6), fire)
    flame.position.set(Math.cos(angle) * 0.18, 1.45, Math.sin(angle) * 0.18)
    flames.push(flame)
    group.add(flame)
  }
  return { group, flames }
}

// An iron cage on a chain, with what is left of its last occupant.
function createCage(m: Materials) {
  const cage = new THREE.Group()
  const chain = createChain(m.iron, 20)
  cage.add(chain)
  const top = -1.45
  const height = 1.7
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, height, 6), m.iron)
    rod.position.set(Math.cos(angle) * 0.6, top - height / 2, Math.sin(angle) * 0.6)
    cage.add(rod)
  }
  for (const y of [top, top - height]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.03, 6, 24), m.iron)
    ring.rotation.x = Math.PI / 2
    ring.position.y = y
    cage.add(ring)
  }
  const base = new THREE.Mesh(new THREE.CircleGeometry(0.6, 16), m.iron)
  base.rotation.x = -Math.PI / 2
  base.position.y = top - height
  const skull = createSkull(m.bone, m.socket)
  skull.position.set(0.1, top - height + 0.12, 0.1)
  skull.rotation.set(0.3, 1.2, 0.2)
  cage.add(base, skull)
  return cage
}

function createChoppingBlock(m: Materials) {
  const group = new THREE.Group()
  const block = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.65, 12), m.wood)
  block.position.y = 0.32
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.95, 6), m.wood)
  handle.position.set(0.15, 0.95, 0)
  handle.rotation.z = -0.5
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.03), m.iron)
  blade.position.set(-0.05, 0.66, 0)
  blade.rotation.z = -0.5
  const stain = new THREE.Mesh(
    new THREE.CircleGeometry(0.7, 16),
    new THREE.MeshStandardMaterial({ color: '#2a0505', roughness: 0.4 }),
  )
  stain.rotation.x = -Math.PI / 2
  stain.scale.set(1.4, 1, 1)
  stain.position.y = 0.006
  group.add(block, handle, blade, stain)
  return group
}
