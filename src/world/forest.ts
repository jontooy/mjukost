import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { Post } from '@/types/post'
import { CastleDoor, DOOR_HALF_WIDTH, DOOR_HEIGHT } from '@/world/door'
import { EYE_HEIGHT, type Interactable, type World } from '@/world/engine'
import { seededRandom } from '@/lib/random'
import { createDesk, createPainting, disposeObject } from '@/world/props'

const FOG_COLOR = '#9aa58c'
const PAINTING_SPACING = 2.4
const PATH_EDGE = 2.6
const WORLD_SEED = 7

const CHUNK_SIZE = 24
const CELL_SIZE = 6
const CELLS_PER_CHUNK = CHUNK_SIZE / CELL_SIZE
const VIEW_CHUNKS = 4
const TREE_CAPACITY = (2 * VIEW_CHUNKS + 1) ** 2 * CELLS_PER_CHUNK ** 2 * 2
const GIANT_CHANCE = 0.6
const SAPLING_CHANCE = 0.45
const TRUNK_CLEARANCE = 0.35

const GROUND_SEGMENT = 2
const GROUND_HALF = (VIEW_CHUNKS + 1) * CHUNK_SIZE

const SUN_OFFSET = new THREE.Vector3(-40, 60, 20)
const SHADOW_EXTENT = 56

const FIREFLY_COUNT = 160
const FIREFLY_RANGE = 40

// The castle is a square curtain wall with its gate at the origin, facing +z.
const CASTLE_HALF = DOOR_HALF_WIDTH + 12
const CASTLE_CENTER_Z = -CASTLE_HALF
const CORNER_TOWER_RADIUS = 1.9
const CORNER_TOWERS = [-1, 1].flatMap((side) => [
  { x: side * CASTLE_HALF, z: 0 },
  { x: side * CASTLE_HALF, z: -2 * CASTLE_HALF },
])
// The player stays outside this box and the corner towers that stick out of it.
const CASTLE_BOUNDS = {
  minX: -CASTLE_HALF - CORNER_TOWER_RADIUS - 0.5,
  maxX: CASTLE_HALF + CORNER_TOWER_RADIUS + 0.5,
  minZ: -2 * CASTLE_HALF - CORNER_TOWER_RADIUS - 0.5,
  maxZ: 1,
}

interface Tree {
  x: number
  z: number
  yaw: number
  height: number
  trunkRadius: number
  crownRadius: number
  crownBase: number
  hue: number
  lightness: number
}

export function createForest(posts: Post[], options: { signedIn: boolean }): World {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(FOG_COLOR)
  scene.fog = new THREE.FogExp2(FOG_COLOR, 0.03)

  scene.add(new THREE.HemisphereLight('#dfe8c8', '#3b3424', 1.2))
  const sun = new THREE.DirectionalLight('#ffe2b0', 1.6)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, {
    left: -SHADOW_EXTENT,
    right: SHADOW_EXTENT,
    top: SHADOW_EXTENT,
    bottom: -SHADOW_EXTENT,
    far: 200,
  })
  scene.add(sun, sun.target)

  const pathStart = Math.max(20, posts.length * PAINTING_SPACING + 10)
  const pathEnd = pathStart + 10

  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(3, pathEnd),
    new THREE.MeshStandardMaterial({ color: '#6e5a40', roughness: 1 }),
  )
  path.rotation.x = -Math.PI / 2
  path.position.set(0, 0.01, pathEnd / 2)
  path.receiveShadow = true
  scene.add(path)

  const woods = createWoods(scene, sun, pathEnd)

  const interactables: Interactable[] = []
  const standMaterial = new THREE.MeshStandardMaterial({ color: '#4a3a28', roughness: 0.9 })
  posts.forEach((post, index) => {
    const side = index % 2 === 0 ? -1 : 1
    const stand = new THREE.Group()
    const painting = createPainting(post, '#8a6a3a')
    painting.position.y = 1.6
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.2, 6), standMaterial)
    pole.position.y = 0.6
    pole.castShadow = true
    stand.add(painting, pole)
    stand.position.set(side * PATH_EDGE, 0, pathStart - index * PAINTING_SPACING)
    stand.rotation.y = (-side * Math.PI) / 2
    scene.add(stand)
    interactables.push({ object: painting, label: post.title, action: { kind: 'read', post } })
  })

  if (options.signedIn) {
    const desk = createDesk('#5a4128')
    desk.position.set(2.2, 0, pathStart + 4)
    desk.rotation.y = -Math.PI / 2
    scene.add(desk)
    interactables.push({
      object: desk,
      label: 'Write a public post',
      action: { kind: 'new', isPrivate: false },
    })
  }

  const gate = createCastleGate(options.signedIn)
  scene.add(gate.castle)

  const fireflies = createFireflies(seededRandom(WORLD_SEED))
  scene.add(fireflies.points)

  return {
    name: 'forest',
    scene,
    spawn: { position: new THREE.Vector3(0, EYE_HEIGHT, pathStart + 8), yaw: 0 },
    arrivals: { castle: { position: new THREE.Vector3(0, EYE_HEIGHT, 4), yaw: Math.PI } },
    interactables,
    door: gate.door,
    portals: [{ position: new THREE.Vector3(0, EYE_HEIGHT, 0.75), radius: 1.3, to: 'castle' }],
    clamp(position) {
      pushOutOfCastle(position)
      woods.collide(position)
    },
    update(_dt, elapsed, viewer) {
      woods.refresh(viewer)
      fireflies.tick(elapsed, viewer)
    },
    dispose: () => disposeObject(scene),
  }
}

