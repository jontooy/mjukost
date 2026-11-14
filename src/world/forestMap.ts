import type { WorldMap } from '@/world/engine'

// The forest from above, north (-z) up, generated from the real layout. The Colosseum sits in the
// north west, its gate at the east end; its path winds to the road in front of the castle gate,
// and the road runs south forever. '^' is a tree, ':' road or path, '.' sand, '=' the stands,
// '#' the Colosseum's walls, a space open ground; any other glyph is stone.
export const FOREST_MAP: WorldMap = {
  west: -150.75,
  north: -110.5,
  metresPerCol: 4.5,
  metresPerRow: 8.5,
  art: [
    '^ ^ ^              ^            ^^^    ^',
    '^^^     #########    ^   ^ ^ ^^^  ^ ^^^^',
    '    ###===========##   ^ ^^  ^ ^^^^     ',
    '   ##===============##   ^ ^ ^     ^^ ^ ',
    '  #====..........====##  ^^  ^  ^^   ^ ^',
    ' ##===.............===#::^^^      ^ ^^^ ',
    ' ##===............====#  ::^^  ^^  ^  ^ ',
    '  ##====.........====##  ^: ^^^^ ^ ^ ^  ',
    '   ##===============##    :: ^^   ^  ^  ',
    ' ^   ###=========###   ^ ^ :  o─────o  ^',
    '^^^^    #########    ^ ^   :  │ ┌─┐ │  ^',
    '^^^                 ^ ^  ^ :: │ └─┘ │   ',
    ' ^ ^     ^^ ^ ^ ^  ^ ^   ^  ::o──:──o  ^',
    ' ^^ ^ ^^^^    ^^ ^ ^^        :::::      ',
    '   ^^ ^     ^^^ ^^  ^ ^ ^    ^ ^ : ^^ ^ ',
    '^      ^^ ^^^  ^^^^    ^^  ^^ ^  :   ^^^',
  ],
}
