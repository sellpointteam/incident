import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Incident } from "@/lib/types";
import { qk } from "@/lib/queryKeys";
import { INCIDENT_DETAIL_COLUMNS } from "@/lib/selectors";
import { normalizeProvince, normalizeDistrict, normalizeTehsil } from "@/lib/normalize";
import { invalidateAllCasualtyData } from "@/lib/casualtyInvalidation";

const LOCATION_KEYS = ["province", "district", "location_name", "country"] as const;

function normalizeIncidentPayload<T extends Record<string, any>>(updates: T): T {
  const out: any = { ...updates };
  if ("province" in out && out.province != null) {
    const np = normalizeProvince(out.province);
    if (np && np !== "Unknown") out.province = np;
  }
  if ("district" in out && out.district != null) {
    out.district = normalizeDistrict(out.district);
  }
  if ("location_name" in out && out.location_name != null) {
    out.location_name = normalizeTehsil(out.location_name, out.district ?? null) ?? out.location_name;
  }
  if ("country" in out && typeof out.country === "string") {
    out.country = out.country.trim() || "Pakistan";
  }
  return out;
}

export function useAllIncidents() {
  return useQuery({
    queryKey: qk.incidents.admin(),
    // Admin views need to be fresh — casualty edits from another tab or
    // the RPC must appear on remount.
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<Incident[]> => {
      const { data, error } = await supabase
        .from("incidents")
        .select(INCIDENT_DETAIL_COLUMNS)
        .order("date", { ascending: false });
      if (error) throw error;
      return data as Incident[];
    },
  });
}

export function useUpdateIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, auditData, ...rawUpdates }: Partial<Incident> & { id: string; auditData?: any }) => {
      const updates = normalizeIncidentPayload(rawUpdates);

      const touchedLocation = LOCATION_KEYS.some((k) => k in rawUpdates);
      if (touchedLocation) {
        // eslint-disable-next-line no-console
        console.debug("[useUpdateIncident] normalized location payload", { id, before: rawUpdates, after: updates });
      }

      if (auditData) {
        const { error: auditErr } = await supabase.from("audit_logs").insert({
          table_name: "incidents",
          record_id: id,
          action: "update",
          old_data: auditData.old,
          new_data: { ...auditData.new, ...updates },
          performed_by: auditData.userId,
        });
        if (auditErr) console.warn("[useUpdateIncident] audit insert failed", auditErr);
      }
      const { data, error } = await supabase
        .from("incidents")
        .update(updates)
        .eq("id", id)
        .select(INCIDENT_DETAIL_COLUMNS)
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateAllCasualtyData(qc),
  });
}

/**
 * Delete an incident. Thanks to ON DELETE CASCADE, this single call also
 * removes all linked kia_soldiers and militant_casualties rows in one atomic
 * DB action. No manual child-row cleanup required.
 */
export function useDeleteIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, auditData }: { id: string; auditData?: any }) => {
      if (auditData) {
        const { error: auditErr } = await supabase.from("audit_logs").insert({
          table_name: "incidents",
          record_id: id,
          action: "delete",
          old_data: auditData.old,
          performed_by: auditData.userId,
        });
        if (auditErr) console.warn("[useDeleteIncident] audit insert failed", auditErr);
      }
      const { error } = await supabase.from("incidents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAllCasualtyData(qc),
  });
}
