import { col2str, type Grid } from './grid'
import { SURFACES, glyphAt, type CellSample } from './surfaces'

export const GAIN = 1.3 // glyphs cover part of a cell, so lit colours are pushed up
export const DARK = 16 // max channel after GAIN below which a cell stays empty
export const DEPTH_RANGE = 400 // metres encoded by the ID pass; equals camera.far

export type Vec3 = readonly [number, number, number]

export interface FrameInput {
  colour: Uint8Array // RGBA sRGB, cols x rows, bottom row first (gl.readPixels order)
  ids: Uint8Array // RGBA: R surface index, G/B depth as 16 bits of DEPTH_RANGE; same order
  eye: Vec3 // camera world position
  forward: Vec3 // unit view direction
  right: Vec3 // camera right * tan(fov/2) * aspect
  up: Vec3 // camera up * tan(fov/2)
  rowsPerMetre: number // grid.rows / (2 tan(fov/2)): rows per metre at 1 m depth
  t: number // seconds
}

const sample: CellSample = { wx: 0, wy: 0, wz: 0, cellsPerMetre: 0, t: 0 }

/** Turns the read-back colour and ID passes into glyphs. The caller clears the grid first. */
export function convertFrame(grid: Grid, input: FrameInput): void {
  const { cols, rows } = grid
  const { colour, ids, eye, forward, right, up, rowsPerMetre } = input
  sample.t = input.t
  for (let y = 0; y < rows; y++) {
    const ny = 1 - ((y + 0.5) / rows) * 2
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x
      const p = ((rows - 1 - y) * cols + x) * 4
      const id = ids[p]!
      const d = (((ids[p + 1]! << 8) | ids[p + 2]!) / 65535) * DEPTH_RANGE
      grid.depth[i] = d
      const surface = SURFACES[id] ?? SURFACES[1]!
      let r = colour[p]!
      let g = colour[p + 1]!
      let b = colour[p + 2]!
      if (surface.bg !== undefined) {
        grid.bg[i] = col2str(r * surface.bg, g * surface.bg, b * surface.bg)
        continue
      }
      r *= GAIN
      g *= GAIN
      b *= GAIN
      if (Math.max(r, g, b) < DARK) continue
      const nx = ((x + 0.5) / cols) * 2 - 1
      sample.wx = eye[0] + d * (forward[0] + nx * right[0] + ny * up[0])
      sample.wy = eye[1] + d * (forward[1] + nx * right[1] + ny * up[1])
      sample.wz = eye[2] + d * (forward[2] + nx * right[2] + ny * up[2])
      sample.cellsPerMetre = rowsPerMetre / d
      const glyph = glyphAt(id, sample)
      if (glyph !== '') {
        grid.glyph[i] = glyph
        grid.colour[i] = col2str(r, g, b)
      }
    }
  }
}
