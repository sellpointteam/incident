import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type IncidentSourceKind =
  | "news_article"
  | "tweet"
  | "telegram"
  | "facebook"
  | "obituary"
  | "official_statement"
  | "video"
  | "blog"
  | "other";

export interface IncidentSource {
  id: string;
  incident_id: string;
  url: string;
  kind: IncidentSourceKind;
  label: string | null;
  notes: string | null;
  is_primary: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const SOURCE_KIND_LABELS: Record<IncidentSourceKind, string> = {
  news_article: "News",
  tweet: "X",
  telegram: "Telegram",
  facebook: "Facebook",
  obituary: "Obituary",
  official_statement: "Official",
  video: "Video",
  blog: "Blog",
  other: "Other",
};

export function getSourceHost(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function getSourceShortName(url: string): string {
  const host = getSourceHost(url).toLowerCase();
  if (host.includes("twitter.com") || host.includes("x.com")) return "x.com";
  if (host.includes("t.me")) return "t.me";
  if (host.includes("facebook.com") || host.includes("fb.me")) return "facebook.com";
  if (host.includes("reuters.com")) return "reuters.com";
  if (host.includes("aljazeera")) return "aljazeera.com";
  if (host.includes("youtube.com") || host.includes("youtu.be")) return "youtube.com";
  return host;
}

export const SOURCE_KIND_OPTIONS = Object.keys(SOURCE_KIND_LABELS) as IncidentSourceKind[];

export function useIncidentSources(incidentId: string | null | undefined) {
  return useQuery({
    queryKey: ["incident_sources", incidentId],
    enabled: !!incidentId,
    staleTime: 30_000,
    queryFn: async (): Promise<IncidentSource[]> => {
      const { data, error } = await supabase
        .from("incident_sources")
        .select("*")
        .eq("incident_id", incidentId!)
        .order("is_primary", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as IncidentSource[];
    },
  });
}

/**
 * Bulk-fetch sources for many incidents in one round trip. Returns a Map
 * keyed by incident_id containing that incident's sorted sources.
 */
export function useIncidentSourcesBulk(incidentIds: string[]) {
  const key = [...incidentIds].sort().join(",");
  return useQuery({
    queryKey: ["incident_sources_bulk", key],
    enabled: incidentIds.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<Map<string, IncidentSource[]>> => {
      const { data, error } = await supabase
        .from("incident_sources")
        .select("*")
        .in("incident_id", incidentIds)
        .order("is_primary", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      const map = new Map<string, IncidentSource[]>();
      for (const row of (data || []) as IncidentSource[]) {
        const arr = map.get(row.incident_id) ?? [];
        arr.push(row);
        map.set(row.incident_id, arr);
      }
      return map;
    },
  });
}


export function useSaveIncidentSources() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      incidentId,
      sources,
    }: {
      incidentId: string;
      sources: Array<Partial<IncidentSource> & { url: string; kind: IncidentSourceKind }>;
    }) => {
      // Replace-all strategy: delete then insert. Simple & safe.
      const { error: delErr } = await supabase
        .from("incident_sources")
        .delete()
        .eq("incident_id", incidentId);
      if (delErr) throw delErr;

      const cleaned = sources
        .map((s, i) => ({
          incident_id: incidentId,
          url: (s.url || "").trim(),
          kind: s.kind,
          label: s.label?.trim() || null,
          notes: s.notes?.trim() || null,
          is_primary: !!s.is_primary,
          sort_order: i,
        }))
        .filter((s) => s.url.length > 0);

      if (cleaned.length === 0) return [];

      const { data, error } = await supabase
        .from("incident_sources")
        .insert(cleaned)
        .select();
      if (error) throw error;
      return data as IncidentSource[];
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["incident_sources", vars.incidentId] });
    },
  });
}
