import * as THREE from 'three'
import type { Post } from '@/types/post'
import type { CastleDoor } from '@/world/door'
import { AsciiRenderer } from '@/ascii/renderer'
import type { Grid } from '@/ascii/grid'

export type WorldAction = { kind: 'read'; post: Post } | { kind: 'new'; isPrivate: boolean; slot: number }

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
  readonly ascii: AsciiRenderer
  readonly camera = new THREE.PerspectiveCamera(70, 1, 0.1, 400)
  world: World | null = null
  focused: Interactable | null = null
  centerPick = true
  onFrame: ((dt: number) => void) | null = null
  onOverlay: ((grid: Grid, camera: THREE.PerspectiveCamera, elapsed: number) => void) | null = null

  private readonly timer = new THREE.Timer()
  private readonly raycaster = new THREE.Raycaster()
  private readonly center = new THREE.Vector2(0, 0)
  private frame = 0
  private animations: Animation[] = []

  constructor(canvas: HTMLCanvasElement) {
    this.ascii = new AsciiRenderer(canvas)
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
    this.ascii.dispose()
  }

  private tick() {
    const dt = Math.min(this.timer.getDelta(), 0.1)
    const elapsed = this.timer.getElapsed()
    const world = this.world
    if (world) {
      this.onFrame?.(dt)
      world.update?.(dt, elapsed, this.camera.position)
      this.runAnimations(dt)
      const pick = this.centerPick
        ? this.pickAt(
            this.center,
            world.interactables.map((i) => i.object),
            REACH,
          )
        : null
      this.focused = world.interactables.find((i) => i.object === pick?.target) ?? null
      this.ascii.render(world.scene, this.camera, elapsed)
    } else {
      this.ascii.screen.clear()
    }
    this.onOverlay?.(this.ascii.screen, this.camera, elapsed)
    this.ascii.screen.blit()
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
    this.ascii.resize()
    this.camera.aspect = this.ascii.screen.width / this.ascii.screen.height
    this.camera.updateProjectionMatrix()
  }
}
