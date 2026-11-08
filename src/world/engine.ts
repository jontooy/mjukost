import * as THREE from 'three'
import type { Post } from '@/types/post'
import type { CastleDoor } from '@/world/door'

export type WorldAction = { kind: 'read'; post: Post } | { kind: 'new'; isPrivate: boolean }

export type WorldName = 'forest' | 'castle' | 'dungeon'

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
  door?: CastleDoor
  portals: Portal[]
  clamp(position: THREE.Vector3): void
  update?(dt: number, elapsed: number, viewer: THREE.Vector3): void
  dispose(): void
}

export const EYE_HEIGHT = 1.7
const REACH = 4

export interface Pick {
  target: THREE.Object3D
  hit: THREE.Intersection
}

interface Animation {
  elapsed: number
  seconds: number
  step: (t: number) => void
  done: () => void
}

export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

export class Engine {
  readonly renderer: THREE.WebGLRenderer
  readonly camera = new THREE.PerspectiveCamera(70, 1, 0.1, 400)
  world: World | null = null
  focused: Interactable | null = null
  centerPick = true
  onFrame: ((dt: number) => void) | null = null

  private readonly timer = new THREE.Timer()
  private readonly raycaster = new THREE.Raycaster()
  private readonly center = new THREE.Vector2(0, 0)
  private frame = 0
  private animations: Animation[] = []

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.camera.rotation.order = 'YXZ'
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

  animate(seconds: number, step: (t: number) => void): Promise<void> {
    return new Promise((done) => this.animations.push({ elapsed: 0, seconds, step, done }))
  }

  moveCamera(position: THREE.Vector3, lookAt: THREE.Vector3, seconds: number) {
    const fromPosition = this.camera.position.clone()
    const fromRotation = this.camera.quaternion.clone()
    const target = new THREE.Object3D()
    target.position.copy(position)
    target.lookAt(lookAt)
    target.rotateY(Math.PI)
    return this.animate(seconds, (t) => {
      const eased = easeInOut(t)
      this.camera.position.lerpVectors(fromPosition, position, eased)
      this.camera.quaternion.slerpQuaternions(fromRotation, target.quaternion, eased)
    })
  }

  pickAt(ndc: THREE.Vector2, targets: THREE.Object3D[], far = Infinity): Pick | null {
    this.raycaster.setFromCamera(ndc, this.camera)
    this.raycaster.far = far
    const hit = this.raycaster.intersectObjects(targets, true)[0]
    if (!hit) return null
    let node: THREE.Object3D | null = hit.object
    while (node && !targets.includes(node)) node = node.parent
    return node ? { target: node, hit } : null
  }

  start() {
    const loop = (timestamp: number) => {
      this.frame = requestAnimationFrame(loop)
      this.timer.update(timestamp)
      this.tick()
    }
    this.frame = requestAnimationFrame(loop)
  }

  dispose() {
    cancelAnimationFrame(this.frame)
    window.removeEventListener('resize', this.resize)
    this.world?.dispose()
    this.timer.dispose()
    this.renderer.dispose()
  }

  private tick() {
    const world = this.world
    if (!world) return
    const dt = Math.min(this.timer.getDelta(), 0.1)
    this.onFrame?.(dt)
    world.update?.(dt, this.timer.getElapsed(), this.camera.position)
    this.runAnimations(dt)
    const pick = this.centerPick
      ? this.pickAt(
          this.center,
          world.interactables.map((i) => i.object),
          REACH,
        )
      : null
    this.focused = world.interactables.find((i) => i.object === pick?.target) ?? null
    this.renderer.render(world.scene, this.camera)
  }

  private runAnimations(dt: number) {
    if (this.animations.length === 0) return
    const running = this.animations
    this.animations = []
    for (const animation of running) {
      animation.elapsed += dt
      const t = Math.min(animation.elapsed / animation.seconds, 1)
      animation.step(t)
      if (t < 1) this.animations.push(animation)
      else animation.done()
    }
  }

  private readonly resize = () => {
    const width = this.canvas.clientWidth || window.innerWidth
    const height = this.canvas.clientHeight || window.innerHeight
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }
}
