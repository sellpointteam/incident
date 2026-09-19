import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SocialSettings {
  telegram_url: string;
  twitter_url: string;
}

const SOCIAL_KEY = "social";
const DEFAULTS: SocialSettings = { telegram_url: "", twitter_url: "" };

export function useSocialSettings() {
  return useQuery({
    queryKey: ["site_settings", SOCIAL_KEY],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<SocialSettings> => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", SOCIAL_KEY)
        .maybeSingle();
      if (error) throw error;
      const v = (data?.value ?? {}) as Partial<SocialSettings>;
      return {
        telegram_url: v.telegram_url ?? "",
        twitter_url: v.twitter_url ?? "",
      };
    },
  });
}

export function useUpdateSocialSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (next: SocialSettings) => {
      const { error } = await supabase
        .from("site_settings")
        .upsert({ key: SOCIAL_KEY, value: next as any }, { onConflict: "key" });
      if (error) throw error;
      return next;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["site_settings", SOCIAL_KEY] }),
  });
}
