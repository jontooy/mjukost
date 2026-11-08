export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Field {
  text: string
  caret: number | null
}

export interface SlotState {
  email: Field
  password: Field
  status: string
  statusIsError: boolean
}

export const SLOT_WIDTH = 1024
export const SLOT_HEIGHT = 640
export const SLOT_REGIONS: { email: Rect; password: Rect } = {
  email: { x: 60, y: 110, w: 904, h: 110 },
  password: { x: 60, y: 300, w: 904, h: 110 },
}

const SLOT_BORDER = '#5c4423'
const SLOT_FIELD_BG = '#2a2118'
const SLOT_LABEL = '#3a2a14'
const SLOT_TEXT = '#f3e3b5'
const SLOT_ERROR = '#7a1010'
const SLOT_STATUS_OK = '#2a2118'

/**
 * Number of characters to drop from the start so the display string fits
 * maxWidth. A single chunk wider than maxWidth returns 0 (it cannot be
 * split, so it overflows).
 */
function fitFromStart(
  display: string,
  measure: (s: string) => TextMetrics,
  maxWidth: number,
): number {
  let start = 0
  while (start < display.length && measure(display.slice(start)).width > maxWidth) start++
  return start
}

function drawSlotField(
  ctx: CanvasRenderingContext2D,
  region: Rect,
  field: Field,
  password: boolean,
): void {
  ctx.fillStyle = SLOT_FIELD_BG
  ctx.fillRect(region.x, region.y, region.w, region.h)
  ctx.strokeStyle = SLOT_BORDER
  ctx.lineWidth = 3
  ctx.strokeRect(region.x, region.y, region.w, region.h)

  const display = password ? '\u2022'.repeat(field.text.length) : field.text
  const measure = ctx.measureText.bind(ctx)
  const drop = fitFromStart(display, measure, region.w - 48)
  const visible = display.slice(drop)
  ctx.font = 'bold 56px serif'
  ctx.fillStyle = SLOT_TEXT
  const baseline = region.y + 74
  ctx.fillText(visible, region.x + 24, baseline)
  if (field.caret !== null) {
    const caret = Math.max(0, field.caret - drop)
    const x = region.x + 24 + measure(visible.slice(0, caret)).width
    ctx.fillRect(x, baseline - 46, 4, 52)
  }
}

export function drawSlot(ctx: CanvasRenderingContext2D, state: SlotState): void {
  ctx.textBaseline = 'alphabetic'

  const gradient = ctx.createLinearGradient(0, 0, 0, SLOT_HEIGHT)
  gradient.addColorStop(0, '#c79f5e')
  gradient.addColorStop(1, '#8a6a3a')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, SLOT_WIDTH, SLOT_HEIGHT)

  ctx.strokeStyle = SLOT_BORDER
  ctx.lineWidth = 6
  ctx.strokeRect(10, 10, SLOT_WIDTH - 20, SLOT_HEIGHT - 20)

  ctx.font = 'small-caps 34px serif'
  ctx.fillStyle = SLOT_LABEL
  ctx.fillText('Name', 60, 90)
  ctx.fillText('Word', 60, 280)

  drawSlotField(ctx, SLOT_REGIONS.email, state.email, false)
  drawSlotField(ctx, SLOT_REGIONS.password, state.password, true)

  ctx.font = '30px serif'
  ctx.fillStyle = state.statusIsError ? SLOT_ERROR : SLOT_STATUS_OK
  ctx.fillText(state.status, 60, 580)
}