// Trees and ground are generated per chunk from a hash of the chunk coordinates, so any
// place in the forest looks the same every visit. Only chunks around the viewer exist.
function createWoods(scene: THREE.Scene, sun: THREE.DirectionalLight, pathEnd: number) {
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.55, 1, 1, 8).translate(0, 0.5, 0),
    new THREE.MeshStandardMaterial({ color: '#3d2e1e', roughness: 1 }),
    TREE_CAPACITY,
  )
  const crowns = new THREE.InstancedMesh(
    crownGeometry(),
    new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, flatShading: true }),
    TREE_CAPACITY,
  )
  for (const mesh of [trunks, crowns]) {
    mesh.castShadow = mesh.receiveShadow = true
    mesh.frustumCulled = false
  }

  const groundSegments = (GROUND_HALF * 2) / GROUND_SEGMENT
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(
      GROUND_HALF * 2,
      GROUND_HALF * 2,
      groundSegments,
      groundSegments,
    ).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
  )
  ground.receiveShadow = true
  const groundPositions = ground.geometry.attributes.position as THREE.BufferAttribute
  const groundColors = new THREE.BufferAttribute(new Float32Array(groundPositions.count * 3), 3)
  ground.geometry.setAttribute('color', groundColors)
  scene.add(ground, trunks, crowns)

  let chunks = new Map<number, Tree[]>()
  let currentX = NaN
  let currentZ = NaN
  const matrix = new THREE.Matrix4()
  const scale = new THREE.Vector3()
  const color = new THREE.Color()

  function writeTree(index: number, tree: Tree) {
    const trunkHeight = tree.crownBase + (tree.height - tree.crownBase) * 0.5
    scale.set(tree.trunkRadius, trunkHeight, tree.trunkRadius)
    trunks.setMatrixAt(
      index,
      matrix.makeRotationY(tree.yaw).scale(scale).setPosition(tree.x, 0, tree.z),
    )
    scale.set(tree.crownRadius, tree.height - tree.crownBase, tree.crownRadius)
    matrix.makeRotationY(tree.yaw).scale(scale).setPosition(tree.x, tree.crownBase, tree.z)
    crowns.setMatrixAt(index, matrix)
    crowns.setColorAt(index, color.setHSL(tree.hue, 0.35, tree.lightness))
  }

  function colorGround() {
    for (let i = 0; i < groundPositions.count; i++) {
      const gx = Math.round((ground.position.x + groundPositions.getX(i)) / GROUND_SEGMENT)
      const gz = Math.round((ground.position.z + groundPositions.getZ(i)) / GROUND_SEGMENT)
      const random = seededRandom(hash(gx, gz))
      color.setHSL(0.22 + random() * 0.05, 0.3, 0.22 + random() * 0.08)
      groundColors.setXYZ(i, color.r, color.g, color.b)
    }
    groundColors.needsUpdate = true
  }

  return {
    refresh(viewer: THREE.Vector3) {
      const cx = Math.floor(viewer.x / CHUNK_SIZE)
      const cz = Math.floor(viewer.z / CHUNK_SIZE)
      if (cx === currentX && cz === currentZ) return
      currentX = cx
      currentZ = cz

      const next = new Map<number, Tree[]>()
      let count = 0
      for (let x = cx - VIEW_CHUNKS; x <= cx + VIEW_CHUNKS; x++) {
        for (let z = cz - VIEW_CHUNKS; z <= cz + VIEW_CHUNKS; z++) {
          const key = chunkKey(x, z)
          const trees = chunks.get(key) ?? chunkTrees(x, z, pathEnd)
          next.set(key, trees)
          for (const tree of trees) writeTree(count++, tree)
        }
      }
      chunks = next
      trunks.count = crowns.count = count
      trunks.instanceMatrix.needsUpdate = crowns.instanceMatrix.needsUpdate = true
      crowns.instanceColor!.needsUpdate = true

      ground.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE)
      colorGround()
      sun.target.position.copy(ground.position)
      sun.position.copy(ground.position).add(SUN_OFFSET)
    },
    collide(position: THREE.Vector3) {
      const cx = Math.floor(position.x / CHUNK_SIZE)
      const cz = Math.floor(position.z / CHUNK_SIZE)
      for (let x = cx - 1; x <= cx + 1; x++) {
        for (let z = cz - 1; z <= cz + 1; z++) {
          for (const tree of chunks.get(chunkKey(x, z)) ?? []) {
            if (position.y < 0 || position.y - EYE_HEIGHT > tree.height) continue
            const dx = position.x - tree.x
            const dz = position.z - tree.z
            const reach = tree.trunkRadius + TRUNK_CLEARANCE
            const distance = Math.hypot(dx, dz)
            if (distance >= reach || distance === 0) continue
            position.x = tree.x + (dx / distance) * reach
            position.z = tree.z + (dz / distance) * reach
          }
        }
      }
    },
  }
}

