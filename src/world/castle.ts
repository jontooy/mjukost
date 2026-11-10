import * as THREE from 'three'
import { EYE_HEIGHT, type World } from '@/world/engine'
import { CastleDoor, DOOR_HALF_WIDTH, DOOR_HEIGHT, createDoorLeaf, swingDoorLeaf } from '@/world/door'
import { seededRandom } from '@/lib/random'
import { MJUKOST_PROFILE } from '@/world/mjukost'
import { disposeObject } from '@/world/props'

const HALF_WIDTH = 9
const HEIGHT = 12
const NAVE_HALF_WIDTH = 5.5 // the two rows of columns
const BAY = 6 // distance between columns, beams, windows and torches
const DAIS_HALF_WIDTH = 5
const DAIS_DEPTH = 6
const DAIS_STEP = 0.3
const DAIS_STEPS = 3
// Same opening and passage depth as the gate seen from the forest.
const GATE_HALF_WIDTH = DOOR_HALF_WIDTH + 0.3
const GATE_DEPTH = 1.6
const LENGTH = 36
const DUNGEON_DOOR_X = 7.15 // in the back right corner, beside the dais
const DUNGEON_PASSAGE_HALF = DOOR_HALF_WIDTH + 0.3 // wide enough for the open leaves
const DUNGEON_PASSAGE_DEPTH = 1.8

