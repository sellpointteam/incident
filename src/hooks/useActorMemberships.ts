import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ActorMembership {
  id: string;
  actor_id: string;
  admin_area_id: string;
  active_from: string | null;
  active_to: string | null;
  confidence: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const key = ["actor_admin_memberships", "list"] as const;

export function useActorMemberships() {
  return useQuery({
    queryKey: key,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("actor_admin_memberships" as any)
        .select("*");
      if (error) throw error;
      return (data ?? []) as unknown as ActorMembership[];
    },
  });
}

export function useAddActorMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rec: { actor_id: string; admin_area_id: string; notes?: string | null }) => {
      const { data, error } = await supabase
        .from("actor_admin_memberships" as any)
        .insert(rec as any)
        .select("id")
        .single();
      if (error) throw error;
      return (data as any).id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useDeleteActorMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("actor_admin_memberships" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
}
