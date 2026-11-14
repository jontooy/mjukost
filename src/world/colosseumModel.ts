import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { surface } from '@/ascii/surfaces'

// The Colosseum as it stands in Rome, centred on the origin with its long axis along x: three
// storeys of arches between half columns and a windowed attic in travertine, around stands that
// climb from an elliptical sand floor. North east of the east gate the outer ring has fallen,
// stepping down at both ends and baring the brick inner ring.
//
// Everything sits on ellipses offset `d` metres outward from the edge of the sand: the point at
// angle t (from +z toward +x) is ((ARENA_A + d) sin t, (ARENA_B + d) cos t).
export const ARENA_A = 28
export const ARENA_B = 20
export const OUTER = 22 // the outer face, so the building is 100 x 84 m
const PODIUM = 4.5 // the wall round the sand
const TERRACE = 2 // the senators' terrace on top of the podium
const INNER_FACE = 15 // the outside of the inner ring, which the stands lean on
const INNER_DEPTH = 1
const OUTER_DEPTH = 1.5
const STOREY = 7.5
const INNER_HEIGHT = 3 * STOREY
const BAYS = 80 // bay 0 is the gate, at the east end
const RUIN_FIRST = 5
const RUIN_LAST = 26
const ARCH_RADIUS = 1.05
const ARCH_TOP = STOREY - 1.4
const COLUMN_RADIUS = 0.32
const CORNICE = 0.7

// The stands, three tiers of seats over the podium, the upper two behind a wall pierced by
// stairway mouths. The last step ends against the top of the inner ring.
const TIERS = [
  { wall: 0, steps: 5, tread: 0.9 },
  { wall: 2, steps: 5, tread: 0.9 },
  { wall: 2, steps: 4, tread: 0.75 },
]
const STAND_PROFILE: [number, number][] = [[0, 0], [0, PODIUM], [TERRACE, PODIUM]]
// Where the stairway mouths open: the foot of each tier wall.
const TIER_WALLS: { d: number; y: number }[] = []
{
  let [d, y] = [TERRACE, PODIUM]
  for (const { wall, steps, tread } of TIERS) {
    if (wall) {
      TIER_WALLS.push({ d, y })
      STAND_PROFILE.push([d, (y += wall)])
    }
    for (let i = 0; i < steps; i++) STAND_PROFILE.push([d, (y += 1)], [(d += tread), y])
  }
}

/** How far (x, z) lies along its ray from the centre, relative to the ellipse at offset `d`: below 1 is inside. */
export function ellipseScale(x: number, z: number, d: number): number {
  return Math.hypot(x / (ARENA_A + d), z / (ARENA_B + d))
}

const ellipsePoint = (d: number, t: number) =>
  new THREE.Vector3((ARENA_A + d) * Math.sin(t), 0, (ARENA_B + d) * Math.cos(t))
const bayEdge = (k: number) => Math.PI / 2 + ((k - 0.5) * 2 * Math.PI) / BAYS

// The chord across `span` bays from bay k on the ellipse at offset d: local x runs along the
// wall, y up, +z outward.
function bayFrame(k: number, d: number, span = 1) {
  const a = ellipsePoint(d, bayEdge(k))
  const b = ellipsePoint(d, bayEdge(k + span))
  const width = a.distanceTo(b)
  const matrix = new THREE.Matrix4()
    .makeRotationY(Math.atan2(a.z - b.z, b.x - a.x))
    .setPosition(a.add(b).multiplyScalar(0.5))
  return { matrix, width }
}

// How many storeys of the outer ring still stand in bay k: all four, or stepping down to none
// across the fallen stretch.
function outerStoreys(k: number): number {
  if (k < RUIN_FIRST || k > RUIN_LAST) return 4
  return Math.max(0, 4 - Math.min(k - RUIN_FIRST + 1, RUIN_LAST - k + 1))
}

// An arch outline `radius` wide on each side, its crown at `top`.
function archPath(path: THREE.Path, radius: number, top: number) {
  path.lineTo(-radius, top - radius)
  path.absarc(0, top - radius, radius, Math.PI, 0, true)
  path.lineTo(radius, 0)
}

function archShape(radius: number, top: number): THREE.Shape {
  const shape = new THREE.Shape()
  shape.moveTo(-radius, 0)
  archPath(shape, radius, top)
  shape.closePath()
  return shape
}

// Wall `width` wide and `height` tall with an arch cut up from its foot, a storey's by default.
function archedWall(width: number, radius = ARCH_RADIUS, top = ARCH_TOP, height = STOREY): THREE.Shape {
  const shape = new THREE.Shape()
  shape.moveTo(-width / 2, 0)
  shape.lineTo(-radius, 0)
  archPath(shape, radius, top)
  shape.lineTo(width / 2, 0)
  shape.lineTo(width / 2, height)
  shape.lineTo(-width / 2, height)
  shape.closePath()
  return shape
}

