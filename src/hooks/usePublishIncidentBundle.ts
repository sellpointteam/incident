/**
 * Atomic + idempotent incident publish.
 *
 * Wraps the `publish_incident_bundle` PostgreSQL RPC. The parent incident and
 * every child (KIA, irregulars, militants) are inserted in a single database
 * transaction. Retrying with the same `client_request_id` returns the original
 * bundle instead of creating duplicates.
 *
 * The RPC verifies auth.uid() has the 'admin' role and uses auth.uid() as
 * created_by — the caller cannot spoof a user id.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invalidateAllCasualtyData } from "@/lib/casualtyInvalidation";
import type { EventType, SourceType, ConfidenceLevel, VerificationStatus } from "@/lib/types";

export interface PublishIncidentPayload {
  date: string;
  country?: string;
  province: string;
  district?: string | null;
  location_name?: string | null;
  event_type: EventType;
  soldiers_killed?: number;
  soldiers_injured?: number;
  irregulars_killed?: number;
  irregulars_injured?: number;
  others_killed?: number;
  others_injured?: number;
  summary: string;
  source_type?: SourceType;
  source_url?: string | null;
  confidence?: ConfidenceLevel;
  verification_status?: VerificationStatus;
  published?: boolean;
  perpetrator_actor_id?: string | null;
  target_actor_id?: string | null;
  economic_damage?: Record<string, number>;
}

export interface PublishKiaPayload {
  name?: string | null;
  rank?: string | null;
  unit?: string | null;
  force_type?: string | null;
  date_of_death?: string | null;
  casualty_country?: string | null;
  casualty_province?: string | null;
  casualty_district?: string | null;
  casualty_tehsil?: string | null;
  hometown_province?: string | null;
  hometown_district?: string | null;
  hometown_tehsil?: string | null;
  media_acknowledged?: boolean;
  source_url?: string | null;
  notes?: string | null;
}

export interface PublishMilitantPayload {
  name?: string | null;
  alias?: string | null;
  affiliation?: string | null;
  rank_role?: string | null;
  date_of_death?: string | null;
  province?: string | null;
  district?: string | null;
  location_name?: string | null;
  hometown_province?: string | null;
  hometown_district?: string | null;
  hometown_tehsil?: string | null;
  source_url?: string | null;
  notes?: string | null;
  confirmed?: boolean;
}

export interface PublishBundleArgs {
  incident: PublishIncidentPayload;
  kia?: PublishKiaPayload[];
  irregulars?: PublishKiaPayload[];
  militants?: PublishMilitantPayload[];
  clientRequestId: string;
}

export interface PublishBundleResult {
  incident_id: string;
  kia_ids: string[];
  militant_ids: string[];
  idempotent_hit: boolean;
}

export async function publishIncidentBundle(args: PublishBundleArgs): Promise<PublishBundleResult> {
  const { data, error } = await supabase.rpc("publish_incident_bundle", {
    _incident: args.incident as any,
    _kia: (args.kia ?? []) as any,
    _irregulars: (args.irregulars ?? []) as any,
    _militants: (args.militants ?? []) as any,
    _client_request_id: args.clientRequestId,
  });
  if (error) throw error;
  return data as unknown as PublishBundleResult;
}

export function usePublishIncidentBundle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: publishIncidentBundle,
    onSuccess: () => invalidateAllCasualtyData(qc),
  });
}