// One jittered giant and maybe one sapling per cell. Every cell consumes the same amount of
// randomness, so the clearing filter never shifts the rest of the chunk.
function chunkTrees(cx: number, cz: number, pathEnd: number): Tree[] {
  const random = seededRandom(hash(cx, cz))
  const trees: Tree[] = []
  for (let i = 0; i < CELLS_PER_CHUNK; i++) {
    for (let j = 0; j < CELLS_PER_CHUNK; j++) {
      const cellX = cx * CHUNK_SIZE + i * CELL_SIZE
      const cellZ = cz * CHUNK_SIZE + j * CELL_SIZE
      const hasGiant = random() < GIANT_CHANCE
      const height = 18 + random() * 22
      const giant: Tree = {
        x: cellX + (0.15 + random() * 0.7) * CELL_SIZE,
        z: cellZ + (0.15 + random() * 0.7) * CELL_SIZE,
        yaw: random() * Math.PI * 2,
        height,
        trunkRadius: height * 0.025 + random() * 0.3,
        crownRadius: height * (0.14 + random() * 0.06),
        crownBase: height * (0.3 + random() * 0.15),
        hue: 0.25 + random() * 0.08,
        lightness: 0.14 + random() * 0.08,
      }
      const hasSapling = random() < SAPLING_CHANCE
      const saplingHeight = 3 + random() * 4
      const sapling: Tree = {
        x: cellX + random() * CELL_SIZE,
        z: cellZ + random() * CELL_SIZE,
        yaw: random() * Math.PI * 2,
        height: saplingHeight,
        trunkRadius: 0.12 + random() * 0.08,
        crownRadius: saplingHeight * 0.3,
        crownBase: saplingHeight * 0.3,
        hue: 0.25 + random() * 0.08,
        lightness: 0.2 + random() * 0.1,
      }
      if (hasGiant && !inClearing(giant, pathEnd)) trees.push(giant)
      const crowded =
        hasGiant && Math.hypot(sapling.x - giant.x, sapling.z - giant.z) < giant.trunkRadius + 1.5
      if (hasSapling && !crowded && !inClearing(sapling, pathEnd)) trees.push(sapling)
    }
  }
  return trees
}

function inClearing(tree: Tree, pathEnd: number) {
  const nearCastle = Math.abs(tree.x) < 24 && tree.z > -2 * CASTLE_HALF - 10 && tree.z < 6
  const nearPath = Math.abs(tree.x) < 6 + tree.trunkRadius && tree.z > -2 && tree.z < pathEnd + 6
  return nearCastle || nearPath
}

