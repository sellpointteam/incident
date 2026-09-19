/**
 * Shared normalization functions for province, district, tehsil, and location names.
 * All read paths (analytics, filters, maps) AND all write paths (incident/KIA mutations,
 * ingestion review) MUST run through these so we never fragment buckets.
 */

import { DISTRICT_TEHSILS } from "@/lib/tehsils";

/* ============================================================
 * Province
 * ========================================================== */

const PROVINCE_ALIASES: Record<string, string> = {
  // KP variants
  "kp": "Khyber Pakhtunkhwa",
  "kpk": "Khyber Pakhtunkhwa",
  "k.p": "Khyber Pakhtunkhwa",
  "k.p.k": "Khyber Pakhtunkhwa",
  "khyberpakhtunkhwa": "Khyber Pakhtunkhwa",
  "khyber-pakhtunkhwa": "Khyber Pakhtunkhwa",
  "khyber pukhtunkhwa": "Khyber Pakhtunkhwa",
  "kyber pakhtunkhwa": "Khyber Pakhtunkhwa",
  "kyhber pakhtunkhwa": "Khyber Pakhtunkhwa",
  "nwfp": "Khyber Pakhtunkhwa",
  // GB
  "gb": "Gilgit-Baltistan",
  "gilgit baltistan": "Gilgit-Baltistan",
  "gilgit-baltistan": "Gilgit-Baltistan",
  "gilgit": "Gilgit-Baltistan",
  // FATA
  "fata": "FATA",
  // AJK
  "ajk": "Azad Jammu & Kashmir",
  "azad kashmir": "Azad Jammu & Kashmir",
  "azad jammu & kashmir": "Azad Jammu & Kashmir",
  "azad jammu and kashmir": "Azad Jammu & Kashmir",
  // ICT
  "ict": "Islamabad Capital Territory",
  "islamabad": "Islamabad Capital Territory",
  "islamabad capital territory": "Islamabad Capital Territory",
  // Main four
  "punjab": "Punjab",
  "sindh": "Sindh",
  "sind": "Sindh",
  "baluchistan": "Balochistan",
  "balochistan": "Balochistan",
  "balouchistan": "Balochistan",
};

const CANONICAL_PROVINCES = [
  "Khyber Pakhtunkhwa", "Punjab", "Sindh", "Balochistan",
  "Gilgit-Baltistan", "Azad Jammu & Kashmir", "Islamabad Capital Territory", "FATA",
];

/** Canonical province name mapping. Returns "Unknown" if null/empty/unrecognized garbage. */
export function normalizeProvince(p: string | null | undefined): string {
  if (!p) return "Unknown";
  const trimmed = String(p).trim();
  const lower = trimmed.toLowerCase().replace(/\s+/g, " ");
  if (!lower || ["not specified", "not_specified", "unknown", "n/a", "none"].includes(lower)) {
    return "Unknown";
  }
  if (PROVINCE_ALIASES[lower]) return PROVINCE_ALIASES[lower];
  // Fuzzy: closest canonical within edit distance 2
  const fuzzy = closestMatch(lower, CANONICAL_PROVINCES);
  if (fuzzy) return fuzzy;
  return trimmed;
}

/* ============================================================
 * District
 * ========================================================== */

const DISTRICT_ALIASES: Record<string, string> = {
  "waziristan": "Waziristan",
  "afghan border": "Afghan Border",
  "miran shah waziristan": "North Waziristan",
  "miranshah waziristan": "North Waziristan",
  "miranshah": "North Waziristan",
  "miran shah": "North Waziristan",
  "mir ali": "North Waziristan",
  "wana": "South Waziristan",
  "ladha": "South Waziristan",
  "n waziristan": "North Waziristan",
  "s waziristan": "South Waziristan",
  "nwa": "North Waziristan",
  "swa": "South Waziristan",
  "d i khan": "Dera Ismail Khan",
  "di khan": "Dera Ismail Khan",
  "dik": "Dera Ismail Khan",
  "d.i. khan": "Dera Ismail Khan",
  "d.i.khan": "Dera Ismail Khan",
  "d g khan": "Dera Ghazi Khan",
  "dg khan": "Dera Ghazi Khan",
  "d.g. khan": "Dera Ghazi Khan",
  "rwp": "Rawalpindi",
  "khi": "Karachi",
  "lhe": "Lahore",
  "isb": "Islamabad",
  "pesh": "Peshawar",
  "quettta": "Quetta",
  "queta": "Quetta",
  "kohat": "Kohat",
  "bannu": "Bannu",
  "dukki": "Duki",
  "duki": "Duki",
  "qila abdullah": "Killa Abdullah",
  "qilla abdullah": "Killa Abdullah",
  "killa abdullah": "Killa Abdullah",
  "qila saifullah": "Killa Saifullah",
  "qilla saifullah": "Killa Saifullah",
  "killa saifullah": "Killa Saifullah",
  "lower dir": "Dir Lower",
  "dir lower": "Dir Lower",
  "lower-dir": "Dir Lower",
  "upper dir": "Dir Upper",
  "dir upper": "Dir Upper",
  "upper-dir": "Dir Upper",
};

