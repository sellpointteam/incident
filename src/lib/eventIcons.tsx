import { Bomb, Zap, Shield, Target, Flame, Skull, AlertOctagon, HelpCircle, Crosshair, Eye, type LucideProps } from "lucide-react";
import type { EventType } from "@/lib/types";

/* ---------------- Crossed AK-47s (custom raster image) ---------------- */
const ARMED_CLASH_IMG = "/icons/armed-clash.png";
const Rifle = (props: LucideProps) => {
  const size = (props.size as number) ?? 24;
  return (
    <img
      src={ARMED_CLASH_IMG}
      alt="Armed clash"
      width={size}
      height={size}
      style={{ display: "inline-block", objectFit: "contain" }}
      className={props.className}
    />
  );
};

/* ---------------- Quadcopter (drone strike, custom raster image) ---------------- */
const DRONE_IMG = "/icons/drone-strike.png";
const DroneIcon = (props: LucideProps) => {
  const size = (props.size as number) ?? 24;
  return (
    <img
      src={DRONE_IMG}
      alt="Drone strike"
      width={size}
      height={size}
      style={{ display: "inline-block", objectFit: "contain" }}
      className={props.className}
    />
  );
};

/* ---------------- Rocket (rocket attack, custom inline SVG) ---------------- */
const RocketIcon = (props: LucideProps) => {
  const size = (props.size as number) ?? 24;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      className={props.className}
    >
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.93A41.85 41.85 0 0 1 16 4.89l.77-.77A6.02 6.02 0 0 1 19.5 3c1 0 2 .5 2.5 1.5a209.7 209.7 0 0 1-2.86 3.78l-2.85 3.4a41.85 41.85 0 0 1-3.52 4.05l-3 3z" />
      <path d="M9 12l-3 3" />
      <path d="m15 6 3-3" />
    </svg>
  );
};

/* ---------------- Economic attack (banknote / dollar) ---------------- */
const EconomicIcon = (props: LucideProps) => {
  const size = (props.size as number) ?? 24;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width={size} height={size} className={props.className}>
      <rect width="20" height="12" x="2" y="6" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 12h.01M18 12h.01" />
    </svg>
  );
};

/* ---------------- Grenade attack (custom inline SVG) ---------------- */
const GrenadeIcon = (props: LucideProps) => {
  const size = (props.size as number) ?? 24;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width={size} height={size} className={props.className}>
      <circle cx="12" cy="14" r="7" />
      <path d="M12 7V4" />
      <path d="M9 4h6" />
      <path d="M15 5l3-2" />
    </svg>
  );
};

export const EVENT_TYPE_ICONS: Record<EventType, React.ComponentType<LucideProps>> = {
  armed_clash: Rifle,
  ied_explosion: Bomb,
  suicide_attack: Flame,
  drone_strike: DroneIcon,
  ambush: Zap,
  raid: Target,
  shelling: AlertOctagon,
  targeted_killing: Skull,
  checkpoint_attack: Shield,
  sniper_attack: Crosshair,
  intel_based_operation: Eye,
  encounter: Crosshair,
  rocket_attack: RocketIcon,
  economic_attack: EconomicIcon,
  grenade_attack: GrenadeIcon,
  other: HelpCircle,
};

/** Inline SVG strings for use in Leaflet divIcons (no React). */
export const EVENT_TYPE_SVG: Record<EventType, string> = {
  armed_clash: `<img src="${ARMED_CLASH_IMG}" alt="Armed clash" style="width:100%;height:100%;object-fit:contain;display:block;" />`,
  ied_explosion: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="13" r="9"/><path d="M14.35 4.65 16.3 2.7a2.41 2.41 0 0 1 3.4 0l1.6 1.6a2.4 2.4 0 0 1 0 3.4l-1.95 1.95"/><path d="m22 2-1.5 1.5"/></svg>`,
  suicide_attack: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,
  drone_strike: `<img src="${DRONE_IMG}" alt="Drone strike" class="marker-img-drone" style="width:100%;height:100%;object-fit:contain;display:block;" />`,
  ambush: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  raid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  shelling: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>`,
  targeted_killing: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><path d="M8 20v2h8v-2"/><path d="m12.5 17-.5-1-.5 1h1z"/><path d="M16 20a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20"/></svg>`,
  checkpoint_attack: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>`,
  sniper_attack: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="22" x2="18" y1="12" y2="12"/><line x1="6" x2="2" y1="12" y2="12"/><line x1="12" x2="12" y1="6" y2="2"/><line x1="12" x2="12" y1="22" y2="18"/><circle cx="12" cy="12" r="2"/></svg>`,
  intel_based_operation: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
  encounter: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="22" x2="18" y1="12" y2="12"/><line x1="6" x2="2" y1="12" y2="12"/><line x1="12" x2="12" y1="6" y2="2"/><line x1="12" x2="12" y1="22" y2="18"/><circle cx="12" cy="12" r="2"/></svg>`,
  rocket_attack: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.93A41.85 41.85 0 0 1 16 4.89l.77-.77A6.02 6.02 0 0 1 19.5 3c1 0 2 .5 2.5 1.5a209.7 209.7 0 0 1-2.86 3.78l-2.85 3.4a41.85 41.85 0 0 1-3.52 4.05l-3 3z"/><path d="M9 12l-3 3"/><path d="m15 6 3-3"/></svg>`,
  economic_attack: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/></svg>`,
  grenade_attack: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="14" r="7"/><path d="M12 7V4"/><path d="M9 4h6"/><path d="M15 5l3-2"/></svg>`,
  other: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>`,
};
