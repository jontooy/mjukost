/** Quantised rgb() string cache. 5 bits per channel is plenty for text. */
const colCache = new Map<number, string>()

export function col2str(r: number, g: number, b: number): string {
  r = r < 0 ? 0 : r > 255 ? 255 : r | 0
  g = g < 0 ? 0 : g > 255 ? 255 : g | 0
  b = b < 0 ? 0 : b > 255 ? 255 : b | 0
  const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)
  const s = colCache.get(key)
  if (s !== undefined) return s
  const str = `rgb(${(r >> 3) << 3},${(g >> 3) << 3},${(b >> 3) << 3})`
  colCache.set(key, str)
  return str
}

/**
 * One flat character grid. `glyph[i]` '' means empty, `bg[i]` null means
 * transparent, `depth[i]` is view-space metres (Infinity where nothing was
 * drawn). `i = y * cols + x`, y a row index from the top.
 */
export class Grid {
  cols = 0
  rows = 0
  glyph: string[] = []
  colour: string[] = []
  bg: (string | null)[] = []
  depth: Float32Array = new Float32Array(0)

  allocate(cols: number, rows: number): void {
    this.cols = cols
    this.rows = rows
    const n = cols * rows
    this.glyph = new Array(n).fill('')
    this.colour = new Array(n).fill('')
    this.bg = new Array<string | null>(n).fill(null)
    this.depth = new Float32Array(n).fill(Infinity)
  }

  clear(): void {
    this.glyph.fill('')
    this.colour.fill('')
    this.bg.fill(null)
    this.depth.fill(Infinity)
  }

  /** Write a glyph cell and record its depth, for later compositing. */
  setDepth(x: number, y: number, ch: string, colour: string, d: number): void {
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return
    const i = y * this.cols + x
    this.glyph[i] = ch
    this.colour[i] = colour
    this.depth[i] = d
  }

  setBg(x: number, y: number, colour: string | null): void {
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return
    this.bg[y * this.cols + x] = colour
  }

  /**
   * Left-aligned text on one row, clipped to the grid. Spaces are left
   * transparent so a label does not punch a hole in whatever it sits on.
   * @returns number of glyphs actually written
   */
  text(x: number, y: number, str: string, colour: string): number {
    if (y < 0 || y >= this.rows) return 0
    const base = y * this.cols
    let n = 0
    for (let i = 0; i < str.length; i++) {
      const cx = x + i
      if (cx < 0) continue
      if (cx >= this.cols) break
      if (str[i] === ' ') continue
      const j = base + cx
      this.glyph[j] = str[i]!
      this.colour[j] = colour
      n++
    }
    return n
  }

  /**
   * As text(), but writes only the cells the caller's depth `d` is in front
   * of, so world-anchored labels are occluded by geometry.
   */
  textDepth(x: number, y: number, str: string, colour: string, d: number): number {
    if (y < 0 || y >= this.rows) return 0
    const base = y * this.cols
    let n = 0
    for (let i = 0; i < str.length; i++) {
      const cx = x + i
      if (cx < 0) continue
      if (cx >= this.cols) break
      if (str[i] === ' ') continue
      const j = base + cx
      if (d > this.depth[j]!) continue
      this.glyph[j] = str[i]!
      this.colour[j] = colour
      n++
    }
    return n
  }

  /** Blank a rectangle of cells, clipped to the grid. */
  clearBox(x: number, y: number, w: number, h: number): void {
    const x0 = Math.max(0, x)
    const y0 = Math.max(0, y)
    const x1 = Math.min(this.cols, x + w)
    const y1 = Math.min(this.rows, y + h)
    for (let ry = y0; ry < y1; ry++) {
      const base = ry * this.cols
      for (let rx = x0; rx < x1; rx++) {
        this.glyph[base + rx] = ''
        this.bg[base + rx] = null
      }
    }
  }

  centreText(y: number, str: string, colour: string): number {
    return this.text(Math.floor((this.cols - str.length) / 2), y, str, colour)
  }
}
