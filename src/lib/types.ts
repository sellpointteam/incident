import type { Tables, Enums } from "@/integrations/supabase/types";

export type Incident = Tables<"incidents">;
export type DistrictCoordinate = Tables<"district_coordinates">;

export type EventType = Enums<"event_type">;
export type VerificationStatus = Enums<"verification_status">;
export type ConfidenceLevel = Enums<"confidence_level">;
export type SourceType = Enums<"source_type">;

export type IncidentWithCoords = Incident & {
  latitude?: number;
  longitude?: number;
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  armed_clash: "Armed Clash",
  ied_explosion: "IED Explosion",
  suicide_attack: "Suicide Attack",
  drone_strike: "Drone Strike",
  ambush: "Ambush",
  raid: "Armed Clash",
  shelling: "Shelling",
  targeted_killing: "Targeted Killing",
  checkpoint_attack: "Checkpoint Attack",
  sniper_attack: "Sniper Attack",
  intel_based_operation: "Intel Based Operation",
  encounter: "Encounter",
  rocket_attack: "Rocket Attack",
  economic_attack: "Economic Attack",
  grenade_attack: "Grenade Attack",
  other: "Other",
};

export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  armed_clash: "#ef4444",
  ied_explosion: "#f97316",
  suicide_attack: "#8b5cf6",
  drone_strike: "#3b82f6",
  ambush: "#14b8a6",
  raid: "#ec4899",
  shelling: "#d946ef",
  targeted_killing: "#22c55e",
  checkpoint_attack: "#d97706",
  sniper_attack: "#06b6d4",
  intel_based_operation: "#84cc16",
  encounter: "#facc15",
  rocket_attack: "#db2777",
  economic_attack: "#eab308",
  grenade_attack: "#fb7185",
  other: "#6b7280",
};
