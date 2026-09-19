/**
 * React Query hook for KIA records linked to a single incident.
 *
 * Routes through the request-coalescing `loadKiaForIncident` so multiple
 * popups opened in the same tick collapse into one Supabase round-trip.
 */
import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/queryKeys";
import { loadKiaForIncident } from "@/lib/cache/kiaCache";

export function useKiaForIncident(incidentId: string | null, enabled = true) {
  return useQuery({
    queryKey: incidentId ? qk.kia.byIncident([incidentId]) : ["kia", "byIncident", "noop"],
    queryFn: () => loadKiaForIncident(incidentId!),
    enabled: !!incidentId && enabled,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });
}
