/**
 * Canvas "activity footprint" layer.
 *
 * Renders one smooth, translucent presence cloud per actor onto a single
 * canvas living in a dedicated Leaflet pane below the marker pane. The layer
 * never intercepts pointer events, so incident markers stay clickable.
 *
 * Design notes:
 * - Presence-based, not count-based: repeated incidents at the same
 *   administrative centroid are deduplicated and blobs are composited with
 *   `lighten`, so a single attack in Lahore or Karachi reads just as clearly
 *   as a dense belt in KP.
 * - The kernel radius is derived from a geographic smoothing distance (km) so
 *   incidents sharing an administrative centroid spread into a regional
 *   footprint rather than a tiny dot.
 * - Actor name labels are drawn over each of the actor's main clusters so
 *   overlapping footprints stay readable.
 */
import L from "leaflet";
import type { Rgb } from "./actorColors";

export const ACTIVITY_PANE = "militantActivityPane";

export interface ActivityPoint {
  lat: number;
  lng: number;
}

export interface ActivityLayerGroupData {
  actorId: string;
  name: string;
  color: Rgb;
  points: ActivityPoint[];
}

/** Geographic smoothing radius of the density kernel, in kilometres. */
const SMOOTHING_KM = 55;
const MIN_RADIUS_PX = 30;
const MAX_RADIUS_PX = 220;
/** Per-location intensity — presence based, so every location reads clearly. */
const POINT_INTENSITY = 0.95;
/** Global opacity of the composited overlay (keeps basemap labels readable). */
const LAYER_OPACITY = 0.78;
/** Location dedupe grid, in degrees (~5 km). */
const DEDUPE_DEG = 0.05;
/** Screen-space cluster cell for label placement, in px. */
const LABEL_CELL_PX = 140;
/** Max labels drawn per actor. */
const MAX_LABELS_PER_ACTOR = 4;

function metersToPixels(map: L.Map, meters: number, lat: number): number {
  const zoom = map.getZoom();
  const a = map.project([lat, 0], zoom);
  const b = map.project([lat, meters / (111320 * Math.cos((lat * Math.PI) / 180))], zoom);
  return Math.abs(b.x - a.x);
}

