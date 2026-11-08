import * as THREE from 'three'
import { easeInOut, type Engine, type Pick } from '@/world/engine'
import {
  SLOT_HEIGHT,
  SLOT_REGIONS,
  SLOT_WIDTH,
  drawSlot,
  type Rect,
  type SlotState,
} from '@/world/paperCanvas'

export type DoorItem = 'email' | 'password' | 'key'

export const DOOR_HALF_WIDTH = 1.4
export const DOOR_HEIGHT = 4.4
const LEAF_THICKNESS = 0.15
const OPEN_ANGLE = 1.7
const PLATE_SIZE = { width: 0.9, height: 0.5625 }
const PLATE_CENTER = new THREE.Vector3(-0.7, 1.65, LEAF_THICKNESS / 2 + 0.01)
const KEYHOLE = new THREE.Vector3(-0.7, 1.2, LEAF_THICKNESS / 2 + 0.01)
const MIN_VIEW_DISTANCE = 0.9

const inside = (rect: Rect, x: number, y: number) =>
  x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h

export class CastleDoor {
  readonly group = new THREE.Group()
  readonly targets: THREE.Object3D[]

  private readonly leftPivot = createDoorLeaf(-1)
  private readonly rightPivot = createDoorLeaf(1)
  private readonly plate: THREE.Mesh
  private readonly keyhole: THREE.Mesh
  private readonly slotContext: CanvasRenderingContext2D
  private readonly slotTexture: THREE.CanvasTexture

  constructor(open: boolean) {
    this.group.add(this.leftPivot, this.rightPivot)

    const canvas = document.createElement('canvas')
    canvas.width = SLOT_WIDTH
    canvas.height = SLOT_HEIGHT
    this.slotContext = canvas.getContext('2d')!
    this.slotTexture = new THREE.CanvasTexture(canvas)
    this.slotTexture.colorSpace = THREE.SRGBColorSpace
    this.slotTexture.anisotropy = 8
    this.plate = new THREE.Mesh(
      new THREE.PlaneGeometry(PLATE_SIZE.width, PLATE_SIZE.height),
      new THREE.MeshStandardMaterial({ map: this.slotTexture, metalness: 0.3, roughness: 0.5 }),
    )
    this.plate.position.copy(PLATE_CENTER)

    this.keyhole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.02, 24),
      new THREE.MeshStandardMaterial({ color: '#b08d57', metalness: 0.8, roughness: 0.3 }),
    )
    this.keyhole.rotation.x = Math.PI / 2
    this.keyhole.position.copy(KEYHOLE)
    const slit = new THREE.Mesh(
      new THREE.BoxGeometry(0.018, 0.07, 0.01),
      new THREE.MeshBasicMaterial({ color: '#0a0806' }),
    )
    slit.position.copy(KEYHOLE).setZ(KEYHOLE.z + 0.011)
    this.rightPivot.add(this.plate, this.keyhole, slit)

    this.targets = [this.plate, this.keyhole]
    if (open) this.setAngle(1)
  }

  render(state: SlotState) {
    drawSlot(this.slotContext, state)
    this.slotTexture.needsUpdate = true
  }

  itemAt(pick: Pick): { item: DoorItem; label: string } | null {
    if (pick.target === this.keyhole) return { item: 'key', label: 'Turn the key' }
    if (pick.target !== this.plate || !pick.hit.uv) return null
    const x = pick.hit.uv.x * SLOT_WIDTH
    const y = (1 - pick.hit.uv.y) * SLOT_HEIGHT
    if (inside(SLOT_REGIONS.email, x, y)) return { item: 'email', label: 'Engrave your name' }
    if (inside(SLOT_REGIONS.password, x, y)) return { item: 'password', label: 'Engrave the word' }
    return null
  }

  view(aspect: number) {
    const fit = PLATE_SIZE.width / 2 / (Math.tan(THREE.MathUtils.degToRad(35)) * aspect)
    const distance = Math.max(MIN_VIEW_DISTANCE, fit * 1.15)
    const center = PLATE_CENTER.clone().setY((PLATE_CENTER.y + KEYHOLE.y) / 2)
    return {
      position: this.rightPivot.localToWorld(center.clone().setZ(center.z + distance)),
      lookAt: this.rightPivot.localToWorld(center),
    }
  }

  async unlock(engine: Engine) {
    const key = createKey()
    const start = KEYHOLE.clone().add(new THREE.Vector3(0.3, -0.35, 0.6))
    const front = KEYHOLE.clone().setZ(KEYHOLE.z + 0.22)
    const seated = KEYHOLE.clone().setZ(KEYHOLE.z + 0.1)
    key.position.copy(start)
    key.rotation.set(0.4, -0.6, 0.3)
    this.rightPivot.add(key)

    const fromRotation = key.quaternion.clone()
    const straight = new THREE.Quaternion()
    void engine.moveCamera(
      this.rightPivot.localToWorld(KEYHOLE.clone().add(new THREE.Vector3(0.55, 0.1, 0.75))),
      this.rightPivot.localToWorld(KEYHOLE.clone()),
      0.8,
    )
    await engine.animate(0.7, (t) => {
      const eased = easeInOut(t)
      key.position.lerpVectors(start, front, eased)
      key.quaternion.slerpQuaternions(fromRotation, straight, eased)
    })
    await engine.animate(0.35, (t) => key.position.lerpVectors(front, seated, easeInOut(t)))
    await engine.animate(0.5, (t) => key.rotation.set(0, 0, (-Math.PI / 2) * easeInOut(t)))
    await engine.animate(1.4, (t) => this.setAngle(easeInOut(t)))
  }

  private setAngle(t: number) {
    swingDoorLeaf(this.leftPivot, -1, t)
    swingDoorLeaf(this.rightPivot, 1, t)
  }
}

