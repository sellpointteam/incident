/**
 * Memoized L.divIcon registry.
 *
 * Re-creating divIcons for every marker on every render is one of the
 * biggest perf hits in the old IncidentMap. We key icons by their visual
 * inputs (event_type, size bucket, recent flag) and reuse instances.
 */
import L from "leaflet";
import { EVENT_TYPE_COLORS } from "@/lib/types";
import { EVENT_TYPE_SVG } from "@/lib/eventIcons";

const incidentIcons = new Map<string, L.DivIcon>();
const clusterIcons = new Map<string, L.DivIcon>();

/** Bucket size to ~5px steps so we get cache hits across similar markers. */
function bucketSize(rawSize: number): number {
  return Math.round(rawSize / 4) * 4;
}

export function getIncidentIcon(opts: {
  eventType: string;
  casualties: number;
  isRecent: boolean;
}): L.DivIcon {
  const rawSize = Math.max(28, Math.min(56, 28 + opts.casualties * 3));
  const size = bucketSize(rawSize);
  const key = `${opts.eventType}|${size}|${opts.isRecent ? 1 : 0}`;
  const existing = incidentIcons.get(key);
  if (existing) return existing;

  const color = EVENT_TYPE_COLORS[opts.eventType] || "#f59e0b";
  const svg = EVENT_TYPE_SVG[opts.eventType] || EVENT_TYPE_SVG.other;
  const html = `
    <div class="tactical-marker-inner" style="color:${color};background:${color};">
      ${svg}
      ${opts.isRecent ? `<span class="marker-pulse" style="color:${color};"></span>` : ""}
    </div>
  `;

  const icon = L.divIcon({
    className: "tactical-marker",
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
  incidentIcons.set(key, icon);
  return icon;
}

export function getClusterIcon(count: number): L.DivIcon {
  // Bucket by order-of-magnitude so we don't make a unique icon per cluster
  const bucket =
    count < 10 ? "s" : count < 50 ? "m" : count < 200 ? "l" : "xl";
  const key = `${bucket}|${count}`;
  const existing = clusterIcons.get(key);
  if (existing) return existing;

  const size = bucket === "s" ? 36 : bucket === "m" ? 44 : bucket === "l" ? 52 : 60;
  const html = `
    <div class="tactical-cluster" data-bucket="${bucket}">
      <span class="tactical-cluster-count">${count}</span>
    </div>
  `;
  const icon = L.divIcon({
    className: "tactical-cluster-wrap",
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
  clusterIcons.set(key, icon);
  return icon;
}