function dedupePoints(points: ActivityPoint[]): ActivityPoint[] {
  const seen = new Set<string>();
  const out: ActivityPoint[] = [];
  for (const p of points) {
    const key = `${Math.round(p.lat / DEDUPE_DEG)}|${Math.round(p.lng / DEDUPE_DEG)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

export const ActivityCanvasLayer = L.Layer.extend({
  initialize(this: any, groups: ActivityLayerGroupData[]) {
    this._groups = groups;
  },

  setGroups(this: any, groups: ActivityLayerGroupData[]) {
    this._groups = groups;
    this._redraw();
  },

  onAdd(this: any, map: L.Map) {
    this._map = map;
    if (!map.getPane(ACTIVITY_PANE)) {
      const pane = map.createPane(ACTIVITY_PANE);
      pane.style.zIndex = "350"; // tilePane 200 < here < markerPane 600
      pane.style.pointerEvents = "none";
    }
    const canvas = L.DomUtil.create("canvas", "leaflet-activity-layer") as HTMLCanvasElement;
    canvas.style.pointerEvents = "none";
    canvas.style.transition = "opacity 200ms ease";
    this._canvas = canvas;
    map.getPane(ACTIVITY_PANE)!.appendChild(canvas);

    this._onMove = () => this._reset();
    map.on("moveend zoomend resize", this._onMove);
    this._reset();
    return this;
  },

  onRemove(this: any, map: L.Map) {
    if (this._onMove) map.off("moveend zoomend resize", this._onMove);
    if (this._canvas?.parentNode) this._canvas.parentNode.removeChild(this._canvas);
    this._canvas = null;
    this._map = null;
    return this;
  },

  _reset(this: any) {
    const map: L.Map = this._map;
    const canvas: HTMLCanvasElement = this._canvas;
    if (!map || !canvas) return;
    const size = map.getSize();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size.x * dpr);
    canvas.height = Math.round(size.y * dpr);
    canvas.style.width = `${size.x}px`;
    canvas.style.height = `${size.y}px`;
    const topLeft = map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(canvas, topLeft);
    this._dpr = dpr;
    this._redraw();
  },

  _redraw(this: any) {
    const map: L.Map = this._map;
    const canvas: HTMLCanvasElement = this._canvas;
    if (!map || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr: number = this._dpr || 1;
    const size = map.getSize();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const groups: ActivityLayerGroupData[] = this._groups || [];
    if (groups.length === 0) return;

    const bounds = map.getBounds().pad(0.75);
    const centerLat = map.getCenter().lat;
    const radius = Math.max(
      MIN_RADIUS_PX,
      Math.min(MAX_RADIUS_PX, metersToPixels(map, SMOOTHING_KM * 1000, centerLat)),
    );

    // Offscreen buffer reused across groups.
    const buf = document.createElement("canvas");
    buf.width = canvas.width;
    buf.height = canvas.height;
    const bctx = buf.getContext("2d");
    if (!bctx) return;

    const labels: { x: number; y: number; text: string; color: Rgb }[] = [];

    // Draw largest footprints first so smaller ones stay visible on top.
    const ordered = [...groups].sort((a, b) => b.points.length - a.points.length);
    for (const group of ordered) {
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bctx.clearRect(0, 0, size.x, size.y);
      bctx.globalCompositeOperation = "source-over";

      const points = dedupePoints(group.points);
      const cells = new Map<string, { x: number; y: number; n: number }>();
      let drew = false;

      for (const p of points) {
        if (!bounds.contains([p.lat, p.lng])) continue;
        const pt = map.latLngToContainerPoint([p.lat, p.lng]);
        const grad = bctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, radius);
        grad.addColorStop(0, `rgba(255,255,255,${POINT_INTENSITY})`);
        grad.addColorStop(0.5, `rgba(255,255,255,${POINT_INTENSITY * 0.55})`);
        grad.addColorStop(1, "rgba(255,255,255,0)");
        bctx.fillStyle = grad;
        // `lighten` keeps overlapping presence areas uniform instead of
        // building count-driven hotspots.
        bctx.globalCompositeOperation = "lighten";
        bctx.beginPath();
        bctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        bctx.fill();
        drew = true;

        const key = `${Math.round(pt.x / LABEL_CELL_PX)}|${Math.round(pt.y / LABEL_CELL_PX)}`;
        const cell = cells.get(key);
        if (cell) {
          cell.x += pt.x;
          cell.y += pt.y;
          cell.n += 1;
        } else {
          cells.set(key, { x: pt.x, y: pt.y, n: 1 });
        }
      }
      if (!drew) continue;

      // Colorize the accumulated intensity mask.
      bctx.globalCompositeOperation = "source-in";
      bctx.fillStyle = `rgb(${group.color.r}, ${group.color.g}, ${group.color.b})`;
      bctx.fillRect(0, 0, size.x, size.y);
      bctx.globalCompositeOperation = "source-over";

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = LAYER_OPACITY;
      // Plain painting: overlapping footprints keep their own hue (topmost
      // group wins) instead of blending into an unrelated mixed color.
      ctx.globalCompositeOperation = "source-over";
      ctx.filter = `blur(${Math.round(radius * 0.16 * dpr)}px)`;
      ctx.drawImage(buf, 0, 0);
      ctx.filter = "none";
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      Array.from(cells.values())
        .sort((a, b) => b.n - a.n)
        .slice(0, MAX_LABELS_PER_ACTOR)
        .forEach((c) => labels.push({ x: c.x / c.n, y: c.y / c.n, text: group.name, color: group.color }));
    }

    // Labels on top of every footprint, with simple screen-space de-overlap.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = "600 11px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(8, 12, 20, 0.9)";

    const placed: { x: number; y: number }[] = [];
    for (const label of labels) {
      let y = label.y;
      let guard = 0;
      while (placed.some((p) => Math.abs(p.x - label.x) < 60 && Math.abs(p.y - y) < 14) && guard < 6) {
        y += 15;
        guard += 1;
      }
      placed.push({ x: label.x, y });
      const text = label.text.toUpperCase();
      ctx.strokeText(text, label.x, y);
      ctx.fillStyle = `rgb(${Math.min(255, label.color.r + 60)}, ${Math.min(255, label.color.g + 60)}, ${Math.min(255, label.color.b + 60)})`;
      ctx.fillText(text, label.x, y);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  },
}) as unknown as new (groups: ActivityLayerGroupData[]) => L.Layer & {
  setGroups: (groups: ActivityLayerGroupData[]) => void;
};

export function createActivityLayer(groups: ActivityLayerGroupData[]) {
  return new ActivityCanvasLayer(groups);
}
