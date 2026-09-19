/**
 * Request-coalesced KIA loader.
 *
 * The map renders many popups; each may want KIA records for one incident.
 * Without coalescing this fires N small queries. This module batches every
 * `loadKiaForIncident(id)` call within a 16ms window into a single
 * `incident_id in (...)` query and fans the results out.
 *
 * Wire into React Query in Phase 3 via `useKiaForIncident`.
 */
import { supabase } from "@/integrations/supabase/client";
import { KIA_LIST_COLUMNS } from "@/lib/selectors";

type KiaRow = Record<string, unknown> & { incident_id: string | null };

type Pending = {
  resolve: (rows: KiaRow[]) => void;
  reject: (err: unknown) => void;
};

const queue: Map<string, Pending[]> = new Map();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  flushTimer = null;
  const ids = Array.from(queue.keys());
  if (ids.length === 0) return;
  const pending = new Map(queue);
  queue.clear();

  try {
    const { data, error } = await supabase
      .from("kia_soldiers")
      .select(KIA_LIST_COLUMNS)
      .in("incident_id", ids);
    if (error) throw error;

    const grouped = new Map<string, KiaRow[]>();
    for (const id of ids) grouped.set(id, []);
    for (const row of (data ?? []) as KiaRow[]) {
      const key = row.incident_id;
      if (key && grouped.has(key)) grouped.get(key)!.push(row);
    }

    for (const [id, waiters] of pending) {
      const rows = grouped.get(id) ?? [];
      for (const w of waiters) w.resolve(rows);
    }
  } catch (err) {
    for (const waiters of pending.values()) {
      for (const w of waiters) w.reject(err);
    }
  }
}

/**
 * Load KIA rows for a single incident. Multiple concurrent calls within
 * one tick are coalesced into one Supabase query.
 */
export function loadKiaForIncident(incidentId: string): Promise<KiaRow[]> {
  return new Promise((resolve, reject) => {
    const list = queue.get(incidentId) ?? [];
    list.push({ resolve, reject });
    queue.set(incidentId, list);
    if (!flushTimer) flushTimer = setTimeout(flush, 16);
  });
}
