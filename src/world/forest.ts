import * as THREE from 'three'
import type { Post } from '@/types/post'
import { EYE_HEIGHT, type Interactable, type World } from '@/world/engine'
import {
  createDesk,
  createPainting,
  createPortalSurface,
  disposeScene,
  seededRandom,
} from '@/world/props'

const FOG_COLOR = '#9aa58c'
const PAINTING_SPACING = 2.4
const PATH_EDGE = 2.6
const TREE_COUNT = 420
const FIREFLY_COUNT = 120

export function createForest(posts: Post[], options: { canWrite: boolean }): World {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(FOG_COLOR)
  scene.fog = new THREE.FogExp2(FOG_COLOR, 0.035)

  scene.add(new THREE.HemisphereLight('#dfe8c8', '#3b3424', 1.2))
  const sun = new THREE.DirectionalLight('#ffe2b0', 1.6)
  sun.position.set(-20, 30, 10)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, far: 80 })
  scene.add(sun)

  const gateZ = -Math.max(20, posts.length * PAINTING_SPACING + 10)
  const random = seededRandom(7)

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160, 80, 80),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  const groundColors: number[] = []
  const shade = new THREE.Color()
  for (let i = 0; i < ground.geometry.attributes.position!.count; i++) {
    shade.setHSL(0.22 + random() * 0.05, 0.3, 0.22 + random() * 0.08)
    groundColors.push(shade.r, shade.g, shade.b)
  }
  ground.geometry.setAttribute('color', new THREE.Float32BufferAttribute(groundColors, 3))
  scene.add(ground)

  const pathLength = 12 - gateZ
  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(3, pathLength),
    new THREE.MeshStandardMaterial({ color: '#6e5a40', roughness: 1 }),
  )
  path.rotation.x = -Math.PI / 2
  path.position.set(0, 0.01, 10 - pathLength / 2)
  path.receiveShadow = true
  scene.add(path)

  addTrees(scene, random, gateZ)

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
    stand.position.set(side * PATH_EDGE, 0, -index * PAINTING_SPACING)
    stand.rotation.y = (-side * Math.PI) / 2
    scene.add(stand)
    interactables.push({ object: painting, label: post.title, action: { kind: 'read', post } })
  })

  if (options.canWrite) {
    const desk = createDesk('#5a4128')
    desk.position.set(2.2, 0, 4)
    desk.rotation.y = -Math.PI / 2
    scene.add(desk)
    interactables.push({ object: desk, label: 'Write a public post', action: { kind: 'new', isPrivate: false } })
  }

  const portal = createPortalSurface('#7fb8ff', 2.4, 3.4)
  portal.mesh.position.set(0, 1.9, gateZ + 0.75)
  scene.add(createCastleGate(gateZ), portal.mesh)

  const fireflies = createFireflies(random, gateZ)
  scene.add(fireflies.points)

  return {
    name: 'forest',
    scene,
    spawn: { position: new THREE.Vector3(0, EYE_HEIGHT, 8), yaw: 0 },
    arrivals: { castle: { position: new THREE.Vector3(0, EYE_HEIGHT, gateZ + 4), yaw: Math.PI } },
    interactables,
    portals: [{ position: portal.mesh.position.clone().setY(EYE_HEIGHT), radius: 1.3, to: 'castle' }],
    clamp(position) {
      position.x = THREE.MathUtils.clamp(position.x, -13, 13)
      position.z = THREE.MathUtils.clamp(position.z, gateZ + 1, 10)
    },
    update(_dt, elapsed) {
      portal.tick(elapsed)
      fireflies.tick(elapsed)
    },
    dispose: () => disposeScene(scene),
  }
}

