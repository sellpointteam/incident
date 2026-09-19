import { memo, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { IncidentWithCoords } from "@/lib/types";
import { escapeHtmlText } from "@/lib/sanitize";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useMapMarkers } from "@/features/map/useMapMarkers";
import { useMilitantActivity } from "@/hooks/useMilitantActivity";
import { createActivityLayer, type ActivityLayerGroupData } from "@/features/map/activityHeatmap";
import MapActivityControl from "@/components/MapActivityControl";


interface Props {
  incidents: IncidentWithCoords[];
  highlightedId?: string | null;
  onMarkerClick?: (id: string) => void;
  heatmapMode?: boolean;
  
}

function IncidentMapImpl({ incidents, highlightedId, onMarkerClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const dragLayerRef = useRef<L.LayerGroup | null>(null);
  const [editMode, setEditMode] = useState(false);
  const didInitialFitRef = useRef(false);
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  // Init
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const pakBounds = L.latLngBounds([23.5, 60.0], [37.5, 78.0]);
    const m = L.map(containerRef.current, {
      center: [30.3753, 69.3451],
      zoom: 5,
      zoomControl: true,
      minZoom: 5,
      maxBounds: pakBounds.pad(0.3),
      maxBoundsViscosity: 0.8,
      preferCanvas: true,
    });
    const tile = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      subdomains: "abc",
      updateWhenIdle: true,
      updateWhenZooming: false,
      keepBuffer: 4,
      crossOrigin: true,
    }).addTo(m);
    tileLayerRef.current = tile;
    dragLayerRef.current = L.layerGroup().addTo(m);
    mapRef.current = m;
    setMap(m);
    return () => {
      m.remove();
      mapRef.current = null;
      dragLayerRef.current = null;
      setMap(null);
    };
  }, []);


  // --- Militant activity overlay (independent of incident filters) ---
  const [activityEnabled, setActivityEnabled] = useState(false);
  const [selectedActors, setSelectedActors] = useState<Set<string>>(new Set());
  const { data: activityGroups, isLoading: activityLoading } = useMilitantActivity(activityEnabled);
  const activityLayerRef = useRef<ReturnType<typeof createActivityLayer> | null>(null);
  const didAutoSelectRef = useRef(false);

  // Default selection: top 4 groups the first time the overlay is enabled.
  useEffect(() => {
    if (!activityEnabled || didAutoSelectRef.current) return;
    if (!activityGroups || activityGroups.length === 0) return;
    setSelectedActors(new Set(activityGroups.slice(0, 4).map((g) => g.actorId)));
    didAutoSelectRef.current = true;
  }, [activityEnabled, activityGroups]);

  const layerGroups = useMemo<ActivityLayerGroupData[]>(() => {
    if (!activityEnabled || !activityGroups) return [];
    return activityGroups
      .filter((g) => selectedActors.has(g.actorId))
      .map((g) => ({ actorId: g.actorId, name: g.name, color: g.color, points: g.points }));
  }, [activityEnabled, activityGroups, selectedActors]);

  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    if (layerGroups.length === 0) {
      if (activityLayerRef.current) {
        m.removeLayer(activityLayerRef.current as unknown as L.Layer);
        activityLayerRef.current = null;
      }
      return;
    }
    if (!activityLayerRef.current) {
      const layer = createActivityLayer(layerGroups);
      (layer as unknown as L.Layer).addTo(m);
      activityLayerRef.current = layer;
    } else {
      activityLayerRef.current.setGroups(layerGroups);
    }
  }, [layerGroups, map]);

  useEffect(() => {
    return () => {
      const m = mapRef.current;
      if (m && activityLayerRef.current) m.removeLayer(activityLayerRef.current as unknown as L.Layer);
      activityLayerRef.current = null;
    };
  }, []);

  // When the activity overlay is on we hide the incident clusters/markers so
  // only the militant footprint is visible.
  const markerIncidents = useMemo(
    () => (activityEnabled ? [] : incidents),
    [activityEnabled, incidents],
  );

  // Diff-based supercluster markers (Phase 2 refactor).
  const { getMarker, ensureIncidentVisible } = useMapMarkers(map, markerIncidents, {
    onMarkerClick,
  });


  // Initial fit-to-data once incidents are loaded (don't fight the user later).
  useEffect(() => {
    const m = mapRef.current;
    if (!m || didInitialFitRef.current || editMode) return;
    const geo = incidents.filter((i) => i.latitude != null && i.longitude != null);
    if (geo.length === 0) return;
    const bounds = L.latLngBounds(geo.map((i) => [i.latitude!, i.longitude!] as [number, number]));
    m.fitBounds(bounds, { padding: [40, 40], maxZoom: 7 });
    didInitialFitRef.current = true;
  }, [incidents, editMode]);

  // Edit-mode draggables — viewport-scoped.
  // The previous implementation dropped a draggable Leaflet marker for EVERY
  // incident (2000+ DOM nodes + handlers), which froze the map the moment an
  // admin toggled edit mode. Now we only build draggables for incidents that
  // are actually inside the current map viewport, and we rebuild on pan/zoom.
  useEffect(() => {
    const m = mapRef.current;
    const dragLayer = dragLayerRef.current;
    if (!m || !dragLayer) return;

    const rebuild = () => {
      dragLayer.clearLayers();
      if (!editMode) return;
      const bounds = m.getBounds();
      // Hard cap so an admin zoomed all the way out doesn't recreate the
      // full-country freeze. They must zoom in a bit to edit — matches the
      // "only edit what you can see" model.
      const MAX_DRAGGABLES = 150;
      const inView: typeof incidents = [];
      for (const inc of incidents) {
        if (inc.latitude == null || inc.longitude == null) continue;
        if (!bounds.contains([inc.latitude, inc.longitude])) continue;
        inView.push(inc);
        if (inView.length >= MAX_DRAGGABLES) break;
      }

      inView.forEach((inc) => {
        const dragIcon = L.divIcon({
          className: "edit-drag-marker",
          html: `<div style="width:14px;height:14px;border-radius:50%;border:2px solid #f59e0b;background:rgba(245,158,11,0.3);cursor:grab;"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        const dragMarker = L.marker([inc.latitude!, inc.longitude!], { draggable: true, icon: dragIcon, zIndexOffset: 1000 });
        dragMarker.bindTooltip(
          `<span style="font-family:monospace;font-size:10px;">${escapeHtmlText(inc.district || inc.province)} — Drag to adjust</span>`,
          { direction: "top", offset: [0, -10] },
        );
        dragMarker.on("dragend", async () => {
          const newPos = dragMarker.getLatLng();
          try {
            const { error } = await supabase.from("incidents").update({ latitude: newPos.lat, longitude: newPos.lng }).eq("id", inc.id);
            if (error) throw error;
            toast({ title: "Coordinates updated", description: `${inc.district || inc.province}: ${newPos.lat.toFixed(4)}, ${newPos.lng.toFixed(4)}` });
            qc.invalidateQueries({ queryKey: ["incidents"] });
          } catch {
            toast({ title: "Failed to save", variant: "destructive" });
            dragMarker.setLatLng([inc.latitude!, inc.longitude!]);
          }
        });
        dragLayer.addLayer(dragMarker);
      });
    };

    rebuild();
    if (!editMode) return;
    // Rebuild on viewport change so admins can pan/zoom without seeing stale
    // drag pins outside the visible area.
    let rafId = 0;
    const schedule = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => { rafId = 0; rebuild(); });
    };
    m.on("moveend", schedule);
    m.on("zoomend", schedule);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      m.off("moveend", schedule);
      m.off("zoomend", schedule);
    };
  }, [editMode, incidents, qc, toast]);



  useEffect(() => {
    const m = mapRef.current;
    if (!m || !highlightedId) return;
    const tryOpen = () => {
      const marker = getMarker(highlightedId);
      if (!marker) return false;
      const latlng = marker.getLatLng();
      m.setView(latlng, Math.max(m.getZoom(), 8), { animate: true });
      const el = (marker as any).getElement() as HTMLElement | null;
      if (el) {
        el.style.transform = (el.style.transform || "") + " scale(1.3)";
        el.style.zIndex = "999";
        setTimeout(() => {
          el.style.transform = el.style.transform.replace(" scale(1.3)", "");
          el.style.zIndex = "";
        }, 2000);
      }
      if ((marker as any)._map) marker.openPopup();
      return true;
    };
    if (!tryOpen()) {
      ensureIncidentVisible(highlightedId);
      // Wait for moveend → re-render → marker exists
      const handle = () => {
        if (tryOpen()) m.off("moveend", handle);
      };
      m.on("moveend", handle);
      setTimeout(() => m.off("moveend", handle), 3000);
    }
  }, [highlightedId, getMarker, ensureIncidentVisible]);

  return (
    <div className="relative h-full w-full">
      {editMode && (
        <div className="absolute top-3 left-3 z-[1000] px-2.5 py-1 bg-warning/90 text-warning-foreground rounded-md text-[10px] font-mono font-semibold uppercase tracking-wider shadow-lg">
          ✎ Drag markers to adjust
        </div>
      )}
      {isAdmin && (
        <button
          onClick={() => setEditMode((v) => !v)}
          className={`absolute bottom-3 right-3 z-[1000] px-3 py-1.5 rounded-md text-[11px] font-mono font-semibold uppercase tracking-wider transition-all ${
            editMode ? "bg-warning text-warning-foreground shadow-lg" : "glass text-muted-foreground hover:text-foreground"
          }`}
        >
          {editMode ? "Exit Edit" : "✎ Edit Coords"}
        </button>
      )}
      <MapActivityControl
        groups={activityGroups ?? []}
        selected={selectedActors}
        loading={activityLoading}
        enabled={activityEnabled}
        onToggleEnabled={() => setActivityEnabled((v) => !v)}
        onToggleActor={(id) =>
          setSelectedActors((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          })
        }
        onSoloActor={(id) => setSelectedActors(new Set([id]))}
        onSelectAll={() => setSelectedActors(new Set((activityGroups ?? []).map((g) => g.actorId)))}
        onClear={() => setSelectedActors(new Set())}
      />
      <div ref={containerRef} className="h-full w-full" />

    </div>
  );
}

// Memoize so unrelated parent re-renders (filter chips, stats counter ticks,
// live feed inserts) don't trigger a full map prop diff / effect cascade.
const IncidentMap = memo(IncidentMapImpl);
export default IncidentMap;

