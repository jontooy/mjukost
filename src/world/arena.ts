import * as THREE from 'three'
import { surface } from '@/ascii/surfaces'
import { ARENA_A, OUTER, createColosseumBuilding, ellipseScale } from '@/world/colosseumModel'

// The Colosseum stands north west of the castle, its gate at the east end of its long axis. A
// dirt path winds from the gate to the road just in front of the castle gate.
export const COLOSSEUM_X = -95
export const COLOSSEUM_Z = -60
const BODY = 0.5 // how close a visitor gets to a wall, as at the castle
const REACH = OUTER + 0.6 + BODY // clear of the attic cornice, the widest part
const CLEARING = 8 // open grass between the building and the trees
const PATH_WIDTH = 2.4
const PATH_CLEARING = 3 // tree-free distance from the path's centre line
const PATH_SAMPLES = 96

/** Where a visitor pressed against the gate arch stands; reaching it takes them inside. */
export const GATE_X = COLOSSEUM_X + ARENA_A + REACH - 0.2
export const GATE_Z = COLOSSEUM_Z

// From the foot of the gate east, then south past the castle's west wall to the road.
const PATH_WAYPOINTS: [number, number][] = [
  [COLOSSEUM_X + ARENA_A + OUTER, COLOSSEUM_Z], [-40, -60], [-34, -57], [-30, -49], [-29, -37],
  [-27, -24], [-24, -12], [-20, -3], [-13, 4.5], [-1, 4],
]
const PATH_CURVE = new THREE.CatmullRomCurve3(PATH_WAYPOINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)))
export const PATH_POINTS = PATH_CURVE.getSpacedPoints(PATH_SAMPLES)

export function createArena(): THREE.Group {
  const arena = new THREE.Group()
  const building = createColosseumBuilding()
  building.position.set(COLOSSEUM_X, 0, COLOSSEUM_Z)
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
  const x = position.x - COLOSSEUM_X
  const z = position.z - COLOSSEUM_Z
  const scale = ellipseScale(x, z, REACH)
  if (scale >= 1 || scale === 0) return
  position.x = COLOSSEUM_X + x / scale
  position.z = COLOSSEUM_Z + z / scale
}

/** Whether a tree of trunk radius `margin` at (x, z) would stand on the Colosseum, its ring of open grass, or its path. */
export function nearArena(x: number, z: number, margin: number): boolean {
  if (ellipseScale(x - COLOSSEUM_X, z - COLOSSEUM_Z, REACH + CLEARING + margin) < 1) return true
  return PATH_POINTS.some((point) => Math.hypot(x - point.x, z - point.z) < PATH_CLEARING + margin)
}