function crownGeometry() {
  const tiers = [
    { radius: 1, height: 0.55, base: 0 },
    { radius: 0.75, height: 0.5, base: 0.3 },
    { radius: 0.5, height: 0.4, base: 0.6 },
  ]
  const parts = tiers.map((tier) =>
    new THREE.ConeGeometry(tier.radius, tier.height, 8).translate(
      0,
      tier.base + tier.height / 2,
      0,
    ),
  )
  const merged = mergeGeometries(parts)
  for (const part of parts) part.dispose()
  return merged
}

function chunkKey(cx: number, cz: number) {
  return cx * 65536 + cz
}

function hash(x: number, z: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ WORLD_SEED
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return (h ^ (h >>> 16)) >>> 0
}

function pushOutOfCastle(position: THREE.Vector3) {
  const { minX, maxX, minZ, maxZ } = CASTLE_BOUNDS
  const inside = position.x > minX && position.x < maxX && position.z > minZ && position.z < maxZ
  if (inside) {
    const front = maxZ - position.z
    const back = position.z - minZ
    const left = position.x - minX
    const right = maxX - position.x
    const nearest = Math.min(front, back, left, right)
    if (nearest === front) position.z = maxZ
    else if (nearest === back) position.z = minZ
    else if (nearest === left) position.x = minX
    else position.x = maxX
  }
  for (const tower of CORNER_TOWERS) {
    const dx = position.x - tower.x
    const dz = position.z - tower.z
    const reach = CORNER_TOWER_RADIUS + 0.5
    const distance = Math.hypot(dx, dz)
    if (distance >= reach || distance === 0) continue
    position.x = tower.x + (dx / distance) * reach
    position.z = tower.z + (dz / distance) * reach
  }
}