// The attic storey, with a small square window in every other bay.
function atticWall(width: number, window: boolean): THREE.Shape {
  const shape = new THREE.Shape()
  shape.moveTo(-width / 2, 0)
  shape.lineTo(width / 2, 0)
  shape.lineTo(width / 2, STOREY)
  shape.lineTo(-width / 2, STOREY)
  shape.closePath()
  if (window) {
    const hole = new THREE.Path()
    hole.moveTo(-0.45, 3)
    hole.lineTo(0.45, 3)
    hole.lineTo(0.45, 4.4)
    hole.lineTo(-0.45, 4.4)
    hole.closePath()
    shape.holes.push(hole)
  }
  return shape
}

// A wall shape extruded `depth` inward from its face at local z 0.
const extrude = (shape: THREE.Shape, depth: number) =>
  new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 6 }).translate(0, 0, -depth)

// Geometry gathered in place, merged into one mesh per material.
class Parts {
  private readonly list: THREE.BufferGeometry[] = []

  add(geometry: THREE.BufferGeometry, matrix: THREE.Matrix4, x = 0, y = 0, z = 0) {
    geometry.translate(x, y, z).applyMatrix4(matrix)
    this.list.push(geometry.index ? geometry.toNonIndexed() : geometry)
  }

  mesh(material: THREE.Material, shadows = true): THREE.Mesh {
    const mesh = new THREE.Mesh(mergeGeometries(this.list), material)
    mesh.castShadow = mesh.receiveShadow = shadows
    return mesh
  }
}

/**
 * `grandGate` replaces the lower two storeys of the three east bays with one tall arch, so the gate
 * stays walkable when the building is shown shrunk.
 */
export function createColosseumBuilding(options: { grandGate: boolean }): THREE.Group {
  const travertine = new THREE.MeshStandardMaterial({ color: '#cdb894', roughness: 0.95, flatShading: true, ...surface('stone') })
  const brick = new THREE.MeshStandardMaterial({ color: '#a8775a', roughness: 1, flatShading: true, ...surface('stone') })
  const seats = new THREE.MeshStandardMaterial({ color: '#bcac8c', roughness: 1, flatShading: true, ...surface('stone') })
  const iron = new THREE.MeshStandardMaterial({ color: '#2b2b2e', metalness: 0.6, roughness: 0.6, ...surface('iron') })
  const velvet = new THREE.MeshStandardMaterial({ color: '#7a1020', roughness: 1, ...surface('velvet') })
  const gold = new THREE.MeshStandardMaterial({ color: '#c9a23f', metalness: 0.8, roughness: 0.35, ...surface('gold') })
  const dark = new THREE.MeshBasicMaterial({ color: '#1c1813' })

  const outer = new Parts()
  const inner = new Parts()
  const shadow = new Parts()
  const grilles = new Parts()

  for (let k = 0; k < BAYS; k++) {
    const storeys = outerStoreys(k)
    const inGate = options.grandGate && (k === BAYS - 1 || k <= 1)
    const { matrix, width } = bayFrame(k, OUTER)
    for (let s = 0; s < storeys; s++) {
      const y = s * STOREY
      const attic = s === 3
      const gateStorey = inGate && s < 2
      if (gateStorey && s === 0) continue // the gate arch rises through it, with no cornice across
      if (!gateStorey) {
        outer.add(extrude(attic ? atticWall(width + 0.02, k % 2 === 0) : archedWall(width + 0.02), OUTER_DEPTH), matrix, 0, y)
      }
      // Half columns below, flat pilasters on the attic, at each edge that ends a standing bay.
      const edges = gateStorey ? [] : [-1, ...(outerStoreys((k + 1) % BAYS) <= s ? [1] : [])]
      for (const side of edges) {
        const shaft = attic
          ? new THREE.BoxGeometry(0.6, STOREY - CORNICE, 0.3)
          : new THREE.CylinderGeometry(COLUMN_RADIUS, COLUMN_RADIUS, STOREY - CORNICE, 8)
        outer.add(shaft, matrix, (side * width) / 2, y + (STOREY - CORNICE) / 2, attic ? 0.15 : 0)
      }
      // The attic ends in a heavier cornice.
      outer.add(
        new THREE.BoxGeometry(width + (attic ? 0.4 : 0.3), attic ? 1.2 : CORNICE, attic ? 1 : 0.7),
        matrix,
        0,
        y + STOREY - (attic ? 0.6 : CORNICE / 2),
        attic ? 0.1 : 0.05,
      )
    }
    // The ground arches are barred with iron, all but the gate and the one opposite.
    if (storeys > 0 && k !== 0 && k !== BAYS / 2 && !inGate) {
      for (let i = 1; i < 8; i++) {
        const x = -ARCH_RADIUS + (i * 2 * ARCH_RADIUS) / 8
        const height = ARCH_TOP - ARCH_RADIUS + Math.sqrt(ARCH_RADIUS ** 2 - x ** 2) - 0.05
        grilles.add(new THREE.BoxGeometry(0.07, height, 0.07), matrix, x, height / 2, -0.5)
      }
      grilles.add(new THREE.BoxGeometry(2 * ARCH_RADIUS, 0.07, 0.07), matrix, 0, 2.6, -0.5)
    }

    // The vaulted floors of the corridor between the rings, under every storey still standing.
    const corridor = bayFrame(k, (INNER_FACE + OUTER - OUTER_DEPTH) / 2)
    const corridorDepth = OUTER - OUTER_DEPTH - INNER_FACE + 0.2
    for (let s = inGate ? 2 : 1; s <= Math.min(storeys, 3); s++) {
      outer.add(new THREE.BoxGeometry(bayFrame(k, OUTER).width, 0.5, corridorDepth), corridor.matrix, 0, s * STOREY - 0.25)
    }

    // The inner ring: plain brick with blind arches on two storeys and a small window above.
    const ring = bayFrame(k, INNER_FACE)
    inner.add(new THREE.BoxGeometry(ring.width + 0.05, INNER_HEIGHT, INNER_DEPTH), ring.matrix, 0, INNER_HEIGHT / 2, -INNER_DEPTH / 2)
    for (const s of [1, 2]) inner.add(new THREE.BoxGeometry(ring.width + 0.1, 0.4, 0.5), ring.matrix, 0, s * STOREY, 0)
    for (const s of [0, 1]) shadow.add(new THREE.ShapeGeometry(archShape(ARCH_RADIUS, ARCH_TOP)), ring.matrix, 0, s * STOREY, 0.03)
    shadow.add(new THREE.PlaneGeometry(0.8, 1), ring.matrix, 0, 2 * STOREY + 3.5, 0.03)

    // Stairway mouths in the tier walls, every fourth bay, facing the sand.
    if (k % 4 === 2) {
      for (const wall of TIER_WALLS) {
        const { matrix: at } = bayFrame(k, wall.d)
        shadow.add(new THREE.PlaneGeometry(1.4, 1.6).rotateY(Math.PI), at, 0, wall.y + 0.8, -0.06)
      }
    }
  }

  if (options.grandGate) {
    const gate = bayFrame(BAYS - 1, OUTER, 3)
    outer.add(extrude(archedWall(gate.width + 0.02, 4.2, 13, 2 * STOREY), OUTER_DEPTH), gate.matrix)
    const shaft = new THREE.CylinderGeometry(COLUMN_RADIUS, COLUMN_RADIUS, 2 * STOREY - CORNICE, 8)
    outer.add(shaft, gate.matrix, -gate.width / 2, STOREY - CORNICE / 2)
  }

  // The gates onto the sand at both ends of the long axis; the east one leads out.
  for (const k of [0, BAYS / 2]) {
    shadow.add(new THREE.ShapeGeometry(archShape(1.5, 3.8)).rotateY(Math.PI), bayFrame(k, 0).matrix, 0, 0, -0.05)
  }

  const building = new THREE.Group()
  building.add(outer.mesh(travertine), inner.mesh(brick), shadow.mesh(dark, false), grilles.mesh(iron))

  const stands = new THREE.Mesh(ellipseRing(STAND_PROFILE, 160), seats)
  stands.castShadow = stands.receiveShadow = true
  building.add(stands)

  const sand = new THREE.Mesh(
    new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2).scale(ARENA_A, 1, ARENA_B),
    new THREE.MeshStandardMaterial({ color: '#d6bf8a', roughness: 1, ...surface('dirt') }),
  )
  sand.position.y = 0.02
  sand.receiveShadow = true
  building.add(sand)

  building.add(createEmperorsBox(velvet, gold))
  return building
}

