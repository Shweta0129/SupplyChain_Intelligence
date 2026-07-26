/**
 * The control-tower palette, carried over from the Streamlit original.
 *
 * Every multi-hue set was re-stepped against the dataviz validator (lightness
 * band, chroma floor, adjacent-pair CVD separation, normal-vision floor,
 * contrast) in BOTH modes — the original nine-slice status ramp had pairs that
 * were indistinguishable even with full colour vision. Dark mode is its own set
 * of steps against the dark surface, not an automatic flip.
 *
 * The one deliberate exception is `neutral`: an achromatic slot reserved for
 * "on hold / cancelled" states. It sits below the chroma floor on purpose, and
 * every chart that uses it also ships a legend and direct labels, so identity
 * is never colour-alone.
 */

export type Palette = {
  ink: string;
  ink2: string;
  muted: string;
  brand: string;
  brandDk: string;
  brandSoft: string;
  mint: string;
  amber: string;
  red: string;
  neutral: string;
  grid: string;
  card: string;
  line: string;
  status: Record<string, string>;
  delivery: Record<string, string>;
  shipMode: Record<string, string>;
  /** Sequential ramp endpoints for magnitude-only bars. */
  rampFrom: string;
  rampTo: string;
  /** Diverging poles for the discount-vs-margin scatter. */
  divLow: string;
  divMid: string;
  divHigh: string;
};

export const lightPalette: Palette = {
  ink: "#0B1437",
  ink2: "#3A4258",
  muted: "#8A93A8",
  brand: "#2B5FCF",
  brandDk: "#1E3A8A",
  brandSoft: "#C8D9F5",
  mint: "#0E9F6E",
  amber: "#D97706",
  red: "#B91C1C",
  neutral: "#7C879E",
  grid: "#EEF1F8",
  card: "#FFFFFF",
  line: "#E6ECF7",
  status: {
    COMPLETE: "#0E9F6E",
    PENDING_PAYMENT: "#D97706",
    PROCESSING: "#3B82F6",
    PENDING: "#CA8A04",
    CLOSED: "#1D4ED8",
    ON_HOLD: "#7C879E",
    SUSPECTED_FRAUD: "#A855F7",
    CANCELED: "#B91C1C",
    PAYMENT_REVIEW: "#0891B2",
  },
  delivery: {
    "Shipping on time": "#0E9F6E",
    "Advance shipping": "#3B82F6",
    "Late delivery": "#B91C1C",
    "Shipping canceled": "#7C879E",
  },
  shipMode: {
    "First Class": "#0E9F6E",
    "Second Class": "#3B82F6",
    "Same Day": "#B91C1C",
    "Standard Class": "#D97706",
  },
  rampFrom: "#C8D9F5",
  rampTo: "#2B5FCF",
  divLow: "#B91C1C",
  divMid: "#B8BFCC",
  divHigh: "#0E9F6E",
};

export const darkPalette: Palette = {
  ink: "#EEF2FB",
  ink2: "#C3CBDD",
  muted: "#8D98B2",
  brand: "#5A8AE8",
  brandDk: "#3F6BCF",
  brandSoft: "#2C3D63",
  mint: "#1FA377",
  amber: "#C98214",
  red: "#DC5C58",
  neutral: "#98A3B8",
  grid: "#1E2842",
  card: "#131A2C",
  line: "#24304A",
  status: {
    COMPLETE: "#1FA377",
    PENDING_PAYMENT: "#C98214",
    PROCESSING: "#5A8AE8",
    PENDING: "#B58A1E",
    CLOSED: "#3F6BCF",
    ON_HOLD: "#98A3B8",
    SUSPECTED_FRAUD: "#9B5FE0",
    CANCELED: "#DC5C58",
    PAYMENT_REVIEW: "#1B93C4",
  },
  delivery: {
    "Shipping on time": "#1FA377",
    "Advance shipping": "#5A8AE8",
    "Late delivery": "#DC5C58",
    "Shipping canceled": "#98A3B8",
  },
  shipMode: {
    "First Class": "#1FA377",
    "Second Class": "#5A8AE8",
    "Same Day": "#DC5C58",
    "Standard Class": "#C98214",
  },
  rampFrom: "#2C3D63",
  rampTo: "#6C97F2",
  divLow: "#DC5C58",
  divMid: "#6B7590",
  divHigh: "#1FA377",
};

/** Sequential ramp: one hue, light → dark. Magnitude only, never identity. */
export function ramp(n: number, from: string, to: string): string[] {
  if (n <= 1) return [to];
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return rgbToHex(
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t),
    );
  });
}

/** Two-pole diverging mix with a neutral midpoint, clamped to [-1, 1]. */
export function diverge(t: number, p: Palette): string {
  const x = Math.max(-1, Math.min(1, t));
  const [from, to] = x < 0 ? [p.divMid, p.divLow] : [p.divMid, p.divHigh];
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const k = Math.abs(x);
  return rgbToHex(
    Math.round(a[0] + (b[0] - a[0]) * k),
    Math.round(a[1] + (b[1] - a[1]) * k),
    Math.round(a[2] + (b[2] - a[2]) * k),
  );
}

/** Late-delivery severity — a status scale, not a categorical one. */
export function lateColor(pct: number, p: Palette): string {
  if (pct < 50) return p.mint;
  if (pct < 60) return p.amber;
  return p.red;
}

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
