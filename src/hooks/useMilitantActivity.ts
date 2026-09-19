/**
 * Dedicated historical dataset for the militant activity overlay.
 *
 * Intentionally independent of the map's date/geography/event filters: the
 * overlay always represents the FULL historical perpetrator-attributed
 * dataset. Only minimal columns are fetched, and the query paginates so it is
 * never silently truncated at Supabase's default row limit.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeProvince, normalizeDistrict, WAZIRISTAN_MIDPOINT } from "@/lib/normalize";
import { useActors, type Actor } from "@/hooks/useActors";
import { getActorColor, type Rgb } from "@/features/map/actorColors";

const PAGE_SIZE = 1000;
const MAX_ROWS = 20000;

/** Actors below this attributed-incident count roll up into their parent. */
export const MIN_INDEPENDENT_INCIDENTS = 8;
/** Actors that always remain individually selectable, regardless of count.
 *  Includes both abbreviations and common aliases so full names such as
 *  "United Baloch Army" still match their short form "UBA". */
export const ALWAYS_INDEPENDENT = ["TTP", "ISKP", "BLA", "JUA", "JuA", "IMP", "UBA", "BRA", "BLF", "BRG"];
/** Minimum incidents required for a group to be listed in the control. */
export const MIN_GROUP_INCIDENTS = 3;

function isAlwaysIndependent(actor: Actor): boolean {
  const names = new Set([actor.name, ...(actor.aliases || [])].map((n) => n.trim().toLowerCase()));
  return ALWAYS_INDEPENDENT.some((n) => names.has(n.toLowerCase()));
}

interface RawRow {
  id: string;
  latitude: number | null;
  longitude: number | null;
  province: string | null;
  district: string | null;
  location_name: string | null;
  country: string | null;
  perpetrator_actor_id: string;
}

export interface ActivityGroup {
  actorId: string;
  name: string;
  color: Rgb;
  count: number;
  points: { lat: number; lng: number }[];
}

const PROVINCE_DEFAULTS: Record<string, { latitude: number; longitude: number }> = {
  "Balochistan": { latitude: 28.49, longitude: 65.09 },
  "Khyber Pakhtunkhwa": { latitude: 34.17, longitude: 71.84 },
  "Sindh": { latitude: 25.89, longitude: 68.52 },
  "Punjab": { latitude: 31.17, longitude: 72.71 },
  "Gilgit-Baltistan": { latitude: 35.80, longitude: 74.98 },
  "Azad Jammu & Kashmir": { latitude: 33.93, longitude: 73.78 },
  "FATA": { latitude: 33.50, longitude: 70.50 },
  "Islamabad Capital Territory": { latitude: 33.6844, longitude: 73.0479 },
};

