import * as THREE from 'three'
import { easeInOut, type Engine, type Pick } from '@/world/engine'
import { HandMirror } from '@/world/mirror'
import {
  PAPER_HEIGHT,
  PAPER_REGIONS,
  PAPER_WIDTH,
  drawPaper,
  type PaperState,
  type Rect,
} from '@/world/paperCanvas'
import { loadPostImage } from '@/world/postTexture'
import { disposeObject } from '@/world/props'

export type BoardItem =
  | { kind: 'title' }
  | { kind: 'body' }
  | { kind: 'photos' }
  | { kind: 'mirror' }
  | { kind: 'flip' }
  | { kind: 'seal' }
  | { kind: 'leave' }
  | { kind: 'photo'; index: number }

const BOARD_CENTER = new THREE.Vector3(0.05, 1.45, -0.3)
const PAPER_SIZE = { width: 0.8, height: 1 }
const PHOTO_SIZE = 0.28
const PHOTO_COLUMNS = 2
const MAX_PHOTOS = 8
const MIRROR_REST = {
  position: new THREE.Vector3(0.1, 1.09, 0.15),
  rotation: new THREE.Euler(-Math.PI / 2, 0, 0.4),
}
const BOARD_WIDTH = 1.9
const MIN_VIEW_DISTANCE = 1.25
const VIEW_EYE_LIFT = 0.05
const VIEW_TARGET_DROP = 0.12

const inside = (rect: Rect, x: number, y: number) =>
  x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h

export class WritingBoard {
  readonly group = new THREE.Group()
  readonly mirror = new HandMirror()
  readonly targets: THREE.Object3D[]

  private readonly paper: THREE.Mesh
  private readonly paperContext: CanvasRenderingContext2D
  private readonly paperTexture: THREE.CanvasTexture
  private readonly photoStack: THREE.Group
  private readonly seal: THREE.Mesh
  private readonly leave: THREE.Mesh
  private readonly flip: THREE.Mesh
  private readonly photoGroup = new THREE.Group()
  private photoMeshes: THREE.Mesh[] = []
  private photoUrls: string[] = []

