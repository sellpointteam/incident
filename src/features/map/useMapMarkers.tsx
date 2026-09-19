/**
 * Diff-based, supercluster-driven marker manager for incident maps.
 *
 * Why this exists:
 * - The previous implementation called `clearLayers()` and re-built every
 *   marker on each render. That meant O(N) DOM churn even when the data
 *   was unchanged, and turned 2000+ incidents into a slideshow.
 * - We now ask supercluster for the *visible* set on every move, then
 *   diff that set against the markers already on the map and only
 *   add/remove the delta. Existing markers are mutated in place.
 *
 * Public surface:
 *   const ctl = useMapMarkers(map, incidents, { onMarkerClick });
 *   ctl.openIncidentPopup(id, { fly: true });
 *
 * Phase 2 of the scaling refactor — see .lovable/plan.md.
 */
import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import { createRoot, type Root } from "react-dom/client";
import { useQueryClient } from "@tanstack/react-query";
import type Supercluster from "supercluster";
import { differenceInDays } from "date-fns";
import type { IncidentWithCoords } from "@/lib/types";
import { parseIncidentDate } from "@/lib/date";
import { getIncidentIcon, getClusterIcon } from "./iconRegistry";
import { buildIndex, getVisibleClusters, type ClusterOrPoint } from "./clustering";
import { IncidentPopupRoot } from "./IncidentPopup";

interface MarkerCtl {
  /** Find the leaflet marker for an incident if it is currently rendered. */
  getMarker: (incidentId: string) => L.Marker | undefined;
  /** Force-render the marker for an incident regardless of clustering. */
  ensureIncidentVisible: (incidentId: string) => L.Marker | undefined;
}

interface Options {
  onMarkerClick?: (id: string) => void;
}

type RenderedKind = "point" | "cluster";

interface RenderedEntry {
  kind: RenderedKind;
  /** stable key used for diffing */
  key: string;
  marker: L.Marker;
}

/**
 * Stable key for a rendered feature. For points we use the incident id so
 * the same physical marker survives across renders. For clusters we use
 * the cluster id + zoom so we don't flicker the same blob during a pan.
 */
function entryKey(feature: ClusterOrPoint, zoom: number): string {
  if ((feature.properties as any).cluster) {
    return `c:${(feature.properties as any).cluster_id}:${zoom}`;
  }
  return `p:${(feature.properties as any).incidentId}`;
}