// The emperor's box on the terrace at the middle of the south side: a velvet parapet and backdrop
// under a velvet roof on gold columns.
function createEmperorsBox(velvet: THREE.Material, gold: THREE.Material): THREE.Group {
  const box = new THREE.Group()
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x, PODIUM + y, ARENA_B + z)
    mesh.castShadow = mesh.receiveShadow = true
    box.add(mesh)
  }
  add(new THREE.BoxGeometry(8, 1, 0.25), velvet, 0, 0.5, 0.2)
  add(new THREE.BoxGeometry(8.2, 0.12, 0.35), gold, 0, 1.05, 0.2)
  add(new THREE.BoxGeometry(8, 3, 0.1), velvet, 0, 1.5, 1.9)
  for (const x of [-3.8, -1.3, 1.3, 3.8]) add(new THREE.CylinderGeometry(0.15, 0.15, 3, 8), gold, x, 1.5, 0.3)
  add(new THREE.BoxGeometry(8.6, 0.35, 2.4), velvet, 0, 3.15, 1)
  return box
}

// A surface swept round the ellipses: each profile point (d, y) becomes a ring at offset d and
// height y. Rising points face the centre, outward ones face up.
function ellipseRing(profile: [number, number][], segments: number): THREE.BufferGeometry {
  const positions: number[] = []
  const indices: number[] = []
  for (const [d, y] of profile) {
    for (let j = 0; j <= segments; j++) {
      const t = (j / segments) * 2 * Math.PI
      positions.push((ARENA_A + d) * Math.sin(t), y, (ARENA_B + d) * Math.cos(t))
    }
  }
  for (let i = 0; i < profile.length - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * (segments + 1) + j
      const c = a + segments + 1
      indices.push(a, c, a + 1, a + 1, c, c + 1)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}
