// Half-widths down the outline of a mjukost tube, from the crimped seal (0) to the end of the cap (1),
// as fractions of the tube's length.
export const MJUKOST_PROFILE = [
  [0, 0.175], // crimped seal
  [0.026, 0.175],
  [0.044, 0.159], // seal flares into the body
  [0.882, 0.1], // body tapers to the shoulder
  [0.918, 0.039], // shoulder narrows to the neck
  [0.953, 0.039],
  [0.953, 0.056], // cap
  [1, 0.056],
] as const