function addTrees(scene: THREE.Scene, random: () => number, gateZ: number) {
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.15, 0.25, 3, 6),
    new THREE.MeshStandardMaterial({ color: '#3d2e1e', roughness: 1 }),
    TREE_COUNT,
  )
  const crowns = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1.4, 4, 7),
    new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, flatShading: true }),
    TREE_COUNT,
  )
  trunks.castShadow = crowns.castShadow = true

  const matrix = new THREE.Matrix4()
  const color = new THREE.Color()
  let placed = 0
  while (placed < TREE_COUNT) {
    const x = (random() - 0.5) * 120
    const z = gateZ - 30 + random() * (70 - gateZ)
    const inClearing = Math.abs(x) < 5 && z > gateZ - 2
    const inCastle = Math.abs(x) < 22 && z < gateZ + 2 && z > gateZ - 26
    if (inClearing || inCastle) continue
    const scale = 0.7 + random() * 0.9
    matrix.makeScale(scale, scale, scale).setPosition(x, 1.5 * scale, z)
    trunks.setMatrixAt(placed, matrix)
    matrix.makeScale(scale, scale * (0.9 + random() * 0.5), scale).setPosition(x, 4.5 * scale, z)
    crowns.setMatrixAt(placed, matrix)
    crowns.setColorAt(placed, color.setHSL(0.25 + random() * 0.08, 0.35, 0.2 + random() * 0.1))
    placed++
  }
  scene.add(trunks, crowns)
}

function createCastleGate(gateZ: number) {
  const castle = new THREE.Group()
  const stone = new THREE.MeshStandardMaterial({ color: '#7d7a70', roughness: 0.95, flatShading: true })
  const roof = new THREE.MeshStandardMaterial({ color: '#3f3a4a', roughness: 0.8, flatShading: true })
  const add = (mesh: THREE.Mesh, x: number, y: number, z: number) => {
    mesh.position.set(x, y, z)
    mesh.castShadow = mesh.receiveShadow = true
    castle.add(mesh)
  }

  add(new THREE.Mesh(new THREE.BoxGeometry(12, 7, 1.5), stone), -7.6, 3.5, 0)
  add(new THREE.Mesh(new THREE.BoxGeometry(12, 7, 1.5), stone), 7.6, 3.5, 0)
  add(new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.6, 1.5), stone), 0, 5.7, 0)
  for (const x of [-1.9, 1.9, -13.5, 13.5]) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 10, 8), stone), x, 5, 0)
    add(new THREE.Mesh(new THREE.ConeGeometry(1.5, 3, 8), roof), x, 11.5, 0)
  }
  add(new THREE.Mesh(new THREE.BoxGeometry(18, 14, 14), stone), 0, 7, -9)
  add(new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 22, 8), stone), 0, 11, -12)
  add(new THREE.Mesh(new THREE.ConeGeometry(3.2, 6, 8), roof), 0, 25, -12)
  for (let x = -13; x <= 13; x += 1.6) {
    if (Math.abs(x) < 2.5) continue
    add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 1.5), stone), x, 7.4, 0)
  }

  const light = new THREE.PointLight('#7fb8ff', 8, 12)
  light.position.set(0, 2.5, 2)
  castle.add(light)
  castle.position.z = gateZ
  return castle
}

function createFireflies(random: () => number, gateZ: number) {
  const base: number[] = []
  for (let i = 0; i < FIREFLY_COUNT; i++) {
    base.push((random() - 0.5) * 30, 0.5 + random() * 3, gateZ + random() * (14 - gateZ))
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(base, 3))
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: '#fff3a0', size: 0.08, transparent: true, opacity: 0.85, fog: false }),
  )
  const positions = geometry.attributes.position as THREE.BufferAttribute
  return {
    points,
    tick(elapsed: number) {
      for (let i = 0; i < FIREFLY_COUNT; i++) {
        const phase = i * 1.7
        positions.setXYZ(
          i,
          base[i * 3]! + Math.sin(elapsed * 0.6 + phase) * 0.6,
          base[i * 3 + 1]! + Math.sin(elapsed * 0.9 + phase * 2) * 0.3,
          base[i * 3 + 2]! + Math.cos(elapsed * 0.5 + phase) * 0.6,
        )
      }
      positions.needsUpdate = true
    },
  }
}
