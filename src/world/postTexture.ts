import * as THREE from 'three'
import { resolvePrivateMarkdownUrls } from '@/lib/storage'
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

const IMAGE_HEIGHT = 220
const IMAGE_GAP = 14
const COLOR_IMAGE_PLACEHOLDER = '#d6c8a8'
const COLOR_CROSS = '#e0301e'

// Each line break in the text starts a new line; an empty line stays empty.
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  return text.split('\n').flatMap((paragraph) => wrapLine(ctx, paragraph, maxWidth))
}

function wrapLine(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return ['']
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

// Plain text for the poster; line breaks stay, runs of spaces and three or more breaks shrink.
function stripMarkdown(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(^|\s)[#*_>~]+/g, '$1')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function createCanvasTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')!
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return { ctx, texture }
}

export function createPostTexture(post: Post): THREE.CanvasTexture {
  const { ctx, texture } = createCanvasTexture()

  const imageUrl = post.body.match(/!\[[^\]]*\]\(([^)\s]+)/)?.[1]
  drawPost(ctx, post, imageUrl ? 'loading' : null)
  if (imageUrl) {
    void loadPostImage(imageUrl).then((image) => {
      drawPost(ctx, post, image)
      texture.needsUpdate = true
    })
  }
  return texture
}

// What every poster shows when the posts could not be loaded: the crossed-out mjukost icon.
// Drawn once and shared by all such posters.
let offlineTexture: THREE.CanvasTexture | null = null
export function getOfflineTexture(): THREE.CanvasTexture {
  if (offlineTexture) return offlineTexture
  const { ctx, texture } = createCanvasTexture()
  drawSheet(ctx)
  drawOfflineIcon(ctx)
  offlineTexture = texture
  return texture
}

export async function loadPostImage(url: string): Promise<HTMLImageElement | null> {
  const src = await resolvePrivateMarkdownUrls(url)
  if (src.startsWith('private://')) return null
  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.src = src
  try {
    await image.decode()
    return image
  } catch {
    return null
  }
}

function drawSheet(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = COLOR_PARCHMENT
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  ctx.strokeStyle = COLOR_BORDER
  ctx.lineWidth = 3
  ctx.strokeRect(12, 12, WIDTH - 24, HEIGHT - 24)
}

function drawPost(
  ctx: CanvasRenderingContext2D,
  post: Post,
  image: HTMLImageElement | 'loading' | null,
) {
  drawSheet(ctx)

  ctx.textBaseline = 'top'

  // The title is optional; without one the date moves up.
  let y = TITLE_TOP
  if (post.title) {
    ctx.font = TITLE_FONT
    ctx.fillStyle = COLOR_TITLE
    let titleLines = wrapText(ctx, post.title, CONTENT_WIDTH)
    if (titleLines.length > TITLE_MAX_LINES) {
      const truncated = titleLines.slice(0, TITLE_MAX_LINES)
      truncated.push(appendEllipsis(ctx, truncated.pop() ?? '', CONTENT_WIDTH))
      titleLines = truncated
    }
    for (const line of titleLines) {
      ctx.fillText(line, PADDING, y)
      y += TITLE_LINE_HEIGHT
    }
  }

  y += 8
  ctx.font = DATE_FONT
  ctx.fillStyle = COLOR_DATE
  ctx.fillText(new Date(post.created_at).toLocaleDateString(), PADDING, y)
  y += DATE_LINE_HEIGHT + 12

  const bodyText = stripMarkdown(post.body)
  if (image === 'loading') {
    ctx.fillStyle = COLOR_IMAGE_PLACEHOLDER
    ctx.fillRect(PADDING, y, CONTENT_WIDTH, IMAGE_HEIGHT)
    y += IMAGE_HEIGHT + IMAGE_GAP
  } else if (image) {
    // The whole picture, scaled to fit the room left, keeping two lines for the text if any.
    const textRoom = bodyText ? IMAGE_GAP + BODY_LINE_HEIGHT * 2 : 0
    const room = HEIGHT - BOTTOM_MARGIN - y - textRoom
    const scale = Math.min(CONTENT_WIDTH / image.naturalWidth, room / image.naturalHeight)
    const width = image.naturalWidth * scale
    const height = image.naturalHeight * scale
    ctx.drawImage(image, PADDING + (CONTENT_WIDTH - width) / 2, y, width, height)
    y += height + IMAGE_GAP
  }

  ctx.font = BODY_FONT
  ctx.fillStyle = COLOR_BODY
  const bodyLines = wrapText(ctx, bodyText, CONTENT_WIDTH)
  const maxBottom = HEIGHT - BOTTOM_MARGIN
  const fitting = bodyLines.filter((_, i) => y + (i + 1) * BODY_LINE_HEIGHT <= maxBottom)
  if (fitting.length < bodyLines.length && fitting.length > 0) {
    fitting.push(appendEllipsis(ctx, fitting.pop() ?? '', CONTENT_WIDTH))
  }
  for (const line of fitting) {
    ctx.fillText(line, PADDING, y)
    y += BODY_LINE_HEIGHT
  }
}

// The crossed-out mjukost icon, drawn on a 24-unit grid in the style of Lucide icons.
const OFFLINE_ICON_SIZE = 320
const OFFLINE_ICON_TUBE = [
  'M2 9h2a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z', // cap
  'M5 11h1.5l2-1.5 12-2 1-1h1v11h-1l-1-1-12-2-2-1.5H5', // neck, shoulder, body and seal
  'M8.5 9.5v5', // where the shoulder meets the body
]
const OFFLINE_ICON_CROSS = 'M8 4l9 16M17 4 8 20'

function drawOfflineIcon(ctx: CanvasRenderingContext2D) {
  const scale = OFFLINE_ICON_SIZE / 24
  ctx.save()
  ctx.translate((WIDTH - OFFLINE_ICON_SIZE) / 2, (HEIGHT - OFFLINE_ICON_SIZE) / 2)
  ctx.scale(scale, scale)
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = COLOR_BORDER
  for (const path of OFFLINE_ICON_TUBE) ctx.stroke(new Path2D(path))
  ctx.strokeStyle = COLOR_CROSS
  ctx.stroke(new Path2D(OFFLINE_ICON_CROSS))
  ctx.restore()
}
