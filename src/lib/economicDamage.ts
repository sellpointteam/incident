/**
 * Economic-attack damage assessment.
 *
 * Stored on `incidents.economic_damage` as a JSON object of integer counts.
 * Only rendered/edited for `economic_attack` incidents, but the shape is
 * generic so other event types can carry damage figures later.
 */

export const ECONOMIC_DAMAGE_FIELDS = [
  { key: "vehicles_destroyed", label: "Vehicles / Trucks Destroyed" },
  { key: "cell_towers_destroyed", label: "Cell Towers Destroyed" },
  { key: "pipelines_damaged", label: "Oil / Gas Pipelines Damaged" },
  { key: "power_infrastructure_damaged", label: "Power Infrastructure Damaged" },
  { key: "railway_damaged", label: "Railway Track Damaged" },
  { key: "machinery_destroyed", label: "Machinery / Equipment Destroyed" },
] as const;

export type EconomicDamageKey = (typeof ECONOMIC_DAMAGE_FIELDS)[number]["key"];

export type EconomicDamage = Partial<Record<EconomicDamageKey, number>>;

export const EMPTY_ECONOMIC_DAMAGE: EconomicDamage = {};

/** Coerce an unknown jsonb value into a clean damage record. */
export function parseEconomicDamage(value: unknown): EconomicDamage {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const src = value as Record<string, unknown>;
  const out: EconomicDamage = {};
  for (const { key } of ECONOMIC_DAMAGE_FIELDS) {
    const n = Number(src[key]);
    if (Number.isFinite(n) && n > 0) out[key] = Math.floor(n);
  }
  return out;
}

/** Drop zero/empty entries before persisting. */
export function cleanEconomicDamage(value: EconomicDamage): EconomicDamage {
  return parseEconomicDamage(value);
}

export function hasEconomicDamage(value: unknown): boolean {
  return Object.keys(parseEconomicDamage(value)).length > 0;
}

/** e.g. "3 vehicles / trucks destroyed · 1 cell tower destroyed" */
export function economicDamageLines(value: unknown): { label: string; count: number }[] {
  const parsed = parseEconomicDamage(value);
  return ECONOMIC_DAMAGE_FIELDS.filter((f) => (parsed[f.key] ?? 0) > 0).map((f) => ({
    label: f.label,
    count: parsed[f.key] as number,
  }));
}

export function economicDamageSummary(value: unknown): string {
  return economicDamageLines(value)
    .map((l) => `${l.count} ${l.label.toLowerCase()}`)
    .join(" · ");
}