// The throne room: a nave of columns and torches, a red carpet up to the king's throne on a dais.
// It is open to everyone; the private notes are below, behind the sealed dungeon door.
export function createCastle(options: { signedIn: boolean }): World {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#0d0b10')
  scene.fog = new THREE.Fog('#0d0b10', 14, 70)
  scene.add(new THREE.AmbientLight('#6a5a7a', 1.2))

  const centerZ = -LENGTH / 2
  const daisFront = -LENGTH + DAIS_DEPTH
  const stone = new THREE.MeshStandardMaterial({ color: '#5d5850', roughness: 0.95, flatShading: true })
  const gold = new THREE.MeshStandardMaterial({ color: '#c9a23f', metalness: 0.8, roughness: 0.35 })
  const velvet = new THREE.MeshStandardMaterial({ color: '#7a1020', roughness: 1 })
  const wood = new THREE.MeshStandardMaterial({ color: '#3a2414', roughness: 0.8, flatShading: true })
  const iron = new THREE.MeshStandardMaterial({ color: '#2b2b2e', metalness: 0.7, roughness: 0.5 })
  const random = seededRandom(11)
  const add = (mesh: THREE.Object3D, x: number, y: number, z: number) => {
    mesh.position.set(x, y, z)
    scene.add(mesh)
    return mesh
  }

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF_WIDTH * 2, LENGTH),
    new THREE.MeshStandardMaterial({ color: '#3b3632', roughness: 0.9 }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  add(floor, 0, 0, centerZ)
  const ceiling = floor.clone()
  ceiling.rotation.x = Math.PI / 2
  add(ceiling, 0, HEIGHT, centerZ)

  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.6, HEIGHT, LENGTH), stone)
    wall.receiveShadow = true
    add(wall, side * (HALF_WIDTH + 0.3), HEIGHT / 2, centerZ)
  }
  scene.add(createGate(stone))

  // The carpet runs from the gate to the dais, then up the steps to the throne.
  const carpetLength = -daisFront - 0.5
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(2.4, carpetLength), velvet)
  carpet.rotation.x = -Math.PI / 2
  carpet.receiveShadow = true
  add(carpet, 0, 0.01, -0.5 - carpetLength / 2)
  for (const side of [-1, 1]) {
    const border = new THREE.Mesh(new THREE.PlaneGeometry(0.12, carpetLength), gold)
    border.rotation.x = -Math.PI / 2
    add(border, side * 1.26, 0.012, -0.5 - carpetLength / 2)
  }

  // Wooden beams across the ceiling, one per bay.
  for (let z = -BAY / 2; z > -LENGTH; z -= BAY) {
    add(new THREE.Mesh(new THREE.BoxGeometry(HALF_WIDTH * 2, 0.6, 0.5), wood), 0, HEIGHT - 0.3, z)
  }

  // Columns with torches face the nave; tall moonlit windows sit high on the outer walls.
  const torches: THREE.PointLight[] = []
  const flameMaterial = new THREE.MeshBasicMaterial({ color: '#ffb347' })
  const moonlight = new THREE.MeshBasicMaterial({ color: '#34456b' })
  for (let z = -4; z > daisFront - 1; z -= BAY) {
    for (const side of [-1, 1]) {
      const x = side * NAVE_HALF_WIDTH
      const column = add(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, HEIGHT, 10), stone), x, HEIGHT / 2, z)
      column.castShadow = true
      add(new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.4, 1.3), stone), x, 0.2, z)
      add(new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.4, 1.3), stone), x, HEIGHT - 0.8, z)
      const flameX = side * (NAVE_HALF_WIDTH - 0.6)
      add(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.4, 0.15), iron), flameX, 2.8, z)
      add(new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 6), flameMaterial), flameX, 3.15, z)

      const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 3.6), moonlight)
      pane.rotation.y = (-side * Math.PI) / 2
      add(pane, side * (HALF_WIDTH - 0.01), 8.3, z - BAY / 2)
    }
    // One light per pair of torches keeps the hall fast to render.
    torches.push(add(new THREE.PointLight('#ff9a3c', 6, 16, 1.4), 0, 3.4, z) as THREE.PointLight)
  }

  // Chandeliers hang over the carpet.
  for (let z = -8; z > daisFront + 2; z -= BAY * 2) {
    scene.add(createChandelier(iron, flameMaterial, z))
  }

  // The dais rises in three steps against the back wall.
  for (let step = 0; step < DAIS_STEPS; step++) {
    const halfWidth = DAIS_HALF_WIDTH - step * 0.6
    const depth = DAIS_DEPTH - step * 0.8
    const height = DAIS_STEP * (step + 1)
    const block = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2, height, depth), stone)
    block.receiveShadow = true
    add(block, 0, height / 2, -LENGTH + depth / 2)
  }
  const daisTop = DAIS_STEP * DAIS_STEPS
  const runner = new THREE.Mesh(new THREE.PlaneGeometry(2.4, DAIS_DEPTH - 0.4), velvet)
  runner.rotation.x = -Math.PI / 2
  add(runner, 0, daisTop + 0.01, -LENGTH + (DAIS_DEPTH - 0.4) / 2)

  add(createThrone(wood, velvet, gold), 0, daisTop, -LENGTH + 2.2)

  // Royal banners on the back wall: a great one behind the throne and one to each side.
  // Matte, faintly glowing cloth and gilt: polished gold shows black with nothing to reflect.
  const bannerVelvet = new THREE.MeshStandardMaterial({ color: '#8a1424', emissive: '#2a0508', roughness: 1 })
  const gilt = new THREE.MeshStandardMaterial({ color: '#d8b04a', emissive: '#4a3408', roughness: 0.6 })
  for (const [x, width, height] of [
    [0, 3.2, 7],
    [-6.5, 2, 5.5],
    [6.5, 2, 5.5],
  ] as const) {
    add(createBanner(width, height, bannerVelvet, gilt), x, HEIGHT - 1, -LENGTH)
  }
  const throneLight = new THREE.PointLight('#ffd27a', 10, 14, 1.4)
  add(throneLight, 0, 6, -LENGTH + 4)

  // In the back right corner, the sealed door down to the dungeon, set into the back wall.
  const doorLeft = DUNGEON_DOOR_X - DUNGEON_PASSAGE_HALF
  const doorRight = DUNGEON_DOOR_X + DUNGEON_PASSAGE_HALF
  const wallEdge = HALF_WIDTH + 0.6
  const backWall = (from: number, to: number, bottom: number) =>
    add(new THREE.Mesh(new THREE.BoxGeometry(to - from, HEIGHT - bottom, 0.6), stone), (from + to) / 2, (HEIGHT + bottom) / 2, -LENGTH - 0.3)
  backWall(-wallEdge, doorLeft, 0)
  backWall(doorRight, wallEdge, 0)
  backWall(doorLeft, doorRight, DOOR_HEIGHT)
  const dungeonDoor = createDungeonDoor(stone, options.signedIn)
  add(dungeonDoor.group, DUNGEON_DOOR_X, 0, -LENGTH)

  return {
    name: 'castle',
    scene,
    // A signed-in visitor starts at the foot of the dais, facing the throne.
    spawn: { position: new THREE.Vector3(0, EYE_HEIGHT, daisFront + 3), yaw: 0 },
    arrivals: {
      forest: { position: new THREE.Vector3(0, EYE_HEIGHT, -3), yaw: 0 },
      dungeon: { position: new THREE.Vector3(DUNGEON_DOOR_X, EYE_HEIGHT, -LENGTH + 3), yaw: Math.PI },
    },
    interactables: [],
    door: dungeonDoor.door,
    portals: [
      { position: new THREE.Vector3(0, EYE_HEIGHT, 0), radius: 1.2, to: 'forest' },
      { position: new THREE.Vector3(DUNGEON_DOOR_X, EYE_HEIGHT, -LENGTH + 0.4), radius: 1, to: 'dungeon' },
    ],
    clamp(position) {
      position.x = THREE.MathUtils.clamp(position.x, -HALF_WIDTH + 0.8, HALF_WIDTH - 0.8)
      position.z = THREE.MathUtils.clamp(position.z, -LENGTH + 0.5, -0.3)
      // The dais is for the king: visitors are pushed back out along its nearer edge.
      const intoFront = daisFront + 0.6 - position.z
      const intoSide = DAIS_HALF_WIDTH + 0.6 - Math.abs(position.x)
      if (intoFront > 0 && intoSide > 0) {
        if (intoFront < intoSide) position.z = daisFront + 0.6
        else position.x = Math.sign(position.x || 1) * (DAIS_HALF_WIDTH + 0.6)
      }
      position.y = Math.min(position.y, HEIGHT - 0.3)
    },
    update(_dt, elapsed) {
      torches.forEach((torch, index) => {
        torch.intensity = 5 + Math.sin(elapsed * 9 + index * 3.1) * 0.8 + random() * 0.6
      })
    },
    dispose: () => disposeObject(scene),
  }
}