// One oak leaf with iron bands, hung from a pivot at its hinge edge; side -1 is the left leaf.
export function createDoorLeaf(side: -1 | 1) {
  const oak = new THREE.MeshStandardMaterial({ color: '#4b3320', roughness: 0.85, flatShading: true })
  const iron = new THREE.MeshStandardMaterial({ color: '#2b2b2e', metalness: 0.7, roughness: 0.5 })
  const pivot = new THREE.Group()
  pivot.position.x = side * DOOR_HALF_WIDTH
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(DOOR_HALF_WIDTH, DOOR_HEIGHT, LEAF_THICKNESS), oak)
  leaf.position.set((-side * DOOR_HALF_WIDTH) / 2, DOOR_HEIGHT / 2, 0)
  leaf.castShadow = leaf.receiveShadow = true
  pivot.add(leaf)
  for (const y of [0.7, 2.6, 3.9]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(DOOR_HALF_WIDTH - 0.1, 0.1, 0.03), iron)
    band.position.set((-side * DOOR_HALF_WIDTH) / 2, y, LEAF_THICKNESS / 2 + 0.01)
    pivot.add(band)
  }
  return pivot
}

// t runs from 0 (shut) to 1 (open); open leaves swing toward -z.
export function swingDoorLeaf(pivot: THREE.Object3D, side: -1 | 1, t: number) {
  pivot.rotation.y = -side * OPEN_ANGLE * t
}

function createKey() {
  const gold = new THREE.MeshStandardMaterial({
    color: '#d4a64a',
    metalness: 0.9,
    roughness: 0.25,
    emissive: '#3a2a08',
  })
  const key = new THREE.Group()
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 10), gold)
  shaft.rotation.x = Math.PI / 2
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 10, 24), gold)
  bow.position.z = 0.13
  const bit = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.045, 0.04), gold)
  bit.position.set(0, -0.025, -0.07)
  key.add(shaft, bow, bit)
  return key
}
