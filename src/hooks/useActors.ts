import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ActorCategory = "group" | "faction" | "splinter" | "other";

export interface Actor {
  id: string;
  name: string;
  category: ActorCategory;
  parent_actor_id: string | null;
  aliases: string[];
  active_from: string | null;
  active_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const key = ["actors", "list"] as const;

export function useActors() {
  return useQuery({
    queryKey: key,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("actors" as any)
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Actor[];
    },
  });
}

export function useUpsertActor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rec: Partial<Actor> & { name: string }) => {
      if (rec.id) {
        const { id, created_at, updated_at, ...rest } = rec as any;
        const { error } = await supabase.from("actors" as any).update(rest).eq("id", id);
        if (error) throw error;
        return id as string;
      }
      const { data, error } = await supabase
        .from("actors" as any)
        .insert(rec as any)
        .select("id")
        .single();
      if (error) throw error;
      return (data as any).id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useDeleteActor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("actors" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function buildActorLabel(a: Actor, byId: Map<string, Actor>): string {
  if (!a.parent_actor_id) return a.name;
  const parent = byId.get(a.parent_actor_id);
  return parent ? `${parent.name} › ${a.name}` : a.name;
}
