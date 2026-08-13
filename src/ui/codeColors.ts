// Palette codes/themes are auto-assigned from, in order, then cycle.
// Distinct, accessible-on-white hues — deliberately separate from the app's
// own ink/accent chrome so coded highlights never get confused with UI state.
export const CODE_COLOR_PALETTE = [
  '#dc2626', // red
  '#ea580c', // orange
  '#d97706', // amber
  '#65a30d', // lime
  '#16a34a', // green
  '#0d9488', // teal
  '#0891b2', // cyan
  '#2563eb', // blue
  '#4f46e5', // indigo
  '#7c3aed', // violet
  '#c026d3', // fuchsia
  '#db2777', // pink
  '#78716c', // stone
  '#0f766e', // deep teal
  '#b45309', // deep amber
  '#4338ca', // deep indigo
];

export function colorForIndex(index: number): string {
  return CODE_COLOR_PALETTE[index % CODE_COLOR_PALETTE.length]!;
}

// Deterministic fallback so the same code label always gets the same color
// even without a stored index (e.g. legacy data with no color field).
export function colorForLabel(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  return colorForIndex(hash);
}
