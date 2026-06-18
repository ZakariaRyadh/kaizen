// Design tokens — pulled straight from the Daily Tracker design.
// Canvas + card colors are fixed; the accent is swappable at runtime
// (see AccentContext), so it lives in state, not here.

export const colors = {
  canvas: '#0e0e13',      // app background
  canvasDeep: '#08080c',  // outer / behind phone
  card: '#14141b',        // standard card
  cardAlt: '#15151c',     // lifted card / sheets
  inset: '#0e0e13',       // inset stat boxes
  border: 'rgba(255,255,255,0.05)',
  borderSoft: 'rgba(255,255,255,0.08)',

  text: '#f3f3f7',        // primary heading
  textMid: '#f0f0f5',
  textSoft: '#cfcfd6',
  textMuted: '#9a9aa6',
  textDim: '#7c7c88',
  textFaint: '#63636e',
  textFainter: '#5f5f6b',

  // semantic accents used by category dots / priority tags
  blue: '#3b82f6',
  red: '#ef4444',
  amber: '#f59e0b',
  green: '#22c55e',
};

// Accent swatches offered in Settings (first = default).
export const accentSwatches = [
  '#7c5df5', // purple (default)
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#14b8a6', // teal
];

export const fonts = {
  ui: 'SpaceGrotesk_500Medium',
  uiBold: 'SpaceGrotesk_700Bold',
  uiSemi: 'SpaceGrotesk_600SemiBold',
  mono: 'JetBrainsMono_500Medium',
  monoSemi: 'JetBrainsMono_600SemiBold',
};
