import { describe, it, expect } from 'vitest'
import { Grid, col2str } from '@/ascii/grid'
import { convertFrame, type FrameInput } from '@/ascii/convert'
import { drawMinimap } from '@/ascii/overlays'
import { FOREST_MAP } from '@/world/forestMap'
import { surfaceIndex, glyphAt } from '@/ascii/surfaces'

describe('convertFrame', () => {
  it('decodes sky, glyph, dark and parchment cells from the read-back passes', () => {
    const grid = new Grid()
    grid.allocate(3, 2)
    const colour = new Uint8Array(6 * 4)
    const ids = new Uint8Array(6 * 4)

    // Buffer row 1 (pixels 3, 4, 5) maps to the top grid row (cells 0, 1, 2).
    ids[12] = 0
    colour[12] = 154; colour[13] = 165; colour[14] = 140 // pixel 3: sky
    ids[16] = surfaceIndex('pole')
    colour[16] = 200; colour[17] = 100; colour[18] = 50 // pixel 4: lit pole
    ids[20] = surfaceIndex('pole')
    colour[20] = 5; colour[21] = 5; colour[22] = 5 // pixel 5: dark pole

    // Buffer row 0, pixel 0 maps to the bottom-left grid cell (cell 3).
    ids[0] = surfaceIndex('parchment'); ids[1] = 0x80; ids[2] = 0x00
    colour[0] = 200; colour[1] = 200; colour[2] = 200

    const input: FrameInput = {
      colour,
      ids,
      eye: [0, 0, 0],
      forward: [0, 0, -1],
      right: [1, 0, 0],
      up: [0, 1, 0],
      rowsPerMetre: 1,
      t: 0,
    }
    convertFrame(grid, input)

    expect(grid.bg[0]!).toBe(col2str(154, 165, 140))
    expect(grid.glyph[0]!).toBe('')
    expect(grid.glyph[1]!).toBe('|')
    expect(grid.colour[1]!).toBe(col2str(260, 130, 65))
    expect(grid.glyph[2]!).toBe('')
    expect(grid.bg[3]!).toBe(col2str(90, 90, 90))
    expect(grid.depth[3]).toBeCloseTo(200, 1)
  })
})

describe('Grid depth-tested text', () => {
  it('textDepth skips occluded cells and text overwrites non-space cells', () => {
    const grid = new Grid()
    grid.allocate(5, 1)
    grid.setDepth(2, 0, '#', 'c', 1)
    const written = grid.textDepth(0, 0, 'abcde', 'w', 2)
    expect(written).toBe(4)
    expect(grid.glyph[2]!).toBe('#')
    expect(grid.glyph[0]!).toBe('a')
    grid.text(0, 0, 'x y', 'w')
    expect(grid.glyph[1]!).toBe('b')
  })
})

describe('glyphAt', () => {
  it('stone detail turns off below LOD and grass picks are stable', () => {
    const near = { wx: 0.3, wy: 0.02, wz: 0, cellsPerMetre: 20, t: 0 }
    expect(glyphAt(surfaceIndex('stone'), near)).toBe('_')
    expect(glyphAt(surfaceIndex('stone'), { ...near, cellsPerMetre: 2 })).toBe('#')
    const a = glyphAt(surfaceIndex('grass'), near)
    const b = glyphAt(surfaceIndex('grass'), near)
    expect(a).toBe(b)
  })
})

describe('drawMinimap', () => {
  it('puts the player dot on the forest map cell under them, pinned to the edge when off the map', () => {
    const grid = new Grid()
    grid.allocate(100, 40)
    // The box is 42 x 18 with a one-cell margin, so the map's first cell is (58, 22).
    const dotAt = (x: number, z: number) => {
      grid.clear()
      drawMinimap(grid, FOREST_MAP, x, z)
      const i = grid.glyph.indexOf('●')
      expect(grid.colour[i]).toBe('#ff2a1a')
      return [(i % grid.cols) - 58, Math.floor(i / grid.cols) - 22]
    }
    for (const line of FOREST_MAP.art) expect(line.length).toBe(40)
    expect(dotAt(0, 5)).toEqual([33, 13]) // spawn, on the road below the gate
    expect(dotAt(-95, -60)).toEqual([12, 5]) // the middle of the Colosseum
    expect(dotAt(0, 500)).toEqual([33, 15]) // far down the road
    expect(dotAt(-500, -500)).toEqual([0, 0])
  })

  it('draws nothing when the map would take more than half the width', () => {
    const grid = new Grid()
    grid.allocate(80, 40)
    drawMinimap(grid, FOREST_MAP, 0, 5)
    expect(grid.glyph.every((glyph) => glyph === '')).toBe(true)
  })
})
