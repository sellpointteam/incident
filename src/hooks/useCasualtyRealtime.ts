/**
 * Global realtime subscriber. Mount once (in App) — it listens to changes
 * on incidents, kia_soldiers, and militant_casualties and invalidates all
 * casualty-dependent React Query caches so multiple tabs / admin sessions
 * stay in sync.
 *
 * Debounced so a bulk publish doesn't fire one refetch per row.
 */
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invalidateAllCasualtyData } from "@/lib/casualtyInvalidation";

export function useCasualtyRealtime() {
  const qc = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const schedule = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      // Longer debounce so bursts of edits (bulk publish, active admin session)
      // collapse into a single invalidation instead of thrashing every query.
      timerRef.current = setTimeout(() => invalidateAllCasualtyData(qc), 2000);
    };

    const channel = supabase
      .channel("casualty-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "kia_soldiers" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "militant_casualties" }, schedule)
      .subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