const CANONICAL_DISTRICTS = Array.from(new Set(Object.keys(DISTRICT_TEHSILS)));

/** Canonical district name. Returns null for unknown/not-specified/empty. */
export function normalizeDistrict(d: string | null | undefined): string | null {
  if (!d) return null;
  const trimmed = String(d).trim().replace(/\s+District$/i, "").replace(/\s+/g, " ");
  const lower = trimmed.toLowerCase();
  if (!lower || ["unknown", "not specified", "not_specified", "n/a", "none"].includes(lower)) return null;
  if (DISTRICT_ALIASES[lower]) return DISTRICT_ALIASES[lower];
  // Exact match (case-insensitive) against canonical list
  const exact = CANONICAL_DISTRICTS.find((c) => c.toLowerCase() === lower);
  if (exact) return exact;
  // Fuzzy match within edit distance 2 (handles wazirstan -> Waziristan, quettta -> Quetta)
  const fuzzy = closestMatch(lower, CANONICAL_DISTRICTS);
  if (fuzzy) return fuzzy;
  // Fall back to title-cased input so analytics at least case-collapses
  return titleCase(trimmed);
}

/* ============================================================
 * Tehsil
 * ========================================================== */

const ALL_TEHSILS = Array.from(new Set(Object.values(DISTRICT_TEHSILS).flat()));

/** Canonical tehsil name within a district when provided. */
export function normalizeTehsil(t: string | null | undefined, district?: string | null): string | null {
  if (!t) return null;
  const trimmed = String(t).trim().replace(/\s+/g, " ");
  const lower = trimmed.toLowerCase();
  if (!lower || ["unknown", "not specified", "not_specified", "n/a", "none"].includes(lower)) return null;

  const candidates = (() => {
    if (district) {
      const d = normalizeDistrict(district);
      if (d && DISTRICT_TEHSILS[d]) return DISTRICT_TEHSILS[d];
    }
    return ALL_TEHSILS;
  })();

  const exact = candidates.find((c) => c.toLowerCase() === lower);
  if (exact) return exact;
  const fuzzy = closestMatch(lower, candidates, 2);
  if (fuzzy) return fuzzy;
  return titleCase(trimmed);
}

/* ============================================================
 * Bulk location entity
 * ========================================================== */

export interface LocationEntity {
  country?: string | null;
  province?: string | null;
  district?: string | null;
  tehsil?: string | null;
}

/** Normalize a full location object in one shot. */
export function normalizeLocationEntity<T extends LocationEntity>(loc: T): T {
  const province = normalizeProvince(loc.province);
  const district = normalizeDistrict(loc.district);
  const tehsil = normalizeTehsil(loc.tehsil, district);
  return {
    ...loc,
    province: province === "Unknown" ? loc.province ?? null : province,
    district,
    tehsil,
    country: loc.country ? titleCase(String(loc.country).trim()) : loc.country ?? null,
  };
}

/** Convenience: normalize KIA hometown fields. */
export function normalizeHometown(h: { hometown_province?: string | null; hometown_district?: string | null; hometown_tehsil?: string | null }) {
  const province = normalizeProvince(h.hometown_province);
  const district = normalizeDistrict(h.hometown_district);
  const tehsil = normalizeTehsil(h.hometown_tehsil, district);
  return {
    hometown_province: province === "Unknown" ? h.hometown_province ?? null : province,
    hometown_district: district,
    hometown_tehsil: tehsil,
  };
}

/* ============================================================
 * Misc utilities
 * ========================================================== */

export const WAZIRISTAN_MIDPOINT = { latitude: 32.625, longitude: 69.775 };

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Damerau-Levenshtein distance (handles a single transposition like "wazirstan" -> "waziristan"). */
function editDistance(a: string, b: string): number {
  const al = a.length, bl = b.length;
  if (!al) return bl;
  if (!bl) return al;
  const dp: number[][] = Array.from({ length: al + 1 }, () => new Array(bl + 1).fill(0));
  for (let i = 0; i <= al; i++) dp[i][0] = i;
  for (let j = 0; j <= bl; j++) dp[0][j] = j;
  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
    }
  }
  return dp[al][bl];
}

/** Closest canonical match, scaled by length so short words demand near-exact matches. */
function closestMatch(input: string, candidates: string[], maxDist?: number): string | null {
  if (!input) return null;
  let best: { c: string; d: number } | null = null;
  for (const c of candidates) {
    const cl = c.toLowerCase();
    const d = editDistance(input, cl);
    if (!best || d < best.d) best = { c, d };
  }
  if (!best) return null;
  const limit = maxDist ?? (input.length <= 4 ? 1 : input.length <= 8 ? 2 : 3);
  return best.d <= limit ? best.c : null;
}
