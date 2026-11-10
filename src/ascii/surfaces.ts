export type SurfaceName =
  | 'default' | 'stone' | 'floor' | 'dirt' | 'grass' | 'pole' | 'foliage' | 'roof' | 'wood'
  | 'iron' | 'gold' | 'velvet' | 'bone' | 'water' | 'flame' | 'glow' | 'eye' | 'parchment'

export interface CellSample {
  wx: number
  wy: number
  wz: number
  cellsPerMetre: number
  t: number
}

export interface Surface {
  /** Vocabulary; a stable world hash picks one glyph per 25 cm world cell. '' draws nothing. */
  glyphs: string
  /** When set, the cell becomes a background fill of the lit colour times this factor. */
  bg?: number
  /** Near-range or animated pattern; null falls back to `glyphs`. */
  detail?: (s: CellSample) => string | null
}

/** ascii-city-2/src/world/source.js:50-55 */
export function hash(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ seed
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

const frac = (v: number) => v - Math.floor(v)

const COURSE = 0.5 // stone course height, metres
const BLOCK = 0.9 // stone block length, metres
const PLANK = 0.2 // wood plank width, metres

export const SURFACE_NAMES: readonly SurfaceName[] = [
  'default', 'stone', 'floor', 'dirt', 'grass', 'pole', 'foliage', 'roof', 'wood',
  'iron', 'gold', 'velvet', 'bone', 'water', 'flame', 'glow', 'eye', 'parchment',
]

/** Index 0 is the sky (no geometry). SURFACES[i + 1] belongs to SURFACE_NAMES[i]. */
export const SURFACES: readonly Surface[] = [
  { glyphs: '', bg: 1 }, // sky
  { glyphs: '#' }, // default: any untagged opaque material
  {
    glyphs: '#', // stone
    detail: (s) => {
      if (s.cellsPerMetre * COURSE < 3) return null
      const course = Math.floor(s.wy / COURSE)
      if (frac(s.wy / COURSE) < 0.12) return '_'
      const along = (s.wx + s.wz) / BLOCK + course * 0.5
      if (frac(along) < 0.06) return '|'
      return hash(Math.floor(along), course, 2) < 0.5 ? '.' : ':'
    },
  },
  { glyphs: '..,' }, // floor
  { glyphs: '.,' }, // dirt
  { glyphs: ',"\'' }, // grass
  { glyphs: '|' }, // pole: trunks, poles, candles
  { glyphs: '&%*' }, // foliage
  { glyphs: '^' }, // roof
  {
    glyphs: '=', // wood
    detail: (s) => (s.cellsPerMetre * PLANK >= 2 && frac((s.wx + s.wz) / PLANK) < 0.15 ? '|' : null),
  },
  { glyphs: '|' }, // iron
  { glyphs: '$' }, // gold
  { glyphs: '%' }, // velvet
  { glyphs: '=o' }, // bone
  {
    glyphs: '-', // water
    detail: (s) => (Math.sin(s.wx * 7 + s.t * 1.4) + Math.cos(s.wz * 9 - s.t * 1.1) > 0.2 ? '~' : '-'),
  },
  {
    glyphs: '*', // flame
    detail: (s) => {
      const f = Math.sin(s.t * 12 + s.wy * 30 + (s.wx + s.wz) * 17)
      return f > 0.3 ? '^' : f > -0.3 ? '*' : "'"
    },
  },
  { glyphs: ':' }, // glow: window panes, daylight, stair glow
  { glyphs: 'o' }, // eye
  { glyphs: '', bg: 0.45 }, // parchment
]

/** Material parameters fragment: `new THREE.MeshStandardMaterial({ color, ...surface('stone') })`. */
export function surface(name: SurfaceName) {
  return { userData: { surface: name } }
}

/** Index into SURFACES for a material's `userData.surface`; untagged is 'default'. */
export function surfaceIndex(name: unknown): number {
  const i = SURFACE_NAMES.indexOf(name as SurfaceName)
  return i < 0 ? 1 : i + 1
}

export function glyphAt(index: number, s: CellSample): string {
  const surface = SURFACES[index] ?? SURFACES[1]!
  const detail = surface.detail?.(s)
  if (detail) return detail
  const g = surface.glyphs
  if (g.length < 2) return g
  const h = hash(Math.floor(s.wx * 4), Math.floor(s.wy * 4) * 131 + Math.floor(s.wz * 4) * 7919, index)
  return g[Math.floor(h * g.length)]!
}
