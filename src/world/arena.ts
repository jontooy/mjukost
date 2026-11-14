import * as THREE from 'three'
import { surface } from '@/ascii/surfaces'

// A colosseum north-west of the castle: stepped stone seats inside a high outer wall around a
// sand floor, open at one gateway that faces the castle. Angles run from +z toward +x, as
// LatheGeometry lays them out.
export const ARENA_X = -68
export const ARENA_Z = -34
export const RING_INNER = 8 // the edge of the sand and the foot of the podium wall
export const RING_OUTER = 13
export const ENTRANCE_ANGLE = 0.45
export const GATE_HALF_ANGLE = 0.2
const WALL_HEIGHT = 7
const BODY = 0.5 // how close a visitor gets to a wall, as at the castle
const GATE_TOWER_RADIUS = 1.3
const ARCHES = 24
const ARENA_CLEARING = 6 // open grass between the outer wall and the trees
const PATH_WIDTH = 2.4
const PATH_CLEARING = 3 // tree-free distance from the path's centre line
const PATH_SAMPLES = 64

// The ring's cross-section as (distance from the centre, height): the podium wall around the
// sand, three rows of seats, then the outer wall's inner face, top and outer face.
const PROFILE_POINTS: [number, number][] = [
  [RING_INNER, 0], [RING_INNER, 1.6],
  [9, 1.6], [9, 2.4], [10, 2.4], [10, 3.2], [11, 3.2], [11, 4], [12, 4],
  [12, WALL_HEIGHT], [RING_OUTER, WALL_HEIGHT], [RING_OUTER, 0],
]
const PROFILE = PROFILE_POINTS.map(([r, y]) => new THREE.Vector2(r, y))

// A tower on each side of the gateway, standing in the outer wall just clear of the opening.
const GATE_TOWERS = [-1, 1].map((side) => {
  const angle = ENTRANCE_ANGLE + side * (GATE_HALF_ANGLE + GATE_TOWER_RADIUS / RING_OUTER)
  return { x: ARENA_X + RING_OUTER * Math.sin(angle), z: ARENA_Z + RING_OUTER * Math.cos(angle) }
})

// From the sand out through the gateway, winding south-east to the road just in front of the castle gate.
const PATH_WAYPOINTS: [number, number][] = [
  [-64.5, -26.8], [-61.5, -20.5], [-54, -13], [-45, -11], [-38, -4],
  [-31, 3], [-22, 6], [-12, 4.5], [-1, 4],
]
const PATH_CURVE = new THREE.CatmullRomCurve3(PATH_WAYPOINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)))
const PATH_POINTS = PATH_CURVE.getSpacedPoints(PATH_SAMPLES)

const wrapAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle))

export function createArena(): THREE.Group {
  const arena = new THREE.Group()
  const stone = new THREE.MeshStandardMaterial({
    color: '#8a8273',
    roughness: 0.95,
    flatShading: true,
    side: THREE.DoubleSide,
    ...surface('stone'),
  })
  const roof = new THREE.MeshStandardMaterial({
    color: '#3f3a4a',
    roughness: 0.8,
    flatShading: true,
    ...surface('roof'),
  })
  const add = (mesh: THREE.Mesh, x: number, y: number, z: number) => {
    mesh.position.set(x, y, z)
    mesh.castShadow = mesh.receiveShadow = true
    arena.add(mesh)
  }

  // The ring, open at the gateway, with its two cut ends closed by the cross-section.
  const ring = new THREE.LatheGeometry(
    PROFILE,
    48,
    ENTRANCE_ANGLE + GATE_HALF_ANGLE,
    2 * Math.PI - 2 * GATE_HALF_ANGLE,
  )
  add(new THREE.Mesh(ring, stone), ARENA_X, 0, ARENA_Z)
  const end = new THREE.ShapeGeometry(new THREE.Shape(PROFILE))
  for (const side of [-1, 1]) {
    const cap = new THREE.Mesh(end, stone)
    cap.rotation.y = ENTRANCE_ANGLE + side * GATE_HALF_ANGLE - Math.PI / 2
    add(cap, ARENA_X, 0, ARENA_Z)
  }

  const sand = new THREE.Mesh(
    new THREE.CircleGeometry(RING_INNER, 48),
    new THREE.MeshStandardMaterial({ color: '#c8b07a', roughness: 1, ...surface('dirt') }),
  )
  sand.rotation.x = -Math.PI / 2
  sand.position.set(ARENA_X, 0.015, ARENA_Z)
  sand.receiveShadow = true
  arena.add(sand)

  for (const { x, z } of GATE_TOWERS) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(1.1, GATE_TOWER_RADIUS, 9, 8), stone), x, 4.5, z)
    add(new THREE.Mesh(new THREE.ConeGeometry(1.5, 3, 8), roof), x, 10.5, z)
  }

  // Dark arches round the outer wall, a tall row below and a short row above, clear of the gate towers.
  const dark = new THREE.MeshBasicMaterial({ color: '#1c1813' })
  const arch = new THREE.PlaneGeometry(1.4, 3)
  const opening = new THREE.PlaneGeometry(1, 1.6)
  for (let i = 0; i < ARCHES; i++) {
    const angle = ENTRANCE_ANGLE + ((i + 0.5) * 2 * Math.PI) / ARCHES
    if (Math.abs(wrapAngle(angle - ENTRANCE_ANGLE)) < GATE_HALF_ANGLE + 0.3) continue
    for (const [geometry, y] of [[arch, 1.5], [opening, 4.8]] as const) {
      const mesh = new THREE.Mesh(geometry, dark)
      const radius = RING_OUTER + 0.05
      mesh.position.set(ARENA_X + radius * Math.sin(angle), y, ARENA_Z + radius * Math.cos(angle))
      mesh.rotation.y = angle
      arena.add(mesh)
    }
  }

  arena.add(createPath())
  return arena
}

