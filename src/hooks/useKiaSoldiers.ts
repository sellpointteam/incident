import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { KIA_DETAIL_COLUMNS } from "@/lib/selectors";
import { normalizeProvince, normalizeDistrict, normalizeTehsil } from "@/lib/normalize";
import { invalidateAllCasualtyData } from "@/lib/casualtyInvalidation";
import { fetchAllRows } from "@/lib/fetchAllRows";

export type KiaSoldier = {
  id: string;
  incident_id: string | null;
  name: string;
  rank: string | null;
  unit: string | null;
  hometown_district: string | null;
  hometown_province: string | null;
  hometown_tehsil: string | null;
  hometown_latitude: number | null;
  hometown_longitude: number | null;
  casualty_district: string | null;
  casualty_province: string;
  casualty_country: string;
  casualty_tehsil: string | null;
  date_of_death: string;
  media_acknowledged: boolean;
  notes: string | null;
  source_url: string | null;
  force_type: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function normalizeKiaPayload<T extends Record<string, any>>(input: T): T {
  const out: any = { ...input };
  if ("hometown_province" in out && out.hometown_province != null) {
    const np = normalizeProvince(out.hometown_province);
    out.hometown_province = np === "Unknown" ? null : np;
  }
  if ("hometown_district" in out && out.hometown_district != null) {
    out.hometown_district = normalizeDistrict(out.hometown_district);
  }
  if ("hometown_tehsil" in out && out.hometown_tehsil != null) {
    out.hometown_tehsil = normalizeTehsil(out.hometown_tehsil, out.hometown_district ?? null);
  }
  if ("casualty_province" in out && out.casualty_province != null) {
    const np = normalizeProvince(out.casualty_province);
    if (np && np !== "Unknown") out.casualty_province = np;
  }
  if ("casualty_district" in out && out.casualty_district != null) {
    out.casualty_district = normalizeDistrict(out.casualty_district);
  }
  if ("casualty_tehsil" in out && out.casualty_tehsil != null) {
    out.casualty_tehsil = normalizeTehsil(out.casualty_tehsil, out.casualty_district ?? null);
  }
  return out;
}

export function useKiaSoldiers(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: qk.kia.list(),
    enabled: options.enabled ?? true,
    // Casualty data must be fresh when an admin lands on a page; do not
    // suppress refetchOnMount here. 60s stale keeps browsing snappy.
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<KiaSoldier[]> =>
      // Paged: PostgREST caps a plain select at 1000 rows, which was silently
      // dropping the newest records from the registry/map.
      fetchAllRows<KiaSoldier>((from, to) =>
        supabase
          .from("kia_soldiers")
          .select(KIA_DETAIL_COLUMNS)
          .order("date_of_death", { ascending: false })
          .order("id", { ascending: true })
          .range(from, to)
      ),
  });
}

export function useCreateKiaSoldier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (soldier: Omit<KiaSoldier, "id" | "created_at" | "updated_at">) => {
      const payload = normalizeKiaPayload(soldier);
      const { data, error } = await supabase.from("kia_soldiers").insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateAllCasualtyData(qc),
  });
}

export function useUpdateKiaSoldier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<KiaSoldier> & { id: string }) => {
      const payload = normalizeKiaPayload(updates);
      const { data, error } = await supabase.from("kia_soldiers").update(payload).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateAllCasualtyData(qc),
  });
}

export function useDeleteKiaSoldier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("kia_soldiers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAllCasualtyData(qc),
  });
}
