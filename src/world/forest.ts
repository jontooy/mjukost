import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { createBlankPainting, createOfflinePainting, createPainting, createPendingPainting, disposeObject, postWall, type PostWall } from '@/world/props'
import { DOOR_HALF_WIDTH, DOOR_HEIGHT, createDoorLeaf, swingDoorLeaf } from '@/world/door'
import { EYE_HEIGHT, type Interactable, type World } from '@/world/engine'
import { createGuard } from '@/world/guard'
import { seededRandom } from '@/lib/random'
import { surface } from '@/ascii/surfaces'

const FOG_COLOR = '#9aa58c'
const PATH_EDGE = 2.6
const ROAD_START = 8 // the first row of posters, just past the gate
const ROW_SPACING = 3
const ROWS_AROUND = 20 // rows kept built on each side of the viewer; the fog hides the rest
const ROAD_LENGTH = 400
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
// Two guards flank the gate, close enough that their crossed spears bar the doorway.
const GATE_GUARDS = [-1, 1].map((side) => ({ x: side * (DOOR_HALF_WIDTH + 0.5), z: 2 }))
const GUARD_FACE_HEIGHT = 2.3
// Round obstacles outside the castle box: corner towers and the guards.
const PILLARS = [
  ...CORNER_TOWERS.map((tower) => ({ ...tower, radius: CORNER_TOWER_RADIUS })),
  ...GATE_GUARDS.map((guard) => ({ ...guard, radius: 0.35 })),
]
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

// Posters show '...' until setPosts hangs the posts; if those could not be loaded, every poster
// is a crossed-out mjukost.
export function createForest(options: { signedIn: boolean }): World {
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

  // The road runs from the castle gate outward forever; its surface follows the viewer.
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(3, ROAD_LENGTH),
    new THREE.MeshStandardMaterial({ color: '#6e5a40', roughness: 1, ...surface('dirt') }),
  )
  road.rotation.x = -Math.PI / 2
  road.position.y = 0.01
  road.receiveShadow = true
  scene.add(road)

  const woods = createWoods(scene, sun)

  // A poster stands at every place along the road, two to a row, from the gate outward without
  // end: in each row the right one, as seen walking away from the castle, is the lower slot. A
  // post hangs on the poster of its slot; the rest are empty, and a signed-in visitor can write
  // on any of them. Only rows near the viewer exist.
  let wall: PostWall = 'pending'
  const rows = new Map<number, { group: THREE.Group; interactables: Interactable[] }>()
  const interactables: Interactable[] = []

  function buildRow(row: number) {
    const group = new THREE.Group()
    const found: Interactable[] = []
    for (const side of [-1, 1] as const) {
      const slot = row * 2 + (side === -1 ? 0 : 1)
      const post = wall instanceof Map ? wall.get(slot) : undefined
      const poster =
        wall === 'pending'
          ? createPendingPainting('#8a6a3a')
          : wall === 'offline'
            ? createOfflinePainting('#8a6a3a')
            : post
              ? createPainting(post, '#8a6a3a')
              : createBlankPainting('#8a6a3a')
      poster.position.y = 1.6
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.06, 1.2, 6),
        new THREE.MeshStandardMaterial({ color: '#4a3a28', roughness: 0.9, ...surface('pole') }),
      )
      pole.position.y = 0.6
      pole.castShadow = true
      const stand = new THREE.Group()
      stand.add(poster, pole)
      stand.position.set(side * PATH_EDGE, 0, ROAD_START + row * ROW_SPACING)
      stand.rotation.y = (-side * Math.PI) / 2
      group.add(stand)
      if (post) found.push({ object: poster, label: post.title || 'Untitled', action: { kind: 'read', post } })
      else if (wall instanceof Map && options.signedIn) {
        found.push({ object: poster, label: 'Write a post here', action: { kind: 'new', isPrivate: false, slot } })
      }
    }
    return { group, interactables: found }
  }

  function sync(viewerZ: number) {
    const current = Math.floor((viewerZ - ROAD_START) / ROW_SPACING)
    const first = Math.max(0, current - ROWS_AROUND)
    const last = current + ROWS_AROUND
    for (const [index, row] of rows) {
      if (index >= first && index <= last) continue
      scene.remove(row.group)
      disposeObject(row.group)
      rows.delete(index)
    }
    for (let index = first; index <= last; index++) {
      if (rows.has(index)) continue
      const row = buildRow(index)
      scene.add(row.group)
      rows.set(index, row)
    }
    interactables.length = 0
    for (const row of rows.values()) interactables.push(...row.interactables)
    road.position.z = Math.max(ROAD_LENGTH / 2, viewerZ)
  }

  scene.add(createCastleGate(options.signedIn))

  const fireflies = createFireflies(seededRandom(WORLD_SEED))
  scene.add(fireflies.points)

  const spawn = { position: new THREE.Vector3(0, EYE_HEIGHT, 5), yaw: Math.PI }
  sync(spawn.position.z)
  let syncedRow = NaN
  return {
    name: 'forest',
    scene,
    spawn,
    arrivals: { castle: { position: new THREE.Vector3(0, EYE_HEIGHT, 4), yaw: Math.PI } },
    interactables,
    // Signed-out visitors are stopped a step before the guards and turned to the right one, who speaks.
    portals: [
      {
        position: new THREE.Vector3(0, EYE_HEIGHT, 0.75),
        radius: 1.3,
        to: 'castle',
        dialogue: options.signedIn
          ? undefined
          : {
              id: 'gateGuards',
              stand: new THREE.Vector3(0, EYE_HEIGHT, GATE_GUARDS[1]!.z + 1),
              lookAt: new THREE.Vector3(GATE_GUARDS[1]!.x, GUARD_FACE_HEIGHT, GATE_GUARDS[1]!.z),
            },
      },
    ],
    clamp(position) {
      pushOutOfCastle(position)
      woods.collide(position)
    },
    update(_dt, elapsed, viewer) {
      woods.refresh(viewer)
      fireflies.tick(elapsed, viewer)
      const row = Math.floor((viewer.z - ROAD_START) / ROW_SPACING)
      if (row !== syncedRow) {
        syncedRow = row
        sync(viewer.z)
      }
    },
    setPosts(posts) {
      wall = postWall(posts)
      for (const row of rows.values()) {
        scene.remove(row.group)
        disposeObject(row.group)
      }
      rows.clear()
      interactables.length = 0
      syncedRow = NaN
    },
    dispose: () => disposeObject(scene),
  }
}

