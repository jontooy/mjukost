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

// A wedge after the reference sketch: sloped top face, holes, two old bites in the rind.
const CHEESE_ART = [
  '                 __.......__',
  '           _.--\'\'::::::::::::::\'\'--._',
  '      _.-\'\'::::::(  )::::::::::(    )::\'\'-._',
  '  _.-\':::::::::::::::::::::::::::::::::::::::\'-._',
  ' |\'\'\'\'\'\'\'\'\'\'--------........_____________________|',
  ' |:::::::::::::::::::::::::::::::::::(      )::::|',
  ' ):::::::::::::::(    ):::::::::::::::(    ):::::|',
  ' (::::::::::::::(      ):::::::::::::::::::::::::|',
  ' ):::::::::::::::(    ):::::::::::(    ):::::::::|',
  ' |:::::(   )::::::::::::::::::::::(      ):::::::|',
  ' |::::::::::::::::::::::::::::::::::(    ):::::::|',
  ' |_____________________/    \\____________________|',
]
const CHEESE_W = Math.max(...CHEESE_ART.map((line) => line.length))
const RIND = new Set('_.-\'|()/\\')

// Bites eat from the right, alternating high and low; everything right of the latest bite is gone.
const BITE_STEP = 5
const BITE_RADIUS = 4
const BITES = Math.ceil((CHEESE_W + BITE_RADIUS * 2) / BITE_STEP) + 1

function eaten(x: number, y: number, bites: number): boolean {
  if (bites === 0) return false
  if (x >= CHEESE_W + BITE_RADIUS - (bites - 1) * BITE_STEP) return true
  for (let i = 0; i < bites; i++) {
    const dx = (x - (CHEESE_W + BITE_RADIUS - i * BITE_STEP)) / 2
    const dy = y - (i % 2 === 0 ? 3 : 8)
    if (dx * dx + dy * dy <= BITE_RADIUS * BITE_RADIUS) return true
  }
  return false
}

// Share of the cheese gone after each bite count, so `fraction` maps to eaten area, not bite count.
const EATEN_SHARE = Array.from({ length: BITES + 1 }, (_, bites) => {
  let total = 0
  let gone = 0
  CHEESE_ART.forEach((line, y) => {
    for (let x = 0; x < line.length; x++) {
      if (line[x] === ' ') continue
      total++
      if (eaten(x, y, bites)) gone++
    }
  })
  return gone / total
})

function drawCheese(grid: Grid, x0: number, y0: number, fraction: number): void {
  let bites = 0
  while (bites < BITES && EATEN_SHARE[bites + 1]! <= fraction) bites++
  for (let y = 0; y < CHEESE_ART.length; y++) {
    const line = CHEESE_ART[y]!
    for (let x = 0; x < line.length; x++) {
      const ch = line[x]!
      if (ch === ' ' || eaten(x, y, bites)) continue
      grid.text(x0 + x, y0 + y, ch, RIND.has(ch) ? EDGE : CHEESE)
    }
  }
}

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

/** `fraction` is how much of the load is done: 0 shows a whole cheese, 1 an empty plate. */
export function drawLoading(grid: Grid, fraction: number): void {
  grid.clear()
  const top = Math.floor((grid.rows - CHEESE_ART.length) / 2) + 3
  for (let y = 0; y < grid.rows; y += 2) {
    for (let x = (y % 4 === 0 ? 0 : 3); x < grid.cols; x += 6) {
      grid.text(x, y, '.', DOTS)
    }
  }
  if (grid.cols >= 56) {
    const x0 = Math.floor((grid.cols - 52) / 2)
    grid.clearBox(x0, top - 6, 52, 4)
    for (let i = 0; i < BANNER.length; i++) {
      grid.text(x0, top - 6 + i, BANNER[i]!, EDGE)
    }
  }
  drawCheese(grid, Math.floor((grid.cols - CHEESE_W) / 2), top, fraction)
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

/** The world's name in a box in the top left, with `coordinates` under it when given. */
export function drawTitle(grid: Grid, title: string, coordinates: string | null): void {
  const line = '─'.repeat(title.length + 4)
  grid.clearBox(1, 1, title.length + 6, 3)
  grid.text(1, 1, `┌${line}┐`, EDGE)
  grid.text(1, 2, '│', EDGE)
  grid.text(4, 2, title, AMBER)
  grid.text(title.length + 6, 2, '│', EDGE)
  grid.text(1, 3, `└${line}┘`, EDGE)
  if (coordinates === null) return
  grid.clearBox(1, 5, coordinates.length + 2, 1)
  grid.text(2, 5, coordinates, INK)
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