// A high-backed oak throne with a velvet seat and gold finials, facing the gate.
function createThrone(wood: THREE.Material, velvet: THREE.Material, gold: THREE.Material) {
  const throne = new THREE.Group()
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    throne.add(mesh)
    return mesh
  }
  add(new THREE.BoxGeometry(2, 0.3, 1.8), gold, 0, 0.15, 0)
  add(new THREE.BoxGeometry(1.4, 0.7, 1.1), wood, 0, 0.65, 0.05)
  add(new THREE.BoxGeometry(1.2, 0.16, 0.95), velvet, 0, 1.08, 0.1)
  add(new THREE.BoxGeometry(1.4, 3, 0.22), wood, 0, 1.8, -0.55)
  add(new THREE.BoxGeometry(1.05, 1.9, 0.06), velvet, 0, 1.85, -0.42)
  for (const side of [-1, 1]) {
    add(new THREE.BoxGeometry(0.2, 0.5, 1.1), wood, side * 0.8, 1.2, 0.05)
    add(new THREE.SphereGeometry(0.12, 12, 8), gold, side * 0.8, 1.5, 0.55)
    add(new THREE.SphereGeometry(0.16, 12, 8), gold, side * 0.62, 3.4, -0.55)
  }
  // A crown-like crest on top of the back.
  add(new THREE.CylinderGeometry(0.42, 0.36, 0.3, 12, 1, true), gold, 0, 3.45, -0.55)
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2
    add(new THREE.ConeGeometry(0.07, 0.25, 6), gold, Math.cos(angle) * 0.38, 3.72, -0.55 + Math.sin(angle) * 0.38)
  }
  return throne
}

// The tube outline with its top centre at the origin.
function mjukostShape(length: number) {
  const right = MJUKOST_PROFILE.map(([down, half]) => new THREE.Vector2(half * length, -down * length))
  const left = right.map((point) => new THREE.Vector2(-point.x, point.y)).reverse()
  return new THREE.Shape([...right, ...left])
}

// A velvet banner in a gold border on a gold rod, its emblem a gold mjukost tube with the cap down.
// Its top centre is the group's origin; it faces +z, a hair off the wall behind it.
function createBanner(width: number, height: number, velvet: THREE.Material, gold: THREE.Material) {
  const banner = new THREE.Group()
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, y: number, z: number) => {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(0, y, z)
    banner.add(mesh)
    return mesh
  }
  add(new THREE.PlaneGeometry(width + 0.24, height + 0.24), gold, -height / 2, 0.01)
  add(new THREE.PlaneGeometry(width, height), velvet, -height / 2, 0.02)
  add(new THREE.CylinderGeometry(0.06, 0.06, width + 0.6, 8), gold, 0.1, 0.1).rotation.z = Math.PI / 2
  add(new THREE.ShapeGeometry(mjukostShape(height * 0.5)), gold, -height * 0.12, 0.03)
  return banner
}

