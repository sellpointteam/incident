import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OperationalArea {
  id: string;
  actor_id: string;
  name: string;
  active_from: string | null;
  active_to: string | null;
  confidence: string;
  notes: string | null;
  geom_geojson: any | null;
  centroid_lng: number | null;
  centroid_lat: number | null;
}

const key = ["operational_areas", "list"] as const;

export function useOperationalAreas() {
  return useQuery({
    queryKey: key,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<OperationalArea[]> => {
      const { data, error } = await supabase.rpc("list_operational_areas" as any);
      if (error) throw error;
      return (data ?? []) as OperationalArea[];
    },
  });
}

export function useUpsertOperationalArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rec: {
      id?: string;
      actor_id: string;
      name: string;
      active_from?: string | null;
      active_to?: string | null;
      confidence?: string;
      notes?: string | null;
    }) => {
      if (rec.id) {
        const { id, ...rest } = rec;
        const { error } = await supabase.from("operational_areas" as any).update(rest).eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase
        .from("operational_areas" as any)
        .insert(rec as any)
        .select("id")
        .single();
      if (error) throw error;
      return (data as any).id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useDeleteOperationalArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("operational_areas" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useSetOperationalAreaGeometry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { area_id: string; geojson: any }) => {
      const { data, error } = await supabase.rpc("set_operational_area_geometry" as any, {
        _area_id: args.area_id,
        _geojson: args.geojson,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export async function suggestPerpetratorForLocation(args: {
  lng?: number | null;
  lat?: number | null;
  province?: string | null;
  district?: string | null;
  tehsil?: string | null;
}) {
  const { data, error } = await supabase.rpc("suggest_perpetrator_for_point" as any, {
    _lng: args.lng ?? null,
    _lat: args.lat ?? null,
    _province: args.province ?? null,
    _district: args.district ?? null,
    _tehsil: args.tehsil ?? null,
  });
  if (error) throw error;
  const rows = (data ?? []) as Array<{
    actor_id: string;
    actor_name: string;
    source: string;
    confidence: string;
  }>;
  return rows[0] ?? null;
}
