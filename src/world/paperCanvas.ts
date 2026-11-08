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

export interface PaperState {
  heading: string
  title: Field
  body: Field
  status: string
  statusIsError: boolean
}

export interface SlotState {
  email: Field
  password: Field
  status: string
  statusIsError: boolean
}

export const PAPER_WIDTH = 1024
export const PAPER_HEIGHT = 1280
export const PAPER_REGIONS: { title: Rect; body: Rect } = {
  title: { x: 72, y: 190, w: 880, h: 80 },
  body: { x: 72, y: 350, w: 880, h: 820 },
}

export const SLOT_WIDTH = 1024
export const SLOT_HEIGHT = 640
export const SLOT_REGIONS: { email: Rect; password: Rect } = {
  email: { x: 60, y: 110, w: 904, h: 110 },
  password: { x: 60, y: 300, w: 904, h: 110 },
}

const LABEL_FONT = 'small-caps 28px serif'
const HEADING_FONT = 'italic 44px serif'
const TITLE_FONT = 'bold 52px serif'
const BODY_FONT = '34px serif'
const STATUS_FONT = '28px serif'
const BODY_LINE_HEIGHT = 46

const PAPER_BG = '#efe4c8'
const PAPER_BORDER = '#5a4630'
const PAPER_MUTED = '#6b5a44'
const PAPER_INK = '#2b2016'
const PAPER_RULE = '#cdbf9f'
const PAPER_ERROR = '#9b2c2c'

const SLOT_BORDER = '#5c4423'
const SLOT_FIELD_BG = '#2a2118'
const SLOT_LABEL = '#3a2a14'
const SLOT_TEXT = '#f3e3b5'
const SLOT_ERROR = '#7a1010'
const SLOT_STATUS_OK = '#2a2118'

interface BodyLine {
  text: string
  start: number
}

/**
 * Greedy word wrap over the substring text[pStart..pEnd). Consecutive
 * spaces inside a paragraph are preserved in the line text so that
 * line.start indexes stay aligned with the original string.
 */
function wrapParagraph(
  text: string,
  pStart: number,
  pEnd: number,
  maxWidth: number,
  measure: (s: string) => TextMetrics,
  out: BodyLine[],
): void {
  let i = pStart
  let lineStart = pStart
  while (i < pEnd) {
    const wordStart = i
    let wordEnd = i
    while (wordEnd < pEnd && text[wordEnd] !== ' ') wordEnd++
    const candidate = text.slice(lineStart, wordEnd)
    if (measure(candidate).width <= maxWidth) {
      i = wordEnd
      if (i < pEnd && text[i] === ' ') i++
      continue
    }
    if (wordStart === lineStart) {
      // Line is empty and the word is wider than the region: break by characters.
      let end = wordStart
      while (end < wordEnd && measure(text.slice(lineStart, end + 1)).width <= maxWidth) end++
      if (end <= wordStart) end = wordStart + 1
      out.push({ text: text.slice(lineStart, end), start: lineStart })
      lineStart = end
      i = end
    } else {
      out.push({ text: text.slice(lineStart, wordStart), start: lineStart })
      lineStart = wordStart
    }
  }
  out.push({ text: text.slice(lineStart, i), start: lineStart })
}

function wrapBody(text: string, maxWidth: number, measure: (s: string) => TextMetrics): BodyLine[] {
  const lines: BodyLine[] = []
  let pos = 0
  while (pos <= text.length) {
    let pEnd = text.indexOf('\n', pos)
    if (pEnd === -1) pEnd = text.length
    wrapParagraph(text, pos, pEnd, maxWidth, measure, lines)
    pos = pEnd + 1
  }
  return lines
}

function findCaretLine(lines: BodyLine[], caret: number): number | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line !== undefined && line.start === caret) return i
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line !== undefined && line.start < caret && caret <= line.start + line.text.length) {
      return i
    }
  }
  return null
}

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

function drawPaperFieldLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number,
  baseline: number,
): void {
  ctx.font = LABEL_FONT
  ctx.fillStyle = PAPER_MUTED
  ctx.fillText(label, x, baseline)
}

export function drawPaper(ctx: CanvasRenderingContext2D, state: PaperState): void {
  ctx.textBaseline = 'alphabetic'

  ctx.fillStyle = PAPER_BG
  ctx.fillRect(0, 0, PAPER_WIDTH, PAPER_HEIGHT)

  ctx.strokeStyle = PAPER_BORDER
  ctx.lineWidth = 4
  ctx.strokeRect(16, 16, PAPER_WIDTH - 32, PAPER_HEIGHT - 32)

  ctx.font = HEADING_FONT
  ctx.fillStyle = PAPER_MUTED
  ctx.fillText(state.heading, 72, 110)

  drawPaperFieldLabel(ctx, 'Title', 72, 170)

  const titleRegion = PAPER_REGIONS.title
  const titleBaseline = titleRegion.y + 60
  const measure = ctx.measureText.bind(ctx)
  ctx.font = TITLE_FONT
  const titleDrop = fitFromStart(state.title.text, measure, titleRegion.w)
  const titleVisible = state.title.text.slice(titleDrop)
  ctx.fillStyle = PAPER_INK
  ctx.fillText(titleVisible, titleRegion.x, titleBaseline)
  if (state.title.caret !== null) {
    const caret = Math.max(0, state.title.caret - titleDrop)
    const x = titleRegion.x + measure(titleVisible.slice(0, caret)).width
    ctx.fillRect(x, titleBaseline - 38, 3, 44)
  }
  ctx.fillStyle = PAPER_BORDER
  ctx.fillRect(titleRegion.x, titleRegion.y + titleRegion.h, titleRegion.w, 2)

  drawPaperFieldLabel(ctx, 'Body', 72, 330)

  const bodyRegion = PAPER_REGIONS.body
  const regionBottom = bodyRegion.y + bodyRegion.h
  ctx.fillStyle = PAPER_RULE
  for (let y = bodyRegion.y + BODY_LINE_HEIGHT; y <= regionBottom; y += BODY_LINE_HEIGHT) {
    ctx.fillRect(bodyRegion.x, y, bodyRegion.w, 1)
  }

  ctx.font = BODY_FONT
  const lines = wrapBody(state.body.text, bodyRegion.w, measure)
  const maxLines = Math.floor(bodyRegion.h / BODY_LINE_HEIGHT)
  const caretLine = state.body.caret !== null ? findCaretLine(lines, state.body.caret) : null
  let startIdx = Math.max(0, lines.length - maxLines)
  let endIdx = lines.length - 1
  if (caretLine !== null && caretLine < startIdx) {
    endIdx = caretLine
    startIdx = Math.max(0, caretLine - maxLines + 1)
  }
  ctx.fillStyle = PAPER_INK
  for (let i = startIdx; i <= endIdx; i++) {
    const line = lines[i]
    if (line === undefined) continue
    const baseline = bodyRegion.y + 36 + (i - startIdx) * BODY_LINE_HEIGHT
    ctx.fillText(line.text, bodyRegion.x, baseline)
    if (state.body.caret !== null && i === caretLine) {
      const x = bodyRegion.x + measure(state.body.text.slice(line.start, state.body.caret)).width
      ctx.fillRect(x, baseline - 30, 3, 36)
    }
  }

  ctx.font = STATUS_FONT
  ctx.fillStyle = state.statusIsError ? PAPER_ERROR : PAPER_MUTED
  ctx.fillText(state.status, 72, 1215)
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
