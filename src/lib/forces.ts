// Force-type categorization helpers.
//
// "Regular" forces are official state security services (Army, FC, Police/CTD,
// Coast Guards, Rangers, etc.). "Irregulars" are pro-state actors that are
// NOT part of the official government chain of command — village defence
// committees, peace committees, tribal lashkars, informants, etc. We track
// their casualties separately so the headline "Security Force KIA" figure
// reflects only uniformed state personnel, matching how ACLED / SATP code
// these incidents.

export const IRREGULAR_FORCE_TYPES = ["Pro-State Militia"] as const;

export type IrregularForceType = typeof IRREGULAR_FORCE_TYPES[number];

export function isIrregularForce(force?: string | null): boolean {
  if (!force) return false;
  return (IRREGULAR_FORCE_TYPES as readonly string[]).includes(force);
}

export const IRREGULARS_LABEL = "Pro-State Irregulars";
export const IRREGULARS_TOOLTIP =
  "Pro-state irregulars (Pro-State Militia) are tracked separately from official Security Forces. They support state operations but are not part of the official government chain of command.";