// A flat dirt ribbon along the path curve, the colour of the road it joins.
function createPath(): THREE.Mesh {
  const positions: number[] = []
  const indices: number[] = []
  PATH_POINTS.forEach((point, i) => {
    const tangent = PATH_CURVE.getTangentAt(i / PATH_SAMPLES)
    const sideX = tangent.z * (PATH_WIDTH / 2)
    const sideZ = -tangent.x * (PATH_WIDTH / 2)
    positions.push(point.x + sideX, 0, point.z + sideZ, point.x - sideX, 0, point.z - sideZ)
    if (i === 0) return
    const left = (i - 1) * 2
    indices.push(left, left + 1, left + 2, left + 1, left + 3, left + 2)
  })
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  const path = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: '#6e5a40', roughness: 1, ...surface('dirt') }),
  )
  path.position.y = 0.012
  path.receiveShadow = true
  return path
}

/**
 * Keeps the visitor out of the ring and the gate towers. Inside the ring's band, outside the
 * gateway, they go to whichever is nearest: the sand side, the outside, or back into the gateway.
 */
export function pushOutOfArena(position: THREE.Vector3): void {
  const dx = position.x - ARENA_X
  const dz = position.z - ARENA_Z
  const radius = Math.hypot(dx, dz)
  if (radius > RING_INNER - BODY && radius < RING_OUTER + BODY) {
    const off = wrapAngle(Math.atan2(dx, dz) - ENTRANCE_ANGLE)
    const limit = GATE_HALF_ANGLE - BODY / radius
    if (Math.abs(off) >= limit) {
      const toInner = radius - (RING_INNER - BODY)
      const toOuter = RING_OUTER + BODY - radius
      const toGateway = radius * (Math.abs(off) - limit)
      if (toGateway < toInner && toGateway < toOuter) {
        const angle = ENTRANCE_ANGLE + Math.sign(off) * limit
        position.x = ARENA_X + radius * Math.sin(angle)
        position.z = ARENA_Z + radius * Math.cos(angle)
      } else {
        const target = toInner < toOuter ? RING_INNER - BODY : RING_OUTER + BODY
        position.x = ARENA_X + (dx / radius) * target
        position.z = ARENA_Z + (dz / radius) * target
      }
    }
  }
  for (const tower of GATE_TOWERS) {
    const tx = position.x - tower.x
    const tz = position.z - tower.z
    const reach = GATE_TOWER_RADIUS + BODY
    const distance = Math.hypot(tx, tz)
    if (distance >= reach || distance === 0) continue
    position.x = tower.x + (tx / distance) * reach
    position.z = tower.z + (tz / distance) * reach
  }
}

/** Whether a tree of trunk radius `margin` at (x, z) would stand in the arena, its ring of open grass, or on its path. */
export function nearArena(x: number, z: number, margin: number): boolean {
  if (Math.hypot(x - ARENA_X, z - ARENA_Z) < RING_OUTER + ARENA_CLEARING + margin) return true
  return PATH_POINTS.some((point) => Math.hypot(x - point.x, z - point.z) < PATH_CLEARING + margin)
}
