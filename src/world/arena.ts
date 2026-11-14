import * as THREE from 'three'
import { surface } from '@/ascii/surfaces'
import { ARENA_A, ARENA_B, OUTER, createColosseumBuilding } from '@/world/colosseumModel'

// The Colosseum stands north west of the castle, shrunk to the castle's width, its gate at the
// east end of its long axis. A dirt path winds from the gate to the road just in front of the
// castle gate.
export const COLOSSEUM_X = -60
export const COLOSSEUM_Z = -40
export const COLOSSEUM_SCALE = 26.8 / (2 * (ARENA_A + OUTER))
// Half the footprint along each axis, out to the attic cornice, the widest part.
const HALF_X = (ARENA_A + OUTER + 0.6) * COLOSSEUM_SCALE
const HALF_Z = (ARENA_B + OUTER + 0.6) * COLOSSEUM_SCALE
const BODY = 0.5 // how close a visitor gets to a wall, as at the castle
const CLEARING = 6 // open grass between the building and the trees
const PATH_WIDTH = 2.4
const PATH_CLEARING = 3 // tree-free distance from the path's centre line
const PATH_SAMPLES = 64

/** Where a visitor pressed against the gate arch stands; reaching it takes them inside. */
export const GATE_X = COLOSSEUM_X + HALF_X + BODY - 0.2
export const GATE_Z = COLOSSEUM_Z

// From the foot of the gate east, then south past the castle's west wall to the road.
const PATH_WAYPOINTS: [number, number][] = [
  [COLOSSEUM_X + (ARENA_A + OUTER) * COLOSSEUM_SCALE, COLOSSEUM_Z], [-42, -40], [-37, -36], [-33, -28],
  [-30, -18], [-25, -8], [-20, -2], [-13, 4.5], [-1, 4],
]
const PATH_CURVE = new THREE.CatmullRomCurve3(PATH_WAYPOINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)))
export const PATH_POINTS = PATH_CURVE.getSpacedPoints(PATH_SAMPLES)

// How far (x, z) lies along its ray from the building's centre, relative to its footprint grown
// by `margin`: below 1 is inside.
const footprintScale = (x: number, z: number, margin: number) =>
  Math.hypot((x - COLOSSEUM_X) / (HALF_X + margin), (z - COLOSSEUM_Z) / (HALF_Z + margin))

export function createArena(): THREE.Group {
  const arena = new THREE.Group()
  const building = createColosseumBuilding({ grandGate: true })
  building.position.set(COLOSSEUM_X, 0, COLOSSEUM_Z)
  building.scale.setScalar(COLOSSEUM_SCALE)
  arena.add(building, createPath())
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

/** Keeps the visitor outside the Colosseum's walls, pushed straight out from its centre. */
export function pushOutOfArena(position: THREE.Vector3): void {
  const scale = footprintScale(position.x, position.z, BODY)
  if (scale >= 1 || scale === 0) return
  position.x = COLOSSEUM_X + (position.x - COLOSSEUM_X) / scale
  position.z = COLOSSEUM_Z + (position.z - COLOSSEUM_Z) / scale
}

/** Whether a tree of trunk radius `margin` at (x, z) would stand on the Colosseum, its ring of open grass, or its path. */
export function nearArena(x: number, z: number, margin: number): boolean {
  if (footprintScale(x, z, CLEARING + margin) < 1) return true
  return PATH_POINTS.some((point) => Math.hypot(x - point.x, z - point.z) < PATH_CLEARING + margin)
}
