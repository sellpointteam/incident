/**
 * In-memory + localStorage cache for resolved (province, district, tehsil) → coords.
 * Persisted with a version key so we can invalidate after data updates.
 *
 * TTL: 7 days. Max ~1000 entries (LRU on get).
 */

const STORAGE_KEY = "sitrep:geocode:v1";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 1000;

export type GeoPoint = { latitude: number; longitude: number; source: string };

type Entry = { value: GeoPoint; expires: number };

let memory: Map<string, Entry> | null = null;

function load(): Map<string, Entry> {
  if (memory) return memory;
  memory = new Map();
  if (typeof window === "undefined") return memory;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return memory;
    const parsed = JSON.parse(raw) as Record<string, Entry>;
    const now = Date.now();
    for (const [k, v] of Object.entries(parsed)) {
      if (v.expires > now) memory.set(k, v);
    }
  } catch {
    // ignore
  }
  return memory;
}

let persistScheduled = false;
function schedulePersist() {
  if (persistScheduled || typeof window === "undefined") return;
  persistScheduled = true;
  setTimeout(() => {
    persistScheduled = false;
    try {
      const obj: Record<string, Entry> = {};
      for (const [k, v] of load()) obj[k] = v;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch {
      // quota exceeded etc.
    }
  }, 1000);
}

export function geoKey(province?: string | null, district?: string | null, tehsil?: string | null): string {
  return `${(province ?? "").toLowerCase()}|${(district ?? "").toLowerCase()}|${(tehsil ?? "").toLowerCase()}`;
}

export function getCachedGeo(key: string): GeoPoint | null {
  const cache = load();
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expires < Date.now()) {
    cache.delete(key);
    return null;
  }
  // LRU: re-insert
  cache.delete(key);
  cache.set(key, entry);
  return entry.value;
}

export function setCachedGeo(key: string, value: GeoPoint): void {
  const cache = load();
  if (cache.size >= MAX_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, { value, expires: Date.now() + TTL_MS });
  schedulePersist();
}

export function clearGeoCache(): void {
  memory = new Map();
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}
