import * as THREE from 'three'
import type { Post } from '@/types/post'

const WIDTH = 512
const HEIGHT = 640
const PADDING = 32
const CONTENT_WIDTH = WIDTH - PADDING * 2
const BOTTOM_MARGIN = 40

const COLOR_PARCHMENT = '#e8dcc0'
const COLOR_BORDER = '#5a4630'
const COLOR_TITLE = '#2b2016'
const COLOR_DATE = '#6b5a44'
const COLOR_BODY = '#2b2016'

const TITLE_FONT = 'bold 34px serif'
const TITLE_LINE_HEIGHT = 44
const TITLE_MAX_LINES = 3
const TITLE_TOP = 44

const DATE_FONT = 'italic 18px serif'
const DATE_LINE_HEIGHT = 26

const BODY_FONT = '22px serif'
const BODY_LINE_HEIGHT = 32

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let current = ''
  for (const word of text.split(' ')) {
    const candidate = current ? `${current} ${word}` : word
    if (!current || ctx.measureText(candidate).width <= maxWidth) {
      current = candidate
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

function appendEllipsis(ctx: CanvasRenderingContext2D, line: string, maxWidth: number): string {
  while (line.length > 0 && ctx.measureText(`${line}…`).width > maxWidth) {
    line = line.slice(0, -1)
  }
  return `${line}…`
}

function stripMarkdown(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(^|\s)[#*_>~]+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

export function createPostTexture(post: Post): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = COLOR_PARCHMENT
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  ctx.strokeStyle = COLOR_BORDER
  ctx.lineWidth = 3
  ctx.strokeRect(12, 12, WIDTH - 24, HEIGHT - 24)

  ctx.textBaseline = 'top'

  ctx.font = TITLE_FONT
  ctx.fillStyle = COLOR_TITLE
  let titleLines = wrapText(ctx, post.title, CONTENT_WIDTH)
  let titleLineCount = titleLines.length
  if (titleLineCount > TITLE_MAX_LINES) {
    const truncated = titleLines.slice(0, TITLE_MAX_LINES)
    truncated.push(appendEllipsis(ctx, truncated.pop() ?? '', CONTENT_WIDTH))
    titleLines = truncated
    titleLineCount = TITLE_MAX_LINES
  }
  let y = TITLE_TOP
  for (const line of titleLines) {
    ctx.fillText(line, PADDING, y)
    y += TITLE_LINE_HEIGHT
  }

  y += 8
  ctx.font = DATE_FONT
  ctx.fillStyle = COLOR_DATE
  ctx.fillText(new Date(post.created_at).toLocaleDateString(), PADDING, y)
  y += DATE_LINE_HEIGHT + 12

  ctx.font = BODY_FONT
  ctx.fillStyle = COLOR_BODY
  const bodyLines = wrapText(ctx, stripMarkdown(post.body), CONTENT_WIDTH)
  const maxBottom = HEIGHT - BOTTOM_MARGIN
  const fitting = bodyLines.filter((_, i) => y + (i + 1) * BODY_LINE_HEIGHT <= maxBottom)
  if (fitting.length < bodyLines.length) {
    if (fitting.length === 0) fitting.push(bodyLines[0] ?? '')
    fitting.push(appendEllipsis(ctx, fitting.pop() ?? '', CONTENT_WIDTH))
  }
  for (const line of fitting) {
    ctx.fillText(line, PADDING, y)
    y += BODY_LINE_HEIGHT
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}
