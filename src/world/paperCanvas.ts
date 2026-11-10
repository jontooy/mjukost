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
