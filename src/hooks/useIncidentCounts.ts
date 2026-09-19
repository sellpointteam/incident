import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isIrregularForce } from "@/lib/forces";
import { qk } from "@/lib/queryKeys";
import { fetchAllRows } from "@/lib/fetchAllRows";

export interface IncidentCounts {
  sf: Map<string, number>;
  irregular: Map<string, number>;
  militant: Map<string, number>;
}

const EMPTY: IncidentCounts = { sf: new Map(), irregular: new Map(), militant: new Map() };

/**
 * Fetch KIA + militant casualty COUNTS for a specific set of incident IDs.
 * Uses centralized `qk.incidents.counts(...)` so it is invalidated by
 * `invalidateAllCasualtyData` after any casualty mutation.
 */
export function useIncidentCounts(incidentIds: ReadonlyArray<string>, maxIds = 150) {
  const ids = [...new Set(incidentIds)].sort().slice(0, maxIds);
  return useQuery({
    queryKey: qk.incidents.counts(ids),
    enabled: ids.length > 0,
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<IncidentCounts> => {
      if (ids.length === 0) return EMPTY;
      const [kiaRows, milRows] = await Promise.all([
        fetchAllRows<{ incident_id: string | null; force_type: string | null }>((from, to) =>
          supabase
            .from("kia_soldiers")
            .select("incident_id,force_type")
            .in("incident_id", ids)
            .order("id", { ascending: true })
            .range(from, to)
        ),
        fetchAllRows<{ incident_id: string | null }>((from, to) =>
          supabase
            .from("militant_casualties" as any)
            .select("incident_id")
            .in("incident_id", ids)
            .order("id", { ascending: true })
            .range(from, to)
        ),
      ]);

      const sf = new Map<string, number>();
      const irregular = new Map<string, number>();
      for (const row of kiaRows) {
        if (!row.incident_id) continue;
        if (isIrregularForce(row.force_type)) {
          irregular.set(row.incident_id, (irregular.get(row.incident_id) ?? 0) + 1);
        } else {
          sf.set(row.incident_id, (sf.get(row.incident_id) ?? 0) + 1);
        }
      }
      const militant = new Map<string, number>();
      for (const row of milRows) {
        if (!row.incident_id) continue;
        militant.set(row.incident_id, (militant.get(row.incident_id) ?? 0) + 1);
      }
      return { sf, irregular, militant };
    },
  });
}
