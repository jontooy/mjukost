import * as THREE from 'three'
import type { Engine } from '@/world/engine'

const WALK_SPEED = 4
const RUN_SPEED = 7
const MOUSE_SENSITIVITY = 0.0022
const TOUCH_SENSITIVITY = 0.005
const JOYSTICK_RADIUS = 60
const MAX_PITCH = Math.PI / 2 - 0.05

export interface Joystick {
  active: boolean
  originX: number
  originY: number
  x: number
  y: number
}

export class FirstPersonControls {
  enabled = true
  onInteract: (() => void) | null = null
  readonly joystick: Joystick = { active: false, originX: 0, originY: 0, x: 0, y: 0 }

  private readonly keys = new Set<string>()
  private yaw = 0
  private pitch = 0
  private joystickTouch: number | null = null
  private lookTouch: { id: number; x: number; y: number } | null = null
  private readonly forward = new THREE.Vector3()
  private readonly right = new THREE.Vector3()
  private readonly move = new THREE.Vector3()

  constructor(
    private readonly engine: Engine,
    private readonly element: HTMLElement,
  ) {
    element.addEventListener('click', this.onClick)
    element.addEventListener('touchstart', this.onTouchStart, { passive: false })
    element.addEventListener('touchmove', this.onTouchMove, { passive: false })
    element.addEventListener('touchend', this.onTouchEnd)
    element.addEventListener('touchcancel', this.onTouchEnd)
    document.addEventListener('mousemove', this.onMouseMove)
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
  }

  syncFromCamera() {
    const rotation = this.engine.camera.rotation
    this.yaw = rotation.y
    this.pitch = rotation.x
  }

  get locked() {
    return document.pointerLockElement === this.element
  }

  unlock() {
    if (this.locked) document.exitPointerLock()
    this.keys.clear()
    this.joystickTouch = null
    this.lookTouch = null
    this.joystick.active = false
  }

  update(dt: number) {
    const camera = this.engine.camera
    camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ')
    if (!this.enabled) return

    let ahead = 0
    let side = 0
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) ahead += 1
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) ahead -= 1
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) side += 1
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) side -= 1
    if (this.joystick.active) {
      ahead -= this.joystick.y / JOYSTICK_RADIUS
      side += this.joystick.x / JOYSTICK_RADIUS
    }
    if (ahead === 0 && side === 0) return

    this.forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw))
    this.move.set(0, 0, 0).addScaledVector(this.forward, ahead).addScaledVector(this.right, side)
    if (this.move.lengthSq() > 1) this.move.normalize()

    const speed = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? RUN_SPEED : WALK_SPEED
    camera.position.addScaledVector(this.move, speed * dt)
    this.engine.world?.clamp(camera.position)
  }

  dispose() {
    this.unlock()
    this.element.removeEventListener('click', this.onClick)
    this.element.removeEventListener('touchstart', this.onTouchStart)
    this.element.removeEventListener('touchmove', this.onTouchMove)
    this.element.removeEventListener('touchend', this.onTouchEnd)
    this.element.removeEventListener('touchcancel', this.onTouchEnd)
    document.removeEventListener('mousemove', this.onMouseMove)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
  }

  private look(dx: number, dy: number, sensitivity: number) {
    this.yaw -= dx * sensitivity
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * sensitivity, -MAX_PITCH, MAX_PITCH)
  }

  private readonly onClick = () => {
    if (!this.enabled || this.locked || matchMedia('(pointer: coarse)').matches) return
    void this.element.requestPointerLock()
  }

  private readonly onMouseMove = (event: MouseEvent) => {
    if (!this.enabled || !this.locked) return
    this.look(event.movementX, event.movementY, MOUSE_SENSITIVITY)
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (!this.enabled) return
    if (event.code === 'KeyE') {
      this.onInteract?.()
      return
    }
    this.keys.add(event.code)
  }

  private readonly onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code)
  }

  private readonly onBlur = () => {
    this.keys.clear()
  }

  private readonly onTouchStart = (event: TouchEvent) => {
    if (!this.enabled) return
    event.preventDefault()
    for (const touch of Array.from(event.changedTouches)) {
      if (touch.clientX < window.innerWidth / 2 && this.joystickTouch === null) {
        this.joystickTouch = touch.identifier
        Object.assign(this.joystick, {
          active: true,
          originX: touch.clientX,
          originY: touch.clientY,
          x: 0,
          y: 0,
        })
      } else if (this.lookTouch === null) {
        this.lookTouch = { id: touch.identifier, x: touch.clientX, y: touch.clientY }
      }
    }
  }

  private readonly onTouchMove = (event: TouchEvent) => {
    if (!this.enabled) return
    event.preventDefault()
    for (const touch of Array.from(event.changedTouches)) {
      if (touch.identifier === this.joystickTouch) {
        const dx = touch.clientX - this.joystick.originX
        const dy = touch.clientY - this.joystick.originY
        const length = Math.hypot(dx, dy)
        const scale = length > JOYSTICK_RADIUS ? JOYSTICK_RADIUS / length : 1
        this.joystick.x = dx * scale
        this.joystick.y = dy * scale
      } else if (this.lookTouch && touch.identifier === this.lookTouch.id) {
        this.look(
          touch.clientX - this.lookTouch.x,
          touch.clientY - this.lookTouch.y,
          TOUCH_SENSITIVITY,
        )
        this.lookTouch.x = touch.clientX
        this.lookTouch.y = touch.clientY
      }
    }
  }

  private readonly onTouchEnd = (event: TouchEvent) => {
    for (const touch of Array.from(event.changedTouches)) {
      if (touch.identifier === this.joystickTouch) {
        this.joystickTouch = null
        this.joystick.active = false
      } else if (this.lookTouch && touch.identifier === this.lookTouch.id) {
        this.lookTouch = null
      }
    }
  }
}
