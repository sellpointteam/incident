/**
 * Keyset-paginated incident list for the admin table.
 *
 * Why infinite + keyset:
 * - Offset pagination forces Postgres to count and discard every prior row.
 *   At 10k+ incidents this is wasteful and produces inconsistent pages
 *   when rows are inserted between fetches.
 * - We sort by (date desc, id desc) and use the last row's (date, id) as
 *   the cursor for the next page — O(log n) regardless of depth, and
 *   stable across concurrent inserts.
 */
import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk, type IncidentFilters } from "@/lib/queryKeys";
import { INCIDENT_DETAIL_COLUMNS } from "@/lib/selectors";
import {
  decodeDateIdCursor,
  encodeDateIdCursor,
  type KeysetPage,
} from "@/lib/pagination";
import type { Incident } from "@/lib/types";

const PAGE_SIZE = 50;

export function usePaginatedAdminIncidents(filters: IncidentFilters = {}) {
  return useInfiniteQuery<KeysetPage<Incident, string>>({
    queryKey: [...qk.incidents.admin(filters), "paged"] as const,
    initialPageParam: null as string | null,
    staleTime: 30_000,
    getNextPageParam: (last) => last.nextCursor,
    queryFn: async ({ pageParam }) => {
      let q = supabase
        .from("incidents")
        .select(INCIDENT_DETAIL_COLUMNS)
        .order("date", { ascending: false })
        .order("id", { ascending: false })
        .limit(PAGE_SIZE);

      if (filters.publishedOnly) q = q.eq("published", true);
      if (filters.province) q = q.eq("province", filters.province);
      if (filters.district) q = q.eq("district", filters.district);
      if (filters.eventType) q = q.eq("event_type", filters.eventType as any);
      if (filters.dateFrom) q = q.gte("date", filters.dateFrom);
      if (filters.dateTo) q = q.lte("date", filters.dateTo);

      const cursor = decodeDateIdCursor(pageParam as string | null);
      if (cursor) {
        // Keyset: rows strictly after (date, id) in our sort order
        q = q.or(
          `date.lt.${cursor.date},and(date.eq.${cursor.date},id.lt.${cursor.id})`,
        );
      }

      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as Incident[];
      const last = rows[rows.length - 1];
      const nextCursor =
        rows.length === PAGE_SIZE && last
          ? encodeDateIdCursor(last.date, last.id)
          : null;
      return { rows, nextCursor };
    },
  });
}
