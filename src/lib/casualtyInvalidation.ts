/**
 * Single source of truth for invalidating everything that depends on
 * casualty data. Call this after ANY mutation of incidents / kia_soldiers /
 * militant_casualties so lists, counts, popups, public stats, and the
 * integrity panel all refresh together.
 */
import type { QueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/queryKeys";

export function invalidateAllCasualtyData(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: qk.incidents.all });
  qc.invalidateQueries({ queryKey: qk.kia.all });
  qc.invalidateQueries({ queryKey: qk.militants.all });
  qc.invalidateQueries({ queryKey: qk.stats.all });
  qc.invalidateQueries({ queryKey: qk.integrity.all });
  // Incident-count queries are keyed under qk.incidents.all so are already covered,
  // but be explicit in case that layout changes.
  qc.invalidateQueries({ queryKey: qk.incidents.countsAll });
  // Legacy key still used by a few admin screens.
  qc.invalidateQueries({ queryKey: ["kia_soldiers"] });
}
