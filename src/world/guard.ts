import * as THREE from 'three'
import { surface } from '@/ascii/surfaces'

// Built at human size (1.8 m, feet at y 0, facing +z, spear hand toward -x), then scaled to
// 2.5 m: three heads taller than the visitor.
const SCALE = 1.4
const UP = new THREE.Vector3(0, 1, 0)

type Point = THREE.Vector3Tuple

/** A white-armoured guard with an upright spear and a tall shield. */
export function createGuard(): THREE.Group {
  const steel = new THREE.MeshStandardMaterial({ color: '#d4d8da', metalness: 0.35, roughness: 0.4, flatShading: true, ...surface('iron') })
  const shade = new THREE.MeshStandardMaterial({ color: '#8f9699', metalness: 0.35, roughness: 0.5, flatShading: true, ...surface('iron') })
  const skin = new THREE.MeshStandardMaterial({ color: '#a8673a', roughness: 0.8 })
  const dark = new THREE.MeshBasicMaterial({ color: '#0a0a0a' })
  const wood = new THREE.MeshStandardMaterial({ color: '#5a3e26', roughness: 0.9, ...surface('pole') })

  const guard = new THREE.Group()
  const add = (parent: THREE.Object3D, mesh: THREE.Mesh, [x, y, z]: Point) => {
    mesh.position.set(x, y, z)
    parent.add(mesh)
    return mesh
  }
  // A tapered cylinder from `from` to `to`.
  const limb = (from: Point, to: Point, fromRadius: number, toRadius: number, material: THREE.Material) => {
    const a = new THREE.Vector3(...from)
    const b = new THREE.Vector3(...to)
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(toRadius, fromRadius, a.distanceTo(b), 8), material)
    mesh.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize())
    return add(guard, mesh, a.add(b).multiplyScalar(0.5).toArray())
  }
  const lerp = (a: Point, b: Point, t: number): Point => new THREE.Vector3(...a).lerp(new THREE.Vector3(...b), t).toArray()

  for (const side of [-1, 1]) {
    add(guard, new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 0.28), steel), [side * 0.13, 0.04, 0.04])
    limb([side * 0.13, 0.08, 0], [side * 0.13, 0.5, 0], 0.07, 0.095, steel)
    add(guard, new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), steel), [side * 0.125, 0.54, 0.03])
    limb([side * 0.125, 0.58, 0], [side * 0.11, 0.98, 0], 0.085, 0.1, steel)
  }

  // Belt, front flap and the segmented belly.
  add(guard, new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.26), steel), [0, 1, 0])
  const flapShape = new THREE.Shape([
    new THREE.Vector2(-0.11, 0),
    new THREE.Vector2(-0.06, -0.3),
    new THREE.Vector2(0.06, -0.3),
    new THREE.Vector2(0.11, 0),
  ])
  add(guard, new THREE.Mesh(new THREE.ExtrudeGeometry(flapShape, { depth: 0.03, bevelEnabled: false }), steel), [0, 0.97, 0.12])
  add(guard, new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.1, 0.01), shade), [0, 0.84, 0.155])
  add(guard, new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.22), shade), [0, 1.12, 0])
  for (let row = 0; row < 2; row++) {
    for (let col = -1; col <= 1; col++) {
      add(guard, new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.02), steel), [col * 0.1, 1.08 + row * 0.07, 0.115])
    }
  }

  // Breastplate, spiked pauldrons and the horned helmet with its T-shaped visor.
  add(guard, new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.34, 0.28), steel), [0, 1.36, 0])
  for (const side of [-1, 1]) {
    add(guard, new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.03), steel), [side * 0.1, 1.42, 0.145])
    const pauldron = add(guard, new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), steel), [side * 0.29, 1.47, 0])
    pauldron.scale.set(1, 0.8, 1.1)
    add(guard, new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.14, 6), steel), [side * 0.42, 1.55, 0]).rotation.z = -side
    add(guard, new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.15, 6), steel), [side * 0.15, 1.76, 0]).rotation.z = -side * 0.6
  }
  add(guard, new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.2, 10), steel), [0, 1.62, 0])
  add(guard, new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), steel), [0, 1.72, 0])
  add(guard, new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.13, 0.02), dark), [0, 1.6, 0.12])
  add(guard, new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.02), dark), [0, 1.67, 0.115])

  // Bare arms with steel bracers; the spear hand is held out at the hip.
  const spearHand: Point = [-0.44, 1.04, 0.14]
  const arms: [Point, Point, Point][] = [
    [[-0.3, 1.44, 0], [-0.36, 1.18, 0.02], spearHand],
    [[0.3, 1.44, 0], [0.35, 1.18, 0.03], [0.3, 1.08, 0.2]],
  ]
  for (const [shoulder, elbow, hand] of arms) {
    limb(shoulder, elbow, 0.065, 0.055, skin)
    limb(elbow, hand, 0.05, 0.045, skin)
    limb(lerp(elbow, hand, 0.55), lerp(elbow, hand, 0.85), 0.058, 0.058, steel)
    add(guard, new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), skin), hand)
  }

  // Spear: held below the middle, the shaft leans across toward the gate centre so the
  // two guards' spears cross at mid-door height; the lean suits guards 1.9 m from the centre.
  // It sits just in front of the fist so the short butt clears the belt flap.
  const spear = new THREE.Group()
  const shaftBottom = -0.6
  const shaftTop = 1.7
  add(spear, new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, shaftTop - shaftBottom, 6), wood), [0, (shaftTop + shaftBottom) / 2, 0])
  add(spear, new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.05, 6), steel), [0, shaftTop, 0])
  const headShape = new THREE.Shape(
    [
      [-0.015, 0], [0.015, 0], [0.04, 0.1], [0.07, 0.08], [0.03, 0.2],
      [0, 0.34], [-0.03, 0.2], [-0.07, 0.08], [-0.04, 0.1],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
  )
  const head = new THREE.ExtrudeGeometry(headShape, { depth: 0.015, bevelEnabled: false }).translate(0, 0, -0.0075)
  add(spear, new THREE.Mesh(head, steel), [0, shaftTop + 0.02, 0])
  spear.position.set(spearHand[0], spearHand[1], spearHand[2] + 0.04)
  spear.rotation.z = 0.96
  guard.add(spear)

  // Shield: a long faceted octagon with a raised centre boss and two slots.
  const shield = new THREE.Group()
  const shieldShape = new THREE.Shape(
    [
      [-0.1, 0.48], [0.1, 0.48], [0.25, 0.3], [0.25, -0.3],
      [0.1, -0.48], [-0.1, -0.48], [-0.25, -0.3], [-0.25, 0.3],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
  )
  const plate = new THREE.ExtrudeGeometry(shieldShape, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.035, bevelSegments: 1 })
  add(shield, new THREE.Mesh(plate, steel), [0, 0, 0])
  add(shield, new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.34, 0.04), steel), [0, 0, 0.07])
  add(shield, new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.012), shade), [0, 0, 0.095])
  for (const y of [-0.34, 0.34]) {
    add(shield, new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.035, 0.012), shade), [0, y, 0.06])
  }
  shield.position.set(0.33, 1, 0.3)
  shield.rotation.y = -0.15
  guard.add(shield)

  guard.traverse((object) => {
    object.castShadow = object.receiveShadow = true
  })
  guard.scale.setScalar(SCALE)
  return guard
}
