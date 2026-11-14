import type { WorldMap } from '@/world/engine'

// The forest from above, north (-z) up. The Colosseum sits in the north west, its gate ':' at the
// east end; its path winds to the road in front of the castle gate, and the road runs south
// forever. '^' is a tree, ':' road or path, '.' sand, '=' the stands, a space open ground; any
// other glyph is stone.
export const FOREST_MAP: WorldMap = {
  west: -89.25,
  north: -55.25,
  metresPerCol: 3.5,
  metresPerRow: 6.5,
  art: [
    '^ ^  ╭─────╮ ^^^ ^ ^            ^^^    ^',
    '^^^ ╭╯=====╰╮  ^  ^^^^   ^ ^ ^^^  ^ ^^^^',
    '  ^ │=.....=:::^^     ^^ ^^  ^ ^^^^     ',
    '^^^ ╰╮=====╭╯^^: ^                 ^^ ^ ',
    ' ^ ^ ╰─────╯   :: ^  o───────o  ^^   ^ ^',
    '^^^   ^^^^^   ^ ::^  │ ┌───┐ │    ^ ^^^ ',
    '^^  ^^^^ ^  ^^ ^ :   │ │ # │ │  ^  ^  ^ ',
    '^^   ^^ ^^ ^      :: │ └───┘ │   ^ ^ ^  ',
    ' ^       ^ ^ ^ ^ ^^::o───:───o    ^  ^  ',
    ' ^^ ^ ^   ^ ^^ ^^^^ ^::::: ^   ^ ^     ^',
    '^^^^  ^  ^^   ^^^^  ^^ ^ : ^^^^^^^ ^^  ^',
    '^^^     ^^  ^^^^    ^ ^  : ^ ^     ^^   ',
    ' ^ ^     ^^ ^ ^ ^  ^ ^   :    ^   ^^   ^',
    ' ^^ ^ ^^^^    ^^ ^ ^^    :    ^^^ ^^^^^ ',
    '   ^^ ^     ^^^ ^^  ^ ^  :   ^ ^^ ^^^ ^ ',
    '^      ^^ ^^^  ^^^^    ^ : ^^ ^ ^^   ^^^',
  ],
}