  constructor(
    anchor: THREE.Object3D,
    private readonly sealLabel: string,
  ) {
    anchor.getWorldPosition(this.group.position)
    anchor.getWorldQuaternion(this.group.quaternion)

    const wood = new THREE.MeshStandardMaterial({ color: '#4a3524', roughness: 0.85 })
    const backing = new THREE.Mesh(new THREE.BoxGeometry(BOARD_WIDTH, 1.2, 0.05), wood)
    backing.position.copy(BOARD_CENTER).setZ(BOARD_CENTER.z - 0.03)
    const cork = new THREE.Mesh(
      new THREE.PlaneGeometry(0.72, 1.1),
      new THREE.MeshStandardMaterial({ color: '#a8835a', roughness: 1 }),
    )
    cork.position.set(BOARD_CENTER.x + 0.55, BOARD_CENTER.y, BOARD_CENTER.z)
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.6, 0.06), wood)
      leg.position.set(BOARD_CENTER.x + side * 0.85, 0.8, BOARD_CENTER.z - 0.06)
      this.group.add(leg)
    }

    const canvas = document.createElement('canvas')
    canvas.width = PAPER_WIDTH
    canvas.height = PAPER_HEIGHT
    this.paperContext = canvas.getContext('2d')!
    this.paperTexture = new THREE.CanvasTexture(canvas)
    this.paperTexture.colorSpace = THREE.SRGBColorSpace
    this.paperTexture.anisotropy = 8
    this.paper = new THREE.Mesh(
      new THREE.PlaneGeometry(PAPER_SIZE.width, PAPER_SIZE.height),
      new THREE.MeshBasicMaterial({ map: this.paperTexture }),
    )
    this.paper.position.set(BOARD_CENTER.x - 0.4, BOARD_CENTER.y, BOARD_CENTER.z + 0.005)

    this.photoStack = new THREE.Group()
    const photoPaper = new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.7 })
    for (let i = 0; i < 4; i++) {
      const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.006, 0.15), photoPaper)
      sheet.position.y = i * 0.008
      sheet.rotation.y = (i - 1.5) * 0.12
      this.photoStack.add(sheet)
    }
    this.photoStack.position.set(-0.35, 1.08, 0.15)

    this.seal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.065, 0.03, 20),
      new THREE.MeshStandardMaterial({ color: '#8f1d1d', roughness: 0.4 }),
    )
    this.seal.position.set(0.42, 1.1, 0.15)

    this.leave = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.08, 0.02),
      new THREE.MeshStandardMaterial({ color: '#b08d57', metalness: 0.8, roughness: 0.35 }),
    )
    this.leave.position.set(BOARD_CENTER.x + 0.72, BOARD_CENTER.y - 0.52, BOARD_CENTER.z + 0.01)

    this.mirror.group.position.copy(MIRROR_REST.position)
    this.mirror.group.rotation.copy(MIRROR_REST.rotation)
    this.flip = new THREE.Mesh(
      new THREE.TorusGeometry(0.035, 0.012, 8, 20),
      new THREE.MeshStandardMaterial({ color: '#b08d57', metalness: 0.8, roughness: 0.35 }),
    )
    this.flip.position.set(0.26, 0.12, 0)
    this.flip.visible = false
    this.mirror.group.add(this.flip)

    this.group.add(
      backing,
      cork,
      this.paper,
      this.photoStack,
      this.seal,
      this.leave,
      this.mirror.group,
      this.photoGroup,
    )
    this.targets = [
      this.paper,
      this.photoStack,
      this.seal,
      this.leave,
      this.mirror.glass,
      this.flip,
    ]
  }

  view(aspect: number) {
    const fit = BOARD_WIDTH / 2 / (Math.tan(THREE.MathUtils.degToRad(35)) * aspect)
    const distance = Math.max(MIN_VIEW_DISTANCE, fit)
    return {
      position: this.group.localToWorld(
        BOARD_CENTER.clone()
          .setY(BOARD_CENTER.y + VIEW_EYE_LIFT)
          .setZ(BOARD_CENTER.z + distance),
      ),
      lookAt: this.group.localToWorld(BOARD_CENTER.clone().setY(BOARD_CENTER.y - VIEW_TARGET_DROP)),
      distance,
    }
  }

  render(state: PaperState) {
    drawPaper(this.paperContext, state)
    this.paperTexture.needsUpdate = true
  }

  setPhotos(urls: string[]) {
    if (urls.join('\n') === this.photoUrls.join('\n')) return
    this.photoUrls = [...urls]
    for (const mesh of this.photoMeshes) {
      this.photoGroup.remove(mesh)
      disposeObject(mesh)
    }
    this.photoMeshes = urls.slice(0, MAX_PHOTOS).map((url, index) => {
      const material = new THREE.MeshBasicMaterial({ color: '#d6c8a8' })
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(PHOTO_SIZE, PHOTO_SIZE * 0.8), material)
      const column = index % PHOTO_COLUMNS
      const row = Math.floor(index / PHOTO_COLUMNS)
      mesh.position.set(
        BOARD_CENTER.x + 0.38 + column * (PHOTO_SIZE + 0.06),
        BOARD_CENTER.y + 0.4 - row * (PHOTO_SIZE * 0.8 + 0.05),
        BOARD_CENTER.z + 0.01,
      )
      mesh.rotation.z = (index % 3) * 0.04 - 0.04
      const pin = new THREE.Mesh(
        new THREE.SphereGeometry(0.012, 8, 8),
        new THREE.MeshStandardMaterial({ color: '#a33' }),
      )
      pin.position.set(0, PHOTO_SIZE * 0.35, 0.01)
      mesh.add(pin)
      void loadPostImage(url).then((image) => {
        if (!image) return
        const texture = new THREE.Texture(image)
        texture.colorSpace = THREE.SRGBColorSpace
        texture.needsUpdate = true
        const scale = Math.max(1 / image.naturalWidth, 0.8 / image.naturalHeight)
        texture.repeat.set(1 / (image.naturalWidth * scale), 0.8 / (image.naturalHeight * scale))
        texture.offset.set((1 - texture.repeat.x) / 2, (1 - texture.repeat.y) / 2)
        material.map = texture
        material.color.set('#ffffff')
        material.needsUpdate = true
      })
      this.photoGroup.add(mesh)
      return mesh
    })
    this.targets.splice(6, Infinity, ...this.photoMeshes)
  }

  itemAt(pick: Pick): { item: BoardItem; label: string } | null {
    const { target, hit } = pick
    if (target === this.paper && hit.uv) {
      const x = hit.uv.x * PAPER_WIDTH
      const y = (1 - hit.uv.y) * PAPER_HEIGHT
      if (inside(PAPER_REGIONS.title, x, y))
        return { item: { kind: 'title' }, label: 'Write the title' }
      if (inside(PAPER_REGIONS.body, x, y))
        return { item: { kind: 'body' }, label: 'Write the text' }
      return null
    }
    if (target === this.photoStack) return { item: { kind: 'photos' }, label: 'Pin a photo' }
    if (target === this.seal) return { item: { kind: 'seal' }, label: this.sealLabel }
    if (target === this.leave) return { item: { kind: 'leave' }, label: 'Leave the desk' }
    if (target === this.flip) return { item: { kind: 'flip' }, label: 'Turn the mirror' }
    if (target === this.mirror.glass) {
      return {
        item: { kind: 'mirror' },
        label: this.mirror.live ? 'Take the photo' : 'Pick up the mirror',
      }
    }
    const index = this.photoMeshes.indexOf(target as THREE.Mesh)
    return index >= 0 ? { item: { kind: 'photo', index }, label: 'Take down the photo' } : null
  }

  async liftMirror(engine: Engine, aspect: number) {
    const { distance } = this.view(aspect)
    await this.moveMirror(
      engine,
      BOARD_CENTER.clone().add(new THREE.Vector3(0.22, -0.08, distance - 0.6)),
      new THREE.Euler(0, 0, 0),
    )
  }

  async lowerMirror(engine: Engine) {
    this.flip.visible = false
    await this.moveMirror(engine, MIRROR_REST.position, MIRROR_REST.rotation)
  }

  showFlip() {
    this.flip.visible = true
  }

  dispose() {
    this.mirror.dispose()
    this.group.removeFromParent()
    disposeObject(this.group)
  }

  private moveMirror(engine: Engine, position: THREE.Vector3, rotation: THREE.Euler) {
    const group = this.mirror.group
    const fromPosition = group.position.clone()
    const fromRotation = group.quaternion.clone()
    const toRotation = new THREE.Quaternion().setFromEuler(rotation)
    return engine.animate(0.6, (t) => {
      const eased = easeInOut(t)
      group.position.lerpVectors(fromPosition, position, eased)
      group.quaternion.slerpQuaternions(fromRotation, toRotation, eased)
    })
  }
}
