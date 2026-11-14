import * as THREE from 'three'
import { describe, it, expect } from 'vitest'
import { COLOSSEUM_SCALE, COLOSSEUM_X, COLOSSEUM_Z, GATE_X, GATE_Z, nearArena, pushOutOfArena } from '@/world/arena'
import { createColosseum } from '@/world/colosseum'
import { OUTER, ellipseScale } from '@/world/colosseumModel'

// Walks from `from` in steps of 0.2 m toward `direction`, clamping after each step as the controls do.
function walk(clamp: (p: THREE.Vector3) => void, from: THREE.Vector3, direction: THREE.Vector3, steps: number) {
  const p = from.clone()
  for (let i = 0; i < steps; i++) {
    p.addScaledVector(direction, 0.2)
    clamp(p)
  }
  return p
}

describe('the Colosseum in the forest', () => {
  it('keeps visitors outside its walls and leaves them alone elsewhere', () => {
    const outside = new THREE.Vector3(COLOSSEUM_X, 1.7, COLOSSEUM_Z + 30)
    pushOutOfArena(outside)
    expect(outside.z).toBe(COLOSSEUM_Z + 30)
    // Walking straight at the middle stops at the wall on the near side.
    for (const direction of [new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 1).normalize()]) {
      const start = new THREE.Vector3(COLOSSEUM_X, 1.7, COLOSSEUM_Z).addScaledVector(direction, -30)
      const end = walk(pushOutOfArena, start, direction, 300)
      const x = (end.x - COLOSSEUM_X) / COLOSSEUM_SCALE
      const z = (end.z - COLOSSEUM_Z) / COLOSSEUM_SCALE
      expect(ellipseScale(x, z, OUTER)).toBeGreaterThan(1)
      expect(x * direction.x + z * direction.z).toBeLessThan(0)
    }
  })

  it('lets a visitor walking into the gate arch reach the way in', () => {
    for (const dz of [0, 0.8]) {
      const end = walk(pushOutOfArena, new THREE.Vector3(GATE_X + 6, 1.7, GATE_Z + dz), new THREE.Vector3(-1, 0, 0), 60)
      expect(Math.hypot(end.x - GATE_X, end.z - GATE_Z)).toBeLessThan(1.3)
    }
  })

  it('keeps trees off the building, its ring of grass and the path, and nowhere else', () => {
    expect(nearArena(COLOSSEUM_X, COLOSSEUM_Z - 15, 0)).toBe(true) // 3 m out from the north wall
    expect(nearArena(-33, -28, 0)).toBe(true) // a waypoint the path passes through
    expect(nearArena(-15, -40, 0)).toBe(false) // about 18 m off the path
    expect(nearArena(40, 40, 0)).toBe(false)
  })
})

describe('inside the Colosseum', () => {
  const world = createColosseum()
  const portal = world.portals[0]!

  it('keeps visitors on the sand and lets them walk out through the east gate', () => {
    const north = walk(world.clamp, world.spawn.position, new THREE.Vector3(-0.3, 0, -1).normalize(), 300)
    expect(ellipseScale(north.x, north.z, 0)).toBeLessThan(1)
    const east = walk(world.clamp, world.spawn.position, new THREE.Vector3(1, 0, 0), 60)
    expect(east.distanceTo(portal.position)).toBeLessThan(portal.radius)
    expect(world.spawn.position.distanceTo(portal.position)).toBeGreaterThan(portal.radius)
  })
})
