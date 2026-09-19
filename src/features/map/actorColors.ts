/**
 * Deterministic color registry for militant / separatist actors.
 *
 * Known major organizations get explicit tactical colors; every other actor
 * falls back to a stable hash-derived color from the same restrained palette,
 * so a group's color never changes between reloads.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Restrained tactical palette (no neon rainbow). */
const FALLBACK_PALETTE: Rgb[] = [
  { r: 198, g: 40, b: 52 },   // crimson
  { r: 214, g: 122, b: 32 },  // orange
  { r: 38, g: 166, b: 178 },  // cyan/teal
  { r: 132, g: 94, b: 194 },  // violet
  { r: 72, g: 150, b: 90 },   // green
  { r: 200, g: 160, b: 46 },  // amber
  { r: 176, g: 70, b: 138 },  // magenta
  { r: 96, g: 128, b: 176 },  // steel blue
];

/** Explicit assignments keyed by normalized actor name. */
const NAMED_COLORS: Record<string, Rgb> = {
  ttp: { r: 176, g: 168, b: 150 },   // muted sand-grey (readable on light basemap)
  bla: { r: 220, g: 38, b: 38 },     // red
  iskp: { r: 38, g: 41, b: 48 },     // near-black / dark grey
  jua: { r: 249, g: 115, b: 22 },    // orange
  imp: { r: 147, g: 51, b: 234 },    // purple
  uba: { r: 34, g: 197, b: 94 },     // green
  bra: { r: 14, g: 165, b: 233 },    // sky blue
  blf: { r: 245, g: 158, b: 11 },    // amber
  brg: { r: 59, g: 130, b: 246 },    // blue
};

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function getActorColor(actor: { id: string; name: string }): Rgb {
  const named = NAMED_COLORS[normalizeName(actor.name)];
  if (named) return named;
  return FALLBACK_PALETTE[hash(actor.id || actor.name) % FALLBACK_PALETTE.length];
}

export function rgbToCss({ r, g, b }: Rgb, alpha = 1): string {
  return alpha >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
