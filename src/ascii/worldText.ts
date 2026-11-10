import * as THREE from 'three'
import type { Grid } from './grid'

export interface WorldTextLine { text: string; colour: string }
export type WorldText = WorldTextLine[]
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
    for (const row of wrapText(line.text, width)) {
      if (y > bottom) return
      grid.textDepth(left, y, row, line.colour, rect.d - 0.02)
      y++
    }
  }
}
