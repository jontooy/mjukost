import * as THREE from 'three'
import type { Post } from '@/types/post'

export type WorldAction =
  | { kind: 'read'; post: Post }
  | { kind: 'new'; isPrivate: boolean }
  | { kind: 'portal'; to: WorldName }

export type WorldName = 'forest' | 'castle'

export interface Interactable {
  object: THREE.Object3D
  label: string
  action: WorldAction
}

export interface Portal {
  position: THREE.Vector3
  radius: number
  to: WorldName
}

export interface Placement {
  position: THREE.Vector3
  yaw: number
}

export interface World {
  name: WorldName
  scene: THREE.Scene
  spawn: Placement
  arrivals: Partial<Record<WorldName, Placement>>
  interactables: Interactable[]
  portals: Portal[]
  clamp(position: THREE.Vector3): void
  update?(dt: number, elapsed: number): void
  dispose(): void
}

export const EYE_HEIGHT = 1.7
const REACH = 4

export class Engine {
  readonly renderer: THREE.WebGLRenderer
  readonly camera = new THREE.PerspectiveCamera(70, 1, 0.1, 400)
  world: World | null = null
  focused: Interactable | null = null
  onFrame: ((dt: number) => void) | null = null

  private readonly clock = new THREE.Clock()
  private readonly raycaster = new THREE.Raycaster()
  private readonly center = new THREE.Vector2(0, 0)
  private frame = 0

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.raycaster.far = REACH
    this.resize()
    window.addEventListener('resize', this.resize)
  }

  setWorld(world: World, from?: WorldName) {
    this.world?.dispose()
    this.world = world
    this.focused = null
    const placement = (from && world.arrivals[from]) || world.spawn
    this.camera.position.copy(placement.position)
    this.camera.rotation.set(0, placement.yaw, 0, 'YXZ')
  }

  start() {
    this.clock.start()
    const loop = () => {
      this.frame = requestAnimationFrame(loop)
      this.tick()
    }
    loop()
  }

  dispose() {
    cancelAnimationFrame(this.frame)
    window.removeEventListener('resize', this.resize)
    this.world?.dispose()
    this.renderer.dispose()
  }

  private tick() {
    const world = this.world
    if (!world) return
    const dt = Math.min(this.clock.getDelta(), 0.1)
    this.onFrame?.(dt)
    world.update?.(dt, this.clock.elapsedTime)
    this.focused = this.pick(world)
    this.renderer.render(world.scene, this.camera)
  }

  private pick(world: World): Interactable | null {
    this.raycaster.setFromCamera(this.center, this.camera)
    const hits = this.raycaster.intersectObjects(
      world.interactables.map((i) => i.object),
      true,
    )
    const hit = hits[0]
    if (!hit) return null
    return (
      world.interactables.find((i) => {
        let node: THREE.Object3D | null = hit.object
        while (node) {
          if (node === i.object) return true
          node = node.parent
        }
        return false
      }) ?? null
    )
  }

  private readonly resize = () => {
    const width = this.canvas.clientWidth || window.innerWidth
    const height = this.canvas.clientHeight || window.innerHeight
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }
}
