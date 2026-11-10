import * as THREE from 'three'
import type { Grid } from './grid'
import { projectRect } from './worldText'
import { SLOT_WIDTH, SLOT_HEIGHT, SLOT_REGIONS, type SlotState, type Field, type Rect } from '@/world/paperCanvas'

const AMBER = '#ffd479'
const INK = '#f3e3b5'
const EDGE = '#c79f5e'
const FIELD_BG = '#2a2118'
const ERROR = '#ff8a6c'
const CHEESE = '#f3af1a'
const DOTS = '#14100a'

const SPIN = ['.  ', '.. ', '...', ' ..', '  .', '   ']

export const BANNER = [
  ' __  __      _   _   _   _  __   ___    ___   _____ ',
  '|  \\/  |  _ | | | | | | | |/ /  / _ \\  / __| |_   _|',
  "| |\\/| | | || | | |_| | | ' <  | (_) | \\__ \\   | |  ",
  '|_|  |_|  \\__/   \\___/  |_|\\_\\  \\___/  |___/   |_|  ',
]

export const SAD_MJUKOST = [
  '     _____________________ ',
  '    /                    /|',
  '   /____________________/ |',
  '   )                    | |',
  '  (    (o)       (o)    | |',
  '   )         .          | |',
  '  (       .-----.       | |',
  '   )     /       \\      | /',
  '   (____________________|/ ',
]

export function drawLoading(grid: Grid, t: number): void {
  grid.clear()
  const mid = Math.floor(grid.rows / 2)
  for (let y = 0; y < grid.rows; y += 2) {
    for (let x = (y % 4 === 0 ? 0 : 3); x < grid.cols; x += 6) {
      grid.text(x, y, '.', DOTS)
    }
  }
  if (grid.cols >= 56) {
    const x0 = Math.floor((grid.cols - 52) / 2)
    grid.clearBox(x0, mid - 5, 52, 4)
    for (let i = 0; i < BANNER.length; i++) {
      grid.text(x0, mid - 5 + i, BANNER[i]!, EDGE)
    }
  }
  grid.centreText(mid + 1, 'Loading' + SPIN[Math.floor(t * 6) % 6]!, INK)
}

export function drawError(grid: Grid): void {
  grid.clear()
  const x0 = Math.floor((grid.cols - 27) / 2)
  const mid = Math.floor(grid.rows / 2)
  for (let i = 0; i < SAD_MJUKOST.length; i++) {
    grid.text(x0, mid - 10 + i, SAD_MJUKOST[i]!, CHEESE)
  }
  grid.centreText(mid + 1, 'Ups! Something went wrong...', ERROR)
}

export function drawCrosshair(grid: Grid): void {
  grid.text(Math.floor(grid.cols / 2), Math.floor(grid.rows / 2), '+', INK)
}

export function drawPlate(grid: Grid, camera: THREE.PerspectiveCamera, plate: THREE.Mesh, state: SlotState): void {
  const rect = projectRect(plate, camera, grid.cols, grid.rows)
  if (rect === null) return
  const fx = (x: number) => rect.x0 + Math.round((x / SLOT_WIDTH) * (rect.x1 - rect.x0))
  const fy = (y: number) => rect.y0 + Math.round((y / SLOT_HEIGHT) * (rect.y1 - rect.y0))

  function drawField(label: string, r: Rect, field: Field, password: boolean): void {
    const left = fx(r.x)
    const right = fx(r.x + r.w)
    const top = fy(r.y)
    const bottom = Math.max(fy(r.y + r.h), top + 2)

    grid.text(left, top - 1, label, AMBER)

    const border = '+' + '-'.repeat(right - left - 1) + '+'
    grid.text(left, top, border, EDGE)
    grid.text(left, bottom, border, EDGE)
    for (let y = top + 1; y < bottom; y++) {
      grid.text(left, y, '|', EDGE)
      grid.text(right, y, '|', EDGE)
      for (let x = left + 1; x < right; x++) {
        grid.setBg(x, y, FIELD_BG)
      }
    }

    const mid = Math.floor((top + bottom) / 2)
    const w = right - left - 3
    const shown = password ? '*'.repeat(field.text.length) : field.text
    const start = Math.max(0, Math.max(shown.length, (field.caret ?? 0) + 1) - w)
    grid.text(left + 2, mid, shown.slice(start, start + w), INK)

    if (field.caret !== null) {
      const cx = left + 2 + field.caret - start
      grid.setBg(cx, mid, INK)
      const ch = shown.slice(start, start + w)[cx - (left + 2)]
      if (ch !== undefined) grid.text(cx, mid, ch, FIELD_BG)
    }
  }

  drawField('Name', SLOT_REGIONS.email, state.email, false)
  drawField('Word', SLOT_REGIONS.password, state.password, true)

  if (state.status !== '') {
    grid.text(fx(60), fy(580), state.status, state.statusIsError ? ERROR : INK)
  }
}
