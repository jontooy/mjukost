import { resolvePrivateMarkdownUrls } from '@/lib/storage'
import { col2str } from './grid'

const RAMP = ' .:-=+*#%@'
/** Cell width over cell height; monospace cells are about twice as tall as wide. */
const CELL_ASPECT = 0.55
/** Largest side of the stored art, in cells; the API rejects more. */
const ART_SIZE = 80

/**
 * A post's first image as glyphs, computed when the post is saved and stored with it.
 * `levels` has one digit per cell, an index into RAMP; `colours` six hex digits per cell.
 * Digits rather than glyphs, because the API trims strings and RAMP starts with a space.
 */
export interface AsciiArt {
  cols: number
  rows: number
  levels: string
  colours: string
}

/** Stored art decoded once for drawing. */
export class AsciiImage {
  readonly cols: number
  readonly rows: number
  readonly glyph: string[]
  readonly colour: string[]

  constructor(art: AsciiArt) {
    this.cols = art.cols
    this.rows = art.rows
    this.glyph = Array.from(art.levels, (level) => RAMP[Number(level)]!)
    this.colour = this.glyph.map((_, i) => {
      const hex = parseInt(art.colours.slice(i * 6, i * 6 + 6), 16)
      return col2str(hex >> 16, (hex >> 8) & 255, hex & 255)
    })
  }
}

/** Art for the first image in a post body, or null when there is none or it cannot load. */
export async function asciiArtFor(body: string): Promise<AsciiArt | null> {
  const url = body.match(/!\[[^\]]*\]\(([^)\s]+)/)?.[1]
  if (!url) return null
  const image = await load(url)
  if (!image) return null

  const tall = (image.naturalHeight * CELL_ASPECT) / image.naturalWidth
  const cols = tall > 1 ? Math.max(1, Math.round(ART_SIZE / tall)) : ART_SIZE
  const rows = tall > 1 ? ART_SIZE : Math.max(1, Math.round(ART_SIZE * tall))
  const canvas = document.createElement('canvas')
  canvas.width = cols
  canvas.height = rows
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, 0, 0, cols, rows)
  const data = ctx.getImageData(0, 0, cols, rows).data

  let levels = ''
  let colours = ''
  for (let i = 0; i < cols * rows; i++) {
    const r = data[i * 4]!
    const g = data[i * 4 + 1]!
    const b = data[i * 4 + 2]!
    const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
    levels += Math.min(RAMP.length - 1, Math.floor(luma * RAMP.length))
    colours += ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')
  }
  return { cols, rows, levels, colours }
}

async function load(url: string): Promise<HTMLImageElement | null> {
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