function createCastleGate(open: boolean) {
  const castle = new THREE.Group()
  const stone = new THREE.MeshStandardMaterial({
    color: '#7d7a70',
    roughness: 0.95,
    flatShading: true,
  })
  const roof = new THREE.MeshStandardMaterial({
    color: '#3f3a4a',
    roughness: 0.8,
    flatShading: true,
  })
  const add = (mesh: THREE.Mesh, x: number, y: number, z: number) => {
    mesh.position.set(x, y, z)
    mesh.castShadow = mesh.receiveShadow = true
    castle.add(mesh)
  }

  const wallHeight = 7
  const span = CASTLE_HALF * 2
  const wallSegment = CASTLE_HALF - DOOR_HALF_WIDTH
  for (const side of [-1, 1]) {
    add(
      new THREE.Mesh(new THREE.BoxGeometry(wallSegment, wallHeight, 1.5), stone),
      side * (DOOR_HALF_WIDTH + wallSegment / 2),
      wallHeight / 2,
      0,
    )
    add(
      new THREE.Mesh(new THREE.BoxGeometry(1.5, wallHeight, span), stone),
      side * CASTLE_HALF,
      wallHeight / 2,
      CASTLE_CENTER_Z,
    )
  }
  add(new THREE.Mesh(new THREE.BoxGeometry(span, wallHeight, 1.5), stone), 0, wallHeight / 2, -span)
  add(
    new THREE.Mesh(
      new THREE.BoxGeometry(DOOR_HALF_WIDTH * 2, wallHeight - DOOR_HEIGHT, 1.5),
      stone,
    ),
    0,
    (wallHeight + DOOR_HEIGHT) / 2,
    0,
  )

  const courtyard = new THREE.Mesh(
    new THREE.PlaneGeometry(span, span),
    new THREE.MeshStandardMaterial({ color: '#6f6a5e', roughness: 1 }),
  )
  courtyard.rotation.x = -Math.PI / 2
  courtyard.position.set(0, 0.02, CASTLE_CENTER_Z)
  courtyard.receiveShadow = true
  castle.add(courtyard)

  for (const { x, z } of CORNER_TOWERS) {
    add(
      new THREE.Mesh(new THREE.CylinderGeometry(1.6, CORNER_TOWER_RADIUS, 11, 8), stone),
      x,
      5.5,
      z,
    )
    add(new THREE.Mesh(new THREE.ConeGeometry(2.1, 3.5, 8), roof), x, 12.75, z)
  }

  // A pair of towers in the middle of every wall; the front pair flanks the gate.
  const pairOffset = DOOR_HALF_WIDTH + 1.5
  for (const side of [-1, 1]) {
    for (const [x, z] of [
      [side * pairOffset, 0],
      [side * pairOffset, -span],
      [-CASTLE_HALF, CASTLE_CENTER_Z + side * pairOffset],
      [CASTLE_HALF, CASTLE_CENTER_Z + side * pairOffset],
    ] as const) {
      add(new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 10, 8), stone), x, 5, z)
      add(new THREE.Mesh(new THREE.ConeGeometry(1.5, 3, 8), roof), x, 11.5, z)
    }
  }

  // Battlements along all four walls, clear of the towers.
  for (let i = -7; i <= 7; i++) {
    if (Math.abs(i) <= 2) continue
    const t = i * 1.6
    const y = wallHeight + 0.4
    add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 1.5), stone), t, y, 0)
    add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 1.5), stone), t, y, -span)
    add(
      new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 0.8), stone),
      -CASTLE_HALF,
      y,
      CASTLE_CENTER_Z + t,
    )
    add(
      new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 0.8), stone),
      CASTLE_HALF,
      y,
      CASTLE_CENTER_Z + t,
    )
  }

  const keepHalf = 6
  add(
    new THREE.Mesh(new THREE.BoxGeometry(keepHalf * 2, 12, keepHalf * 2), stone),
    0,
    6,
    CASTLE_CENTER_Z,
  )
  for (const x of [-keepHalf, keepHalf]) {
    for (const z of [CASTLE_CENTER_Z - keepHalf, CASTLE_CENTER_Z + keepHalf]) {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1, 14, 8), stone), x, 7, z)
      add(new THREE.Mesh(new THREE.ConeGeometry(1.3, 2.5, 8), roof), x, 15.25, z)
    }
  }
  add(new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 22, 8), stone), 0, 11, CASTLE_CENTER_Z)
  add(new THREE.Mesh(new THREE.ConeGeometry(3.2, 6, 8), roof), 0, 25, CASTLE_CENTER_Z)

  const door = new CastleDoor(open)
  // A short roofed passage behind the gate hides the glowing hall from the courtyard.
  // It is wider than the doorway so the open leaves do not clip into its walls.
  const passageHalf = DOOR_HALF_WIDTH + 0.3
  const passageDepth = 1.6
  const passageZ = -0.75 - passageDepth / 2
  const hall = new THREE.Mesh(
    new THREE.PlaneGeometry(passageHalf * 2, DOOR_HEIGHT),
    new THREE.MeshBasicMaterial({ color: '#ffb070' }),
  )
  hall.position.set(0, DOOR_HEIGHT / 2, -1.9)
  for (const side of [-1, 1]) {
    add(
      new THREE.Mesh(new THREE.BoxGeometry(0.8, wallHeight, passageDepth), stone),
      side * (passageHalf + 0.4),
      wallHeight / 2,
      passageZ,
    )
  }
  add(
    new THREE.Mesh(
      new THREE.BoxGeometry(passageHalf * 2 + 1.6, wallHeight - DOOR_HEIGHT, passageDepth),
      stone,
    ),
    0,
    (wallHeight + DOOR_HEIGHT) / 2,
    passageZ,
  )
  const light = new THREE.PointLight('#ffd9a0', 6, 10)
  light.position.set(0, 2.5, 2)
  castle.add(door.group, hall, light)
  return { castle, door }
}

// Fireflies live in a box that wraps around the viewer, so they are everywhere you walk.
function createFireflies(random: () => number) {
  const base: number[] = []
  for (let i = 0; i < FIREFLY_COUNT; i++) {
    base.push(random() * FIREFLY_RANGE, 0.5 + random() * 3, random() * FIREFLY_RANGE)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(base, 3))
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: '#fff3a0',
      size: 0.08,
      transparent: true,
      opacity: 0.85,
      fog: false,
    }),
  )
  points.frustumCulled = false
  const positions = geometry.attributes.position as THREE.BufferAttribute
  const half = FIREFLY_RANGE / 2
  const wrap = (value: number, center: number) =>
    center + THREE.MathUtils.euclideanModulo(value - center + half, FIREFLY_RANGE) - half
  return {
    points,
    tick(elapsed: number, viewer: THREE.Vector3) {
      for (let i = 0; i < FIREFLY_COUNT; i++) {
        const phase = i * 1.7
        positions.setXYZ(
          i,
          wrap(base[i * 3]! + Math.sin(elapsed * 0.6 + phase) * 0.6, viewer.x),
          base[i * 3 + 1]! + Math.sin(elapsed * 0.9 + phase * 2) * 0.3,
          wrap(base[i * 3 + 2]! + Math.cos(elapsed * 0.5 + phase) * 0.6, viewer.z),
        )
      }
      positions.needsUpdate = true
    },
  }
}
