import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";

export interface PublicStatsFilters {
  dateFrom?: string | null;
  dateTo?: string | null;
  province?: string | null;
  district?: string | null;
  eventType?: string | null;
  search?: string | null;
}

export interface PublicStats {
  totals: {
    incidents: number;
    sf_kia: number;
    irregular_kia: number;
    militant_kia: number;
  };
  series: {
    incidents: number[];
    sf_kia: number[];
    irregular_kia: number[];
    militant_kia: number[];
  };
}

const norm = (v?: string | null) => (v && v !== "all" ? v : null);

export function usePublicStats(filters: PublicStatsFilters = {}) {
  const args = {
    date_from: norm(filters.dateFrom),
    date_to: norm(filters.dateTo),
    province: norm(filters.province),
    district: norm(filters.district),
    event_type: norm(filters.eventType),
    search: norm(filters.search),
  };
  return useQuery({
    queryKey: [...qk.stats.all, args] as const,
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<PublicStats> => {
      const { data, error } = await supabase.rpc("get_public_stats" as any, args as any);
      if (error) throw error;
      return data as PublicStats;
    },
  });
}
