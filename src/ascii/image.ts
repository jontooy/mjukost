import { resolvePrivateMarkdownUrls } from '@/lib/storage'
import { col2str } from './grid'

const RAMP = ' .:-=+*#%@'
/** Cell width over cell height; monospace cells are about twice as tall as wide. */
export const CELL_ASPECT = 0.55

/**
 * A post image shown as glyphs: brightness picks from RAMP, the pixel's colour
 * colours the glyph. Sampled again only when the size it is drawn at changes.
 */
export class AsciiImage {
  image: HTMLImageElement | null = null
  glyph: string[] = []
  colour: string[] = []
  private cols = 0
  private rows = 0
  private readonly canvas = document.createElement('canvas')

  constructor(url: string) {
    void load(url).then((image) => (this.image = image))
  }

  /** Rows the image takes when drawn `cols` cells wide, keeping its aspect. */
  rowsFor(cols: number): number {
    if (!this.image) return 0
    return Math.max(1, Math.round((cols * CELL_ASPECT * this.image.naturalHeight) / this.image.naturalWidth))
  }

  /** Fills `glyph` and `colour` at `cols x rows`; a no-op when that size is cached. */
  sample(cols: number, rows: number): void {
    if (!this.image || (cols === this.cols && rows === this.rows)) return
    this.cols = cols
    this.rows = rows
    this.canvas.width = cols
    this.canvas.height = rows
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true })!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(this.image, 0, 0, cols, rows)
    const data = ctx.getImageData(0, 0, cols, rows).data
    const n = cols * rows
    this.glyph.length = n
    this.colour.length = n
    for (let i = 0; i < n; i++) {
      const r = data[i * 4]!
      const g = data[i * 4 + 1]!
      const b = data[i * 4 + 2]!
      const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
      this.glyph[i] = RAMP[Math.min(RAMP.length - 1, Math.floor(luma * RAMP.length))]!
      this.colour[i] = col2str(r, g, b)
    }
  }
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