// The sign-in door: the oak double door with its seal, set in a stone frame.
// Behind it a short dark passage leads down, deep enough for the leaves to swing open into.
function createDungeonDoor(stone: THREE.Material, open: boolean) {
  const group = new THREE.Group()
  const add = (mesh: THREE.Mesh, x: number, y: number, z: number) => {
    mesh.position.set(x, y, z)
    group.add(mesh)
  }
  for (const side of [-1, 1]) {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.3, DOOR_HEIGHT + 0.4, 0.4), stone), side * (DUNGEON_PASSAGE_HALF + 0.15), (DOOR_HEIGHT + 0.4) / 2, 0.2)
    add(new THREE.Mesh(new THREE.BoxGeometry(0.8, DOOR_HEIGHT, DUNGEON_PASSAGE_DEPTH), stone), side * (DUNGEON_PASSAGE_HALF + 0.4), DOOR_HEIGHT / 2, -DUNGEON_PASSAGE_DEPTH / 2)
  }
  add(new THREE.Mesh(new THREE.BoxGeometry(DUNGEON_PASSAGE_HALF * 2 + 0.6, 0.4, 0.4), stone), 0, DOOR_HEIGHT + 0.2, 0.2)
  add(new THREE.Mesh(new THREE.BoxGeometry(DUNGEON_PASSAGE_HALF * 2, 0.4, DUNGEON_PASSAGE_DEPTH), stone), 0, DOOR_HEIGHT + 0.2, -DUNGEON_PASSAGE_DEPTH / 2)
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(DUNGEON_PASSAGE_HALF * 2, DUNGEON_PASSAGE_DEPTH),
    new THREE.MeshStandardMaterial({ color: '#3b3632', roughness: 0.9 }),
  )
  floor.rotation.x = -Math.PI / 2
  add(floor, 0, 0, -DUNGEON_PASSAGE_DEPTH / 2)
  add(
    new THREE.Mesh(new THREE.PlaneGeometry(DUNGEON_PASSAGE_HALF * 2, DOOR_HEIGHT), new THREE.MeshBasicMaterial({ color: '#030202' })),
    0,
    DOOR_HEIGHT / 2,
    -DUNGEON_PASSAGE_DEPTH,
  )

  const glow = new THREE.PointLight('#ff3010', 1.5, 5, 1.6)
  glow.position.set(0, 1.2, -DUNGEON_PASSAGE_DEPTH / 2)

  const door = new CastleDoor(open)
  group.add(door.group, glow)
  return { group, door }
}

// An iron ring of candles on a chain, with one warm light.
function createChandelier(iron: THREE.Material, flame: THREE.Material, z: number) {
  const chandelier = new THREE.Group()
  const y = HEIGHT - 3.5
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.06, 8, 32), iron)
  ring.rotation.x = Math.PI / 2
  ring.position.y = y
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.5, 6), iron)
  chain.position.y = y + 1.75
  chandelier.add(ring, chain)
  const wax = new THREE.MeshStandardMaterial({ color: '#efe6cf', roughness: 1 })
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), wax)
    candle.position.set(Math.cos(angle) * 1.2, y + 0.18, Math.sin(angle) * 1.2)
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 6), flame)
    tip.position.set(candle.position.x, y + 0.4, candle.position.z)
    chandelier.add(candle, tip)
  }
  const light = new THREE.PointLight('#ffc070', 8, 16, 1.4)
  light.position.y = y - 0.3
  chandelier.add(light)
  chandelier.position.z = z
  return chandelier
}

// The way out mirrors the gate seen from the forest: a short passage, the oak leaves swung open
// into it, and daylight at the far end.
function createGate(stone: THREE.Material) {
  const gate = new THREE.Group()
  const add = (mesh: THREE.Mesh, x: number, y: number, z: number) => {
    mesh.position.set(x, y, z)
    gate.add(mesh)
  }
  const sideWidth = HALF_WIDTH + 0.6 - GATE_HALF_WIDTH
  for (const side of [-1, 1]) {
    add(
      new THREE.Mesh(new THREE.BoxGeometry(sideWidth, HEIGHT, GATE_DEPTH), stone),
      side * (GATE_HALF_WIDTH + sideWidth / 2),
      HEIGHT / 2,
      GATE_DEPTH / 2,
    )
  }
  add(
    new THREE.Mesh(new THREE.BoxGeometry(GATE_HALF_WIDTH * 2, HEIGHT - DOOR_HEIGHT, GATE_DEPTH), stone),
    0,
    (HEIGHT + DOOR_HEIGHT) / 2,
    GATE_DEPTH / 2,
  )
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(GATE_HALF_WIDTH * 2, GATE_DEPTH),
    new THREE.MeshStandardMaterial({ color: '#3b3632', roughness: 0.9 }),
  )
  floor.rotation.x = -Math.PI / 2
  add(floor, 0, 0, GATE_DEPTH / 2)

  const leaves = new THREE.Group()
  for (const side of [-1, 1] as const) {
    const leaf = createDoorLeaf(side)
    swingDoorLeaf(leaf, side, 1)
    leaves.add(leaf)
  }
  leaves.position.z = GATE_DEPTH - 0.1
  gate.add(leaves)

  // Unfogged, so the way out still shines from the far end of the hall.
  const daylight = new THREE.Mesh(
    new THREE.PlaneGeometry(GATE_HALF_WIDTH * 2, DOOR_HEIGHT),
    new THREE.MeshBasicMaterial({ color: '#f4f0dc', fog: false }),
  )
  daylight.rotation.y = Math.PI
  add(daylight, 0, DOOR_HEIGHT / 2, GATE_DEPTH)
  const light = new THREE.PointLight('#f4f0dc', 6, 10)
  light.position.set(0, 2.5, GATE_DEPTH / 2)
  gate.add(light)
  return gate
}