// Trees and ground are generated per chunk from a hash of the chunk coordinates, so any
// place in the forest looks the same every visit. Only chunks around the viewer exist.
function createWoods(scene: THREE.Scene, sun: THREE.DirectionalLight) {
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.55, 1, 1, 8).translate(0, 0.5, 0),
    new THREE.MeshStandardMaterial({ color: '#3d2e1e', roughness: 1, ...surface('pole') }),
    TREE_CAPACITY,
  )
  const crowns = new THREE.InstancedMesh(
    crownGeometry(),
    new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, flatShading: true, ...surface('foliage') }),
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
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, ...surface('grass') }),
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
          const trees = chunks.get(key) ?? chunkTrees(x, z)
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
function chunkTrees(cx: number, cz: number): Tree[] {
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
      if (hasGiant && !inClearing(giant)) trees.push(giant)
      const crowded =
        hasGiant && Math.hypot(sapling.x - giant.x, sapling.z - giant.z) < giant.trunkRadius + 1.5
      if (hasSapling && !crowded && !inClearing(sapling)) trees.push(sapling)
    }
  }
  return trees
}

// Open ground around the castle, and along the road, which runs from the gate on forever.
function inClearing(tree: Tree) {
  const nearCastle = Math.abs(tree.x) < 24 && tree.z > -2 * CASTLE_HALF - 10 && tree.z < 6
  const nearRoad = Math.abs(tree.x) < 6 + tree.trunkRadius && tree.z > -2
  return nearCastle || nearRoad
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
  for (const pillar of PILLARS) {
    const dx = position.x - pillar.x
    const dz = position.z - pillar.z
    const reach = pillar.radius + 0.5
    const distance = Math.hypot(dx, dz)
    if (distance >= reach || distance === 0) continue
    position.x = pillar.x + (dx / distance) * reach
    position.z = pillar.z + (dz / distance) * reach
  }
}

function createCastleGate(open: boolean) {
  const castle = new THREE.Group()
  const stone = new THREE.MeshStandardMaterial({
    color: '#7d7a70',
    roughness: 0.95,
    flatShading: true,
    ...surface('stone'),
  })
  const roof = new THREE.MeshStandardMaterial({
    color: '#3f3a4a',
    roughness: 0.8,
    flatShading: true,
    ...surface('roof'),
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
    new THREE.MeshStandardMaterial({ color: '#6f6a5e', roughness: 1, ...surface('floor') }),
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

  // A short roofed passage behind the gate hides the dark hall from the courtyard.
  // It is wider than the doorway so the open leaves do not clip into its walls.
  const passageHalf = DOOR_HALF_WIDTH + 0.3
  const passageDepth = 1.6
  const passageZ = -0.75 - passageDepth / 2
  const hall = new THREE.Mesh(
    new THREE.PlaneGeometry(passageHalf * 2, DOOR_HEIGHT),
    new THREE.MeshBasicMaterial({ color: '#070606' }),
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
  // A faint cold light, so the doors and passage stay readable without a warm glow from inside.
  const light = new THREE.PointLight('#8a96a8', 2, 8)
  light.position.set(0, 2.5, 2)
  // The gate stands open for signed-in visitors; for everyone else it stays shut behind the guards.
  for (const side of [-1, 1] as const) {
    const leaf = createDoorLeaf(side)
    swingDoorLeaf(leaf, side, open ? 1 : 0)
    castle.add(leaf)
  }
  castle.add(hall, light)
  for (const { x, z } of GATE_GUARDS) {
    const guard = createGuard()
    guard.position.set(x, 0, z)
    if (x < 0) guard.scale.x *= -1 // mirrored, so both spears are held on the inner side and cross
    castle.add(guard)
  }
  return castle
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