async function fetchAttributedIncidents(): Promise<RawRow[]> {
  const rows: RawRow[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("incidents")
      .select("id,latitude,longitude,province,district,location_name,country,perpetrator_actor_id")
      .eq("published", true)
      .eq("country", "Pakistan")
      .not("perpetrator_actor_id", "is", null)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as unknown as RawRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchCoordLookup() {
  const { data, error } = await supabase
    .from("district_coordinates")
    .select("country,province,district,tehsil,latitude,longitude");
  if (error) throw error;
  const tehsilMap = new Map<string, { latitude: number; longitude: number }>();
  const districtMap = new Map<string, { latitude: number; longitude: number }>();
  for (const c of data ?? []) {
    const p = normalizeProvince(c.province);
    const d = normalizeDistrict(c.district);
    if (!c.tehsil) districtMap.set(`${c.country}|${p}|${d}`, c);
    else tehsilMap.set(`${c.country}|${p}|${d}|${c.tehsil}`, c);
  }
  return { tehsilMap, districtMap };
}

function resolveCoords(
  row: RawRow,
  lookup: Awaited<ReturnType<typeof fetchCoordLookup>>,
): { lat: number; lng: number } | null {
  if (row.latitude != null && row.longitude != null) return { lat: row.latitude, lng: row.longitude };
  const province = normalizeProvince(row.province ?? "");
  const district = normalizeDistrict(row.district ?? "");
  const country = row.country ?? "Pakistan";
  if (district === "Waziristan") {
    return { lat: WAZIRISTAN_MIDPOINT.latitude, lng: WAZIRISTAN_MIDPOINT.longitude };
  }
  const tehsil = row.location_name?.trim();
  if (tehsil) {
    const t = lookup.tehsilMap.get(`${country}|${province}|${district}|${tehsil}`);
    if (t) return { lat: t.latitude, lng: t.longitude };
  }
  const d = lookup.districtMap.get(`${country}|${province}|${district}`);
  if (d) return { lat: d.latitude, lng: d.longitude };
  const p = PROVINCE_DEFAULTS[province];
  return p ? { lat: p.latitude, lng: p.longitude } : null;
}

/**
 * Decide which actor a row is attributed to for display purposes:
 * significant actors stay independent, tiny subordinate actors roll up to
 * their parent organization.
 */
function buildDisplayMapping(counts: Map<string, number>, actors: Actor[]): Map<string, string> {
  const byId = new Map(actors.map((a) => [a.id, a]));
  const mapping = new Map<string, string>();
  for (const actor of actors) {
    let target = actor;
    const keepIndependent = isAlwaysIndependent(actor) || (counts.get(actor.id) ?? 0) >= MIN_INDEPENDENT_INCIDENTS;
    if (!keepIndependent) {
      // Walk up to the nearest ancestor (guard against cycles).
      const seen = new Set<string>([actor.id]);
      let cursor = actor.parent_actor_id ? byId.get(actor.parent_actor_id) : undefined;
      while (cursor && !seen.has(cursor.id)) {
        seen.add(cursor.id);
        target = cursor;
        const keep = isAlwaysIndependent(cursor) || (counts.get(cursor.id) ?? 0) >= MIN_INDEPENDENT_INCIDENTS;
        if (keep) break;
        cursor = cursor.parent_actor_id ? byId.get(cursor.parent_actor_id) : undefined;
      }
    }
    mapping.set(actor.id, target.id);
  }
  return mapping;
}

/**
 * Returns activity groups (one per displayed actor) sorted by attributed
 * incident count, descending.
 */
export function useMilitantActivity(enabled: boolean) {
  const { data: actors } = useActors();

  return useQuery({
    queryKey: ["militant-activity", "all-history", (actors ?? []).length],
    enabled: enabled && !!actors,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<ActivityGroup[]> => {
      const [rows, lookup] = await Promise.all([fetchAttributedIncidents(), fetchCoordLookup()]);
      const actorList = actors ?? [];
      const byId = new Map(actorList.map((a) => [a.id, a]));

      const rawCounts = new Map<string, number>();
      for (const r of rows) rawCounts.set(r.perpetrator_actor_id, (rawCounts.get(r.perpetrator_actor_id) ?? 0) + 1);

      const mapping = buildDisplayMapping(rawCounts, actorList);
      const groups = new Map<string, ActivityGroup>();

      for (const row of rows) {
        const displayId = mapping.get(row.perpetrator_actor_id) ?? row.perpetrator_actor_id;
        const actor = byId.get(displayId);
        if (!actor) continue;
        const coords = resolveCoords(row, lookup);
        if (!coords) continue;
        let group = groups.get(displayId);
        if (!group) {
          group = {
            actorId: displayId,
            name: actor.name,
            color: getActorColor(actor),
            count: 0,
            points: [],
          };
          groups.set(displayId, group);
        }
        group.count += 1;
        group.points.push(coords);
      }

      return Array.from(groups.values())
        .filter((g) => {
          const actor = byId.get(g.actorId);
          return g.count >= MIN_GROUP_INCIDENTS || (actor ? isAlwaysIndependent(actor) && g.count > 0 : false);
        })
        .sort((a, b) => b.count - a.count);
    },
  });
}
