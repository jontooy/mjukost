import * as THREE from 'three'
import type { Grid } from './grid'
import type { AsciiImage } from './image'

/** One line of a sign. With `image`, the picture is drawn once it has loaded; `text` shows until then. */
export interface WorldTextLine { text: string; colour: string; image?: AsciiImage }
export type WorldText = WorldTextLine[]

/** Rows kept below an image so at least one line of the text after it shows. */
const TEXT_ROOM = 2

export interface CellRect { x0: number; y0: number; x1: number; y1: number; d: number }

const _w = new THREE.Vector3()
const _v = new THREE.Vector3()

export function projectRect(
  mesh: THREE.Mesh,
  camera: THREE.PerspectiveCamera,
  cols: number,
  rows: number,
): CellRect | null {
  const geo = mesh.geometry
  if (geo.boundingBox === null) geo.computeBoundingBox()
  const box = geo.boundingBox!

  let minPx = Infinity, maxPx = -Infinity
  let minPy = Infinity, maxPy = -Infinity
  let minD = Infinity

  for (const cx of [box.min.x, box.max.x]) {
    for (const cy of [box.min.y, box.max.y]) {
      for (const cz of [box.min.z, box.max.z]) {
        _w.set(cx, cy, cz).applyMatrix4(mesh.matrixWorld)
        _v.copy(_w).applyMatrix4(camera.matrixWorldInverse)
        const d = -_v.z
        if (d <= camera.near) return null
        _w.project(camera)
        const px = (_w.x + 1) / 2 * cols
        const py = (1 - _w.y) / 2 * rows
        if (px < minPx) minPx = px
        if (px > maxPx) maxPx = px
        if (py < minPy) minPy = py
        if (py > maxPy) maxPy = py
        if (d < minD) minD = d
      }
    }
  }

  return {
    x0: Math.floor(minPx),
    y0: Math.floor(minPy),
    x1: Math.ceil(maxPx) - 1,
    y1: Math.ceil(maxPy) - 1,
    d: minD,
  }
}

export function wrapText(text: string, width: number): string[] {
  if (text === '') return ['']
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    if (word.length > width) {
      if (line !== '') { lines.push(line); line = '' }
      for (let i = 0; i < word.length; i += width) lines.push(word.slice(i, i + width))
      continue
    }
    if (line === '') line = word
    else if (line.length + 1 + word.length <= width) line += ' ' + word
    else { lines.push(line); line = word }
  }
  if (line !== '') lines.push(line)
  return lines
}

export function drawWorldText(grid: Grid, rect: CellRect, lines: WorldText): void {
  const left = rect.x0 + 1
  const width = rect.x1 - rect.x0 - 1
  const top = rect.y0 + 1
  const bottom = rect.y1 - 1
  if (width < 8 || bottom < top) return
  let y = top
  for (const line of lines) {
    const image = line.image
    if (image?.image) {
      const fullRows = image.rowsFor(width)
      const rows = Math.min(fullRows, bottom - y + 1 - TEXT_ROOM)
      if (rows < 1) continue
      const cols = Math.max(1, Math.round((width * rows) / fullRows))
      image.sample(cols, rows)
      const x0 = left + Math.floor((width - cols) / 2)
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c
          grid.textDepth(x0 + c, y + r, image.glyph[i]!, image.colour[i]!, rect.d - 0.02)
        }
      }
      y += rows
      continue
    }
    for (const row of wrapText(line.text, width)) {
      if (y > bottom) return
      grid.textDepth(left, y, row, line.colour, rect.d - 0.02)
      y++
    }
  }
}
