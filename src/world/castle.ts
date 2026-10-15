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

const HALF_WIDTH = 5
const HEIGHT = 7
const NOTE_SPACING = 2.4
const TORCH_SPACING = 6

export function createCastle(notes: Post[]): World {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#0d0b10')
  scene.fog = new THREE.Fog('#0d0b10', 8, 34)
  scene.add(new THREE.AmbientLight('#6a5a7a', 0.6))

  const length = Math.max(18, Math.ceil(notes.length / 2) * NOTE_SPACING + 10)
  const centerZ = -length / 2
  const stone = new THREE.MeshStandardMaterial({ color: '#5d5850', roughness: 0.95, flatShading: true })
  const random = seededRandom(11)

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF_WIDTH * 2, length),
    new THREE.MeshStandardMaterial({ color: '#3b3632', roughness: 0.9 }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.z = centerZ
  floor.receiveShadow = true

  const ceiling = floor.clone()
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.y = HEIGHT

  const carpet = new THREE.Mesh(
    new THREE.PlaneGeometry(2, length - 2),
    new THREE.MeshStandardMaterial({ color: '#6b1f24', roughness: 1 }),
  )
  carpet.rotation.x = -Math.PI / 2
  carpet.position.set(0, 0.01, centerZ)
  carpet.receiveShadow = true
  scene.add(floor, ceiling, carpet)

  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.6, HEIGHT, length), stone)
    wall.position.set(side * (HALF_WIDTH + 0.3), HEIGHT / 2, centerZ)
    wall.receiveShadow = true
    scene.add(wall)
  }
  for (const z of [0.3, -length - 0.3]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(HALF_WIDTH * 2 + 1.2, HEIGHT, 0.6), stone)
    wall.position.set(0, HEIGHT / 2, z)
    scene.add(wall)
  }

  const torches: THREE.PointLight[] = []
  const flameMaterial = new THREE.MeshBasicMaterial({ color: '#ffb347' })
  for (let z = -3; z > -length + 1; z -= TORCH_SPACING) {
    for (const side of [-1, 1]) {
      const column = new THREE.Mesh(new THREE.BoxGeometry(0.7, HEIGHT, 0.7), stone)
      column.position.set(side * (HALF_WIDTH - 0.2), HEIGHT / 2, z)
      column.castShadow = true
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 6), flameMaterial)
      flame.position.set(side * (HALF_WIDTH - 0.65), 3, z)
      const light = new THREE.PointLight('#ff9a3c', 6, 10, 1.6)
      light.position.copy(flame.position).setX(side * (HALF_WIDTH - 1))
      torches.push(light)
      scene.add(column, flame, light)
    }
  }

  const interactables: Interactable[] = []
  notes.forEach((note, index) => {
    const side = index % 2 === 0 ? -1 : 1
    const painting = createPainting(note, '#b08a3e')
    painting.position.set(side * (HALF_WIDTH - 0.05), 2, -4.2 - Math.floor(index / 2) * NOTE_SPACING)
    painting.rotation.y = (-side * Math.PI) / 2
    scene.add(painting)
    interactables.push({ object: painting, label: note.title, action: { kind: 'read', post: note } })
  })

  const desk = createDesk('#3a2a1c')
  desk.position.set(0, 0, -length + 2)
  scene.add(desk)
  interactables.push({ object: desk, label: 'Write a private note', action: { kind: 'new', isPrivate: true } })

  const portal = createPortalSurface('#ffb070', 2.2, 3.2)
  portal.mesh.position.set(0, 1.8, -0.05)
  scene.add(portal.mesh)

  return {
    name: 'castle',
    scene,
    spawn: { position: new THREE.Vector3(0, EYE_HEIGHT, -3), yaw: 0 },
    arrivals: {},
    interactables,
    portals: [{ position: new THREE.Vector3(0, EYE_HEIGHT, 0), radius: 1.2, to: 'forest' }],
    clamp(position) {
      position.x = THREE.MathUtils.clamp(position.x, -HALF_WIDTH + 0.8, HALF_WIDTH - 0.8)
      position.z = THREE.MathUtils.clamp(position.z, -length + 1, -0.3)
    },
    update(_dt, elapsed) {
      portal.tick(elapsed)
      torches.forEach((torch, index) => {
        torch.intensity = 5 + Math.sin(elapsed * 9 + index * 3.1) * 0.8 + random() * 0.6
      })
    },
    dispose: () => disposeScene(scene),
  }
}
