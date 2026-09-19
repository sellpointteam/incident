/**
 * Hooks for the versioned administrative-geography system (Phase A).
 *
 * These read/write the `admin_boundary_versions`, `admin_areas`,
 * `admin_area_aliases` and `admin_area_transitions` tables added in the
 * PostGIS migration. Nothing here touches incidents or the existing
 * LocationPicker — that migration comes later.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type BoundaryVersion = Tables<"admin_boundary_versions">;
export type AdminArea = Tables<"admin_areas">;
export type AdminAreaAlias = Tables<"admin_area_aliases">;
export type AdminAreaTransition = Tables<"admin_area_transitions">;

export const AREA_TYPES = ["division", "district", "subdivision", "tehsil", "sub_tehsil"] as const;
export type AreaType = (typeof AREA_TYPES)[number];

export const geoQk = {
  versions: ["admin", "boundary_versions"] as const,
  areas: (versionId: string | null) => ["admin", "areas", versionId ?? "none"] as const,
  aliases: (areaId: string) => ["admin", "aliases", areaId] as const,
  transitionsTo: (areaId: string) => ["admin", "transitions", "to", areaId] as const,
  transitionsFrom: (areaId: string) => ["admin", "transitions", "from", areaId] as const,
};

/* --------------------------- Boundary versions --------------------------- */

export function useBoundaryVersions() {
  return useQuery({
    queryKey: geoQk.versions,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_boundary_versions")
        .select("*")
        .order("effective_from", { ascending: false });
      if (error) throw error;
      return data as BoundaryVersion[];
    },
  });
}

export function useUpsertBoundaryVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: TablesInsert<"admin_boundary_versions"> & { id?: string }) => {
      const { data, error } = await supabase
        .from("admin_boundary_versions")
        .upsert(v)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: geoQk.versions }),
  });
}

export function useSetCurrentVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, province, country }: { id: string; province: string | null; country: string }) => {
      // Only one current version per (country, province) — clear siblings first.
      const clear = await supabase
        .from("admin_boundary_versions")
        .update({ is_current: false })
        .eq("country", country)
        .eq("province", province as any)
        .neq("id", id);
      if (clear.error) throw clear.error;
      const set = await supabase.from("admin_boundary_versions").update({ is_current: true }).eq("id", id);
      if (set.error) throw set.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: geoQk.versions }),
  });
}

/* -------------------------------- Areas --------------------------------- */

export function useAdminAreas(versionId: string | null) {
  return useQuery({
    queryKey: geoQk.areas(versionId),
    enabled: !!versionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_areas")
        .select("*")
        .eq("boundary_version_id", versionId!)
        .order("area_type")
        .order("name");
      if (error) throw error;
      return data as AdminArea[];
    },
  });
}

export function useUpsertAdminArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: (TablesInsert<"admin_areas"> | TablesUpdate<"admin_areas">) & { id?: string }) => {
      const { data, error } = await supabase.from("admin_areas").upsert(a as any).select().single();
      if (error) throw error;
      return data as AdminArea;
    },
    onSuccess: (row) =>
      qc.invalidateQueries({ queryKey: geoQk.areas(row.boundary_version_id) }),
  });
}

export function useDeleteAdminArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; versionId: string }) => {
      const { error } = await supabase.from("admin_areas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: geoQk.areas(vars.versionId) }),
  });
}

/* ------------------------------- Aliases -------------------------------- */

export function useAdminAreaAliases(areaId: string | null) {
  return useQuery({
    queryKey: areaId ? geoQk.aliases(areaId) : ["admin", "aliases", "none"],
    enabled: !!areaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_area_aliases")
        .select("*")
        .eq("admin_area_id", areaId!)
        .order("alias");
      if (error) throw error;
      return data as AdminAreaAlias[];
    },
  });
}

export function useAddAlias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: TablesInsert<"admin_area_aliases">) => {
      const { data, error } = await supabase.from("admin_area_aliases").insert(row).select().single();
      if (error) throw error;
      return data as AdminAreaAlias;
    },
    onSuccess: (row) => qc.invalidateQueries({ queryKey: geoQk.aliases(row.admin_area_id) }),
  });
}

export function useDeleteAlias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; areaId: string }) => {
      const { error } = await supabase.from("admin_area_aliases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: geoQk.aliases(vars.areaId) }),
  });
}