export function useMapMarkers(
  map: L.Map | null,
  incidents: IncidentWithCoords[],
  opts: Options = {},
): MarkerCtl {
  const queryClient = useQueryClient();
  const indexRef = useRef<Supercluster<any> | null>(null);
  const incidentByIdRef = useRef<Map<string, IncidentWithCoords>>(new Map());
  const renderedRef = useRef<Map<string, RenderedEntry>>(new Map());
  const popupRootsRef = useRef<Map<string, Root>>(new Map());
  const layerRef = useRef<L.LayerGroup | null>(null);
  const onClickRef = useRef(opts.onMarkerClick);

  onClickRef.current = opts.onMarkerClick;

  // Keep id→incident map in sync for popup builders.
  useEffect(() => {
    const m = new Map<string, IncidentWithCoords>();
    for (const inc of incidents) m.set(inc.id, inc);
    incidentByIdRef.current = m;
  }, [incidents]);

  // Build (or rebuild) the supercluster index when incidents change.
  useEffect(() => {
    const today = new Date();
    indexRef.current = buildIndex(
      incidents,
      (inc) => differenceInDays(today, parseIncidentDate(inc.date)) <= 14,
    );
    if (map && !layerRef.current) {
      layerRef.current = L.layerGroup().addTo(map);
    }
    if (map && indexRef.current && layerRef.current && (map as any)._loaded) {
      try { renderVisible(map, indexRef.current, layerRef.current); } catch { /* map not ready */ }
    }
  }, [incidents, map]);

  // Bind/unbind layer group + move listener. We schedule reconciliation
  // through requestAnimationFrame so a burst of moveend/zoomend events
  // (which Leaflet fires several per gesture) collapse into a single
  // render pass — measurable FPS win when panning quickly.
  useEffect(() => {
    if (!map) return;
    if (!layerRef.current) layerRef.current = L.layerGroup().addTo(map);

    let rafId = 0;
    const schedule = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        if (indexRef.current && layerRef.current && (map as any)._loaded) {
          try { renderVisible(map, indexRef.current, layerRef.current); } catch { /* noop */ }
        }
      });
    };

    map.on("moveend", schedule);
    map.on("zoomend", schedule);
    map.whenReady(schedule);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      map.off("moveend", schedule);
      map.off("zoomend", schedule);
      if (layerRef.current) {
        layerRef.current.clearLayers();
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
      // Tear down React popup roots
      for (const root of popupRootsRef.current.values()) {
        try { root.unmount(); } catch { /* noop */ }
      }
      popupRootsRef.current.clear();
      renderedRef.current.clear();
    };
  }, [map]);

  /** Compute current viewport features and reconcile with the layer. */
  function renderVisible(
    m: L.Map,
    index: Supercluster<any>,
    layer: L.LayerGroup,
  ) {
    const bounds = m.getBounds();
    const bbox: [number, number, number, number] = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ];
    const zoom = m.getZoom();
    const features = getVisibleClusters(index, bbox, zoom);

    const next = new Set<string>();
    for (const f of features) {
      const key = entryKey(f, Math.round(zoom));
      next.add(key);

      const existing = renderedRef.current.get(key);
      if (existing) continue;

      const [lng, lat] = f.geometry.coordinates as [number, number];
      let marker: L.Marker;

      if ((f.properties as any).cluster) {
        const count = (f.properties as any).point_count as number;
        const clusterId = (f.properties as any).cluster_id as number;
        marker = L.marker([lat, lng], {
          icon: getClusterIcon(count),
          riseOnHover: true,
        });
        marker.on("click", () => {
          const expansionZoom = Math.min(
            index.getClusterExpansionZoom(clusterId),
            (m.getMaxZoom?.() ?? 18),
          );
          m.flyTo([lat, lng], expansionZoom, { duration: 0.4 });
        });
        renderedRef.current.set(key, { kind: "cluster", key, marker });
      } else {
        const props = f.properties as any;
        const inc = incidentByIdRef.current.get(props.incidentId);
        if (!inc) continue;
        marker = L.marker([lat, lng], {
          icon: getIncidentIcon({
            eventType: props.eventType,
            casualties: props.casualties,
            isRecent: props.isRecent,
          }),
          riseOnHover: true,
        });
        attachReactPopup(marker, inc, queryClient, popupRootsRef.current);
        marker.on("click", () => onClickRef.current?.(inc.id));
        renderedRef.current.set(key, { kind: "point", key, marker });
      }
      layer.addLayer(marker);
    }

    // Remove markers that are no longer visible
    for (const [key, entry] of renderedRef.current) {
      if (!next.has(key)) {
        layer.removeLayer(entry.marker);
        if (entry.kind === "point") {
          // Schedule unmount on next tick so leaflet finishes its remove
          const root = popupRootsRef.current.get(key);
          if (root) {
            popupRootsRef.current.delete(key);
            queueMicrotask(() => {
              try { root.unmount(); } catch { /* noop */ }
            });
          }
        }
        renderedRef.current.delete(key);
      }
    }
  }

  const getMarker = useCallback((incidentId: string): L.Marker | undefined => {
    const entry = renderedRef.current.get(`p:${incidentId}`);
    return entry?.marker;
  }, []);

  const ensureIncidentVisible = useCallback(
    (incidentId: string): L.Marker | undefined => {
      const m = map;
      const idx = indexRef.current;
      const layer = layerRef.current;
      if (!m || !idx || !layer) return undefined;
      const existing = renderedRef.current.get(`p:${incidentId}`);
      if (existing) return existing.marker;
      const inc = incidentByIdRef.current.get(incidentId);
      if (!inc || inc.latitude == null || inc.longitude == null) return undefined;
      m.setView([inc.latitude, inc.longitude], Math.max(m.getZoom(), 11), {
        animate: true,
      });
      return undefined;
    },
    [map],
  );

  return { getMarker, ensureIncidentVisible };
}

/**
 * Mounts a React-rendered popup on demand. The popup container is created
 * once and React owns its contents — JSX auto-escaping eliminates the XSS
 * surface of the prior HTML-string popups, and KIA data flows through
 * React Query (request-coalesced under the hood).
 */
function attachReactPopup(
  marker: L.Marker,
  inc: IncidentWithCoords,
  queryClient: ReturnType<typeof useQueryClient>,
  rootsByKey: Map<string, Root>,
) {
  const container = document.createElement("div");
  const popup = L.popup({
    className: "dark-popup",
    maxWidth: 340,
    offset: [0, -16],
  }).setContent(container);
  marker.bindPopup(popup);

  let mounted = false;
  popup.on("add", () => {
    if (mounted) {
      // Recompute size in case content reflowed since last open.
      requestAnimationFrame(() => popup.update());
      return;
    }
    const root = createRoot(container);
    root.render(<IncidentPopupRoot incident={inc} queryClient={queryClient} />);
    rootsByKey.set(`p:${inc.id}`, root);
    mounted = true;
    // React renders asynchronously, so leaflet measures an empty container
    // and locks the wrapper to ~0 width. Recalc after the first paint.
    requestAnimationFrame(() => popup.update());
    setTimeout(() => popup.update(), 50);
  });
}

