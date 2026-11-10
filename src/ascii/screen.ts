import { Grid } from './grid'

export const FONT_PX = 14
export const FONT_STACK = 'ui-monospace, Menlo, Consolas, monospace'
export const LINE_RATIO = 1.05

export class Screen extends Grid {
  readonly ctx: CanvasRenderingContext2D
  cw = 8
  ch = 15
  width = 0
  height = 0

  constructor(readonly canvas: HTMLCanvasElement) {
    super()
    this.ctx = canvas.getContext('2d', { alpha: false })!
    this.resize()
  }

  resize(): void {
    const w = Math.max(1, Math.round(this.canvas.clientWidth || window.innerWidth))
    const h = Math.max(1, Math.round(this.canvas.clientHeight || window.innerHeight))
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.canvas.width = Math.round(w * dpr)
    this.canvas.height = Math.round(h * dpr)
    const ctx = this.ctx
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.textBaseline = 'top'
    ctx.font = `${FONT_PX}px ${FONT_STACK}`
    this.cw = ctx.measureText('MMMMMMMMMM').width / 10 || 8
    this.ch = Math.round(FONT_PX * LINE_RATIO)
    this.width = w
    this.height = h
    this.allocate(Math.max(24, Math.floor(w / this.cw)), Math.max(12, Math.floor(h / this.ch)))
  }

  blit(): void {
    const { ctx, cols, rows, cw, ch, bg, glyph, colour } = this

    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, this.width, this.height)

    // Pass one: batch runs of equal non-null bg into one fillRect per row segment.
    for (let y = 0; y < rows; y++) {
      const base = y * cols
      let x = 0
      while (x < cols) {
        const b = bg[base + x]!
        if (b === null) {
          x++
          continue
        }
        let x2 = x + 1
        while (x2 < cols && bg[base + x2]! === b) x2++
        ctx.fillStyle = b
        ctx.fillRect(x * cw, y * ch, (x2 - x) * cw, ch)
        x = x2
      }
    }

    // Pass two: batch runs of equal colour into one fillText per row segment.
    ctx.font = `${FONT_PX}px ${FONT_STACK}`

    for (let y = 0; y < rows; y++) {
      const base = y * cols
      let run = ''
      let runCol = ''
      let runStart = 0

      for (let x = 0; x < cols; x++) {
        const g = glyph[base + x]!
        if (g === '' || g === ' ') {
          if (run) {
            ctx.fillStyle = runCol
            ctx.fillText(run, runStart * cw, y * ch)
            run = ''
          }
          continue
        }
        const c = colour[base + x]!
        if (run && c !== runCol) {
          ctx.fillStyle = runCol
          ctx.fillText(run, runStart * cw, y * ch)
          run = ''
        }
        if (!run) {
          runStart = x
          runCol = c
        }
        run += g
      }
      if (run) {
        ctx.fillStyle = runCol
        ctx.fillText(run, runStart * cw, y * ch)
      }
    }
  }
}
