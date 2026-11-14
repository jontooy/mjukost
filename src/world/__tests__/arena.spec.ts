import * as THREE from 'three'
import { describe, it, expect } from 'vitest'
import {
  ARENA_X, ARENA_Z, ENTRANCE_ANGLE, GATE_HALF_ANGLE, RING_INNER, RING_OUTER, nearArena, pushOutOfArena,
} from '@/world/arena'

const at = (angle: number, radius: number) =>
  new THREE.Vector3(ARENA_X + radius * Math.sin(angle), 1.7, ARENA_Z + radius * Math.cos(angle))
const radiusOf = (p: THREE.Vector3) => Math.hypot(p.x - ARENA_X, p.z - ARENA_Z)
const angleOf = (p: THREE.Vector3) => Math.atan2(p.x - ARENA_X, p.z - ARENA_Z)
const BACK = ENTRANCE_ANGLE + Math.PI

describe('pushOutOfArena', () => {
  it('leaves the visitor alone on the sand, in the gateway and outside the ring', () => {
    for (const p of [at(0, 3), at(ENTRANCE_ANGLE, 10.5), at(BACK, RING_OUTER + 2)]) {
      const before = p.clone()
      pushOutOfArena(p)
      expect(p.distanceTo(before)).toBeLessThan(1e-9)
    }
  })

  it('pushes a visitor inside the wall out to the nearer face', () => {
    const nearSand = at(BACK, RING_INNER + 1)
    pushOutOfArena(nearSand)
    expect(radiusOf(nearSand)).toBeCloseTo(RING_INNER - 0.5)
    const nearOutside = at(BACK, RING_OUTER - 0.5)
    pushOutOfArena(nearOutside)
    expect(radiusOf(nearOutside)).toBeCloseTo(RING_OUTER + 0.5)
  })

  it('slides a visitor leaning into the gateway wall back into the gateway', () => {
    const p = at(ENTRANCE_ANGLE + GATE_HALF_ANGLE, 10.5)
    pushOutOfArena(p)
    expect(radiusOf(p)).toBeCloseTo(10.5)
    expect(angleOf(p)).toBeCloseTo(ENTRANCE_ANGLE + GATE_HALF_ANGLE - 0.5 / 10.5)
  })
})

describe('nearArena', () => {
  it('keeps trees off the arena, its ring of grass and the path, and nowhere else', () => {
    expect(nearArena(ARENA_X, ARENA_Z, 0)).toBe(true)
    expect(nearArena(ARENA_X, ARENA_Z + RING_OUTER + 5, 0)).toBe(true)
    expect(nearArena(-38, -4, 0)).toBe(true) // a waypoint the path passes through
    expect(nearArena(-38, 10, 0)).toBe(false) // about 10 m off the path
    expect(nearArena(40, 40, 0)).toBe(false)
  })
})
