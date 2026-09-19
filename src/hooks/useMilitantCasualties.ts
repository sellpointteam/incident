import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { qk } from "@/lib/queryKeys";
import { invalidateAllCasualtyData } from "@/lib/casualtyInvalidation";

export interface MilitantCasualty {
  id: string;
  incident_id: string | null;
  name: string | null;
  alias: string | null;
  affiliation: string | null;
  rank_role: string | null;
  date_of_death: string | null;
  province: string | null;
  district: string | null;
  location_name: string | null;
  hometown_province: string | null;
  hometown_district: string | null;
  hometown_tehsil: string | null;
  hometown_latitude: number | null;
  hometown_longitude: number | null;
  source_url: string | null;
  notes: string | null;
  confirmed: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useMilitantCasualties(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: qk.militants.list(),
    enabled: options.enabled ?? true,
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () =>
      fetchAllRows<MilitantCasualty>((from, to) =>
        supabase
          .from("militant_casualties" as any)
          .select("*")
          .order("date_of_death", { ascending: false, nullsFirst: false })
          .order("id", { ascending: true })
          .range(from, to)
      ),
  });
}

export function useUpsertMilitantCasualty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rec: Partial<MilitantCasualty>) => {
      if (rec.id) {
        const { id, created_at, updated_at, created_by, ...rest } = rec as any;
        const { error } = await supabase.from("militant_casualties" as any).update(rest).eq("id", id);
        if (error) throw error;
        return id as string;
      }
      const { data, error } = await supabase.from("militant_casualties" as any).insert(rec as any).select("id").single();
      if (error) throw error;
      return (data as any).id as string;
    },
    onSuccess: () => invalidateAllCasualtyData(qc),
  });
}

export function useDeleteMilitantCasualty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("militant_casualties" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAllCasualtyData(qc),
  });
}

export const MILITANT_AFFILIATIONS = [
  "TTP",
  "BLA",
  "BLF",
  "BRG",
  "UBA",
  "BRA",
  "BRAS",
  "IMP",
  "ISKP",
  "Hafiz Gul Bahadur Group",
  "Lashkar-e-Islam",
  "Jamaat ul Ahrar",
  "Other",
] as const;

export const BALOCH_SEPARATIST_AFFILIATIONS = ["BLA", "BLF", "BRG", "UBA", "BRAS", "BRA"] as const;
export const ISLAMIST_AFFILIATIONS = [
  "TTP",
  "ISKP",
  "IMP",
  "Hafiz Gul Bahadur Group",
  "Lashkar-e-Islam",
  "Jamaat ul Ahrar",
] as const;

export type MilitantGroupCategory = "baloch" | "islamist" | "other";

export function categorizeAffiliation(affiliation: string | null | undefined): MilitantGroupCategory {
  const a = (affiliation || "").trim();
  if ((BALOCH_SEPARATIST_AFFILIATIONS as readonly string[]).includes(a)) return "baloch";
  if ((ISLAMIST_AFFILIATIONS as readonly string[]).includes(a)) return "islamist";
  return "other";
}

export function getMilitantAffiliationColor(affiliation: string | null | undefined): string {
  const a = (affiliation || "").trim();
  if (a === "TTP") return "border-white text-white";
  if (a === "ISKP") return "border-cyan-500 text-cyan-500";
  if (a === "BLA") return "border-red-500 text-red-500";
  if (a === "BLF") return "border-amber-500 text-amber-500";
  if (a === "BRG") return "border-blue-500 text-blue-500";
  if (a === "UBA") return "border-green-500 text-green-500";
  if (a === "BRA") return "border-sky-400 text-sky-400";
  if (a === "BRAS") return "border-sky-500 text-sky-500";
  if (a === "IMP") return "border-purple-500 text-purple-500";
  if (a === "Hafiz Gul Bahadur Group") return "border-lime-500 text-lime-500";
  if (a === "Lashkar-e-Islam") return "border-pink-500 text-pink-500";
  if (a === "Jamaat ul Ahrar") return "border-orange-500 text-orange-500";
  return "border-gray-500 text-gray-500";
}
