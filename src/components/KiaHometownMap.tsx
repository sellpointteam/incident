import { useEffect, useRef, useMemo, useImperativeHandle, forwardRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { KiaSoldier } from "@/hooks/useKiaSoldiers";
import { supabase } from "@/integrations/supabase/client";
import { escapeHtml } from "@/lib/utils";
import { normalizeProvince as sharedNormalizeProvince, normalizeDistrict as sharedNormalizeDistrict, WAZIRISTAN_MIDPOINT } from "@/lib/normalize";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";


export interface KiaMapHandle {
  highlightHometown: (district: string, province: string, tehsil?: string, soldierId?: string) => void;
}

export interface UnmappedGroup {
  province: string;
  district: string;
  tehsil: string;
  count: number;
  names: string[];
  reason: string;
}

export interface KiaMapStats {
  totalSoldiers: number;
  mappedSoldiers: number;
  unmappedGroups: UnmappedGroup[];
}

interface Props {
  soldiers: KiaSoldier[];
  onMapStats?: (stats: KiaMapStats) => void;
}

function normalizeProvince(p: string): string {
  return sharedNormalizeProvince(p).toLowerCase();
}

const PROVINCE_CENTERS: Record<string, [number, number]> = {
  "khyber pakhtunkhwa": [34.5, 71.5],
  balochistan: [28.5, 66.5],
  sindh: [26.0, 68.5],
  punjab: [31.5, 73.0],
  "gilgit-baltistan": [35.8, 75.5],
  "azad jammu & kashmir": [33.9, 73.8],
  islamabad: [33.69, 73.04],
  "islamabad capital territory": [33.69, 73.04],
};

function useDistrictCoords() {
  return useQuery({
    queryKey: ["district_coordinates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("district_coordinates").select("*");
      if (error) throw error;
      return data;
    },
  });
}

const FORCE_COLORS: Record<string, { fill: string; border: string }> = {
  Army: { fill: "#22c55e", border: "#16a34a" },
  "Air Force": { fill: "#0ea5e9", border: "#0284c7" },
  ASF: { fill: "#f59e0b", border: "#d97706" },
  "Police/CTD": { fill: "#3b82f6", border: "#2563eb" },
  FC: { fill: "#ef4444", border: "#dc2626" },
  Rangers: { fill: "#eab308", border: "#ca8a04" },
  "Coast Guards": { fill: "#06b6d4", border: "#0891b2" },
  "Pro-State Militia": { fill: "#f97316", border: "#ea580c" },
};

const KiaHometownMap = forwardRef<KiaMapHandle, Props>(function KiaHometownMap({ soldiers, onMapStats }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [detailedMap, setDetailedMap] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  // Map from soldier id -> circle marker for highlight
  const markerMapRef = useRef<Map<string, L.CircleMarker>>(new Map());
  const dragLayerRef = useRef<L.LayerGroup | null>(null);
  const [editMode, setEditMode] = useState(false);
  const wasEditingRef = useRef(false);
  const { data: coords } = useDistrictCoords();
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  // Init map
  useEffect(() => {
    const pakBounds = L.latLngBounds([23.5, 60.0], [37.5, 78.0]);
    const map = L.map(containerRef.current!, {
      center: [30.3753, 69.3451],
      zoom: 5,
      zoomControl: true,
      minZoom: 4,
      maxBounds: pakBounds.pad(0.3),
      maxBoundsViscosity: 0.8,
    });
    const tile = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    }).addTo(map);
    tileLayerRef.current = tile;
    markersRef.current = L.layerGroup().addTo(map);
    dragLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; markersRef.current = null; dragLayerRef.current = null; };
  }, []);

  // Tile layer toggle
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tileLayerRef.current) return;
    map.removeLayer(tileLayerRef.current);
    const url = detailedMap
      ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
    const attr = detailedMap
      ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      : '&copy; <a href="https://carto.com/">CARTO</a>';
    const newTile = L.tileLayer(url, { attribution: attr }).addTo(map);
    newTile.bringToBack();
    tileLayerRef.current = newTile;
  }, [detailedMap]);

  function fuzzyDistrictMatch(distLower: string, coordsList: NonNullable<typeof coords>) {
    const direct = coordsList.find((c) => c.district.toLowerCase() === distLower);
    if (direct) return direct;
    for (const c of coordsList) {
      const cd = c.district.toLowerCase();
      if (distLower.includes(cd) || cd.includes(distLower)) return c;
    }
    for (const c of coordsList) {
      const cd = c.district.toLowerCase();
      if (Math.abs(cd.length - distLower.length) <= 2) {
        let mismatches = 0;
        const longer = cd.length > distLower.length ? cd : distLower;
        const shorter = cd.length > distLower.length ? distLower : cd;
        let si = 0;
        for (let li = 0; li < longer.length && si < shorter.length; li++) {
          if (longer[li] === shorter[si]) { si++; } else { mismatches++; }
        }
        mismatches += shorter.length - si;
        if (mismatches <= 2) return c;
      }
    }
    return null;
  }

  /** Resolve lat/lng for a single soldier. Priority: soldier's own coords > tehsil > district > province */
  function resolveCoords(soldier: KiaSoldier): { lat: number; lng: number; matchType: string } | null {
    // 1. Soldier's own persisted coordinates
    if (soldier.hometown_latitude != null && soldier.hometown_longitude != null) {
      return { lat: soldier.hometown_latitude, lng: soldier.hometown_longitude, matchType: "exact" };
    }

    if (!coords) return null;

    const province = soldier.hometown_province || "";
    const district = soldier.hometown_district || "";
    const tehsil = soldier.hometown_tehsil || "";
    const provLower = province.trim().toLowerCase();
    const isUnknown = !provLower || provLower === "unknown" || provLower === "not specified" || provLower === "not_specified";

    if (isUnknown) {
      return { lat: 22.5, lng: 66.5, matchType: "unknown" };
    }

    const normProv = normalizeProvince(province);
    const distLower = district.trim().toLowerCase();
    const tehsilLower = tehsil.trim().toLowerCase();

    if (distLower === "waziristan") {
      return { lat: WAZIRISTAN_MIDPOINT.latitude, lng: WAZIRISTAN_MIDPOINT.longitude, matchType: "district" };
    }

    // Tehsil match
    if (tehsilLower) {
      const m = fuzzyDistrictMatch(tehsilLower, coords);
      if (m) return { lat: m.latitude, lng: m.longitude, matchType: "district" };
    }

    // District match
    const provCoords = coords.filter((c) => normalizeProvince(c.province) === normProv);
    if (distLower) {
      const m = fuzzyDistrictMatch(distLower, normProv ? provCoords : coords);
      if (m) return { lat: m.latitude, lng: m.longitude, matchType: "district" };
      const m2 = fuzzyDistrictMatch(distLower, coords);
      if (m2) return { lat: m2.latitude, lng: m2.longitude, matchType: "district" };
    }

    // Province centroid
    if (normProv && provCoords.length > 0) {
      const lat = provCoords.reduce((s, c) => s + c.latitude, 0) / provCoords.length;
      const lng = provCoords.reduce((s, c) => s + c.longitude, 0) / provCoords.length;
      return { lat, lng, matchType: "province" };
    }
    if (normProv && PROVINCE_CENTERS[normProv]) {
      const [lat, lng] = PROVINCE_CENTERS[normProv];
      return { lat, lng, matchType: "province" };
    }

    return null;
  }

  // Highlight handler
  useImperativeHandle(ref, () => ({
    highlightHometown(district: string, province: string, tehsil?: string, soldierId?: string) {
      const map = mapRef.current;
      if (!map) return;

      let marker: L.CircleMarker | undefined;

      // 1. Prefer exact soldier-id lookup
      if (soldierId) marker = markerMapRef.current.get(soldierId);

      // 2. Otherwise find a soldier whose hometown matches the requested location
      if (!marker) {
        const distL = (district || "").trim().toLowerCase();
        const provL = normalizeProvince(province || "");
        const tehL = (tehsil || "").trim().toLowerCase();
        const match = soldiers.find((s) => {
          const sd = (s.hometown_district || "").trim().toLowerCase();
          const sp = normalizeProvince(s.hometown_province || "");
          const st = (s.hometown_tehsil || "").trim().toLowerCase();
          if (tehL && st && st !== tehL) return false;
          if (distL && sd !== distL) return false;
          if (provL && sp && sp !== provL) return false;
          return (distL && sd === distL) || (provL && sp === provL);
        });
        if (match) marker = markerMapRef.current.get(match.id);
      }

      if (!marker) return;

      const ll = marker.getLatLng();
      map.setView(ll, 8, { animate: true });
      marker.openPopup();
      const origRadius = marker.getRadius();
      const origColor = marker.options.color;
      const origFill = marker.options.fillColor;
      marker.setStyle({ color: "#dc2626", fillColor: "#ef4444" });
      marker.setRadius(origRadius + 6);
      setTimeout(() => {
        marker!.setStyle({ color: origColor, fillColor: origFill });
        marker!.setRadius(origRadius);
      }, 3000);
    },
  }));

  // Build individual markers
  useEffect(() => {
    const map = mapRef.current;
    const markers = markersRef.current;
    if (!map || !markers || !coords) return;
    markers.clearLayers();
    markerMapRef.current.clear();

    const points: [number, number][] = [];
    let mappedCount = 0;
    const unmappedGroupsMap: Record<string, UnmappedGroup> = {};

    // To offset overlapping soldiers at the same coords, track used positions
    const positionCount: Record<string, number> = {};

    // Collect "unknown/province-only" soldiers into grouped circles
    type GroupedEntry = { soldiers: KiaSoldier[]; lat: number; lng: number; matchType: string };
    const groupedBuckets: Record<string, GroupedEntry> = {};

    soldiers.forEach((soldier) => {
      const resolved = resolveCoords(soldier);
      if (!resolved) {
        const key = `${soldier.hometown_tehsil || ""}|${soldier.hometown_district || ""}|${soldier.hometown_province || ""}`.toLowerCase();
        if (!unmappedGroupsMap[key]) {
          const normProv = normalizeProvince(soldier.hometown_province || "");
          const distLower = (soldier.hometown_district || "").trim().toLowerCase();
          unmappedGroupsMap[key] = {
            province: soldier.hometown_province || "",
            district: soldier.hometown_district || "",
            tehsil: soldier.hometown_tehsil || "",
            count: 0,
            names: [],
            reason: !normProv ? "No province set" : !distLower ? "No district set" : `District "${soldier.hometown_district}" not found`,
          };
        }
        unmappedGroupsMap[key].count++;
        unmappedGroupsMap[key].names.push(soldier.name);
        return;
      }

      mappedCount++;

      // Group unknowns and province-only matches into combined circles
      if (resolved.matchType === "unknown" || resolved.matchType === "province") {
        const bucketKey = `${resolved.matchType}|${resolved.lat.toFixed(2)},${resolved.lng.toFixed(2)}`;
        if (!groupedBuckets[bucketKey]) {
          groupedBuckets[bucketKey] = { soldiers: [], lat: resolved.lat, lng: resolved.lng, matchType: resolved.matchType };
        }
        groupedBuckets[bucketKey].soldiers.push(soldier);
        return;
      }

      // Individual marker for district/exact matches
      const posKey = `${resolved.lat.toFixed(4)},${resolved.lng.toFixed(4)}`;
      const idx = positionCount[posKey] || 0;
      positionCount[posKey] = idx + 1;

      let lat = resolved.lat;
      let lng = resolved.lng;
      if (idx > 0) {
        const angle = (idx * 137.5 * Math.PI) / 180;
        const r = 0.02 + idx * 0.008;
        lat += r * Math.cos(angle);
        lng += r * Math.sin(angle);
      }

      const force = soldier.force_type || "Army";
      const fc = FORCE_COLORS[force] || FORCE_COLORS.Army;

      const marker = L.circleMarker([lat, lng], {
        radius: 6,
        color: resolved.matchType === "exact" || resolved.matchType === "district" ? fc.border : "#7c3aed",
        fillColor: resolved.matchType === "exact" || resolved.matchType === "district" ? fc.fill : "#a78bfa",
        fillOpacity: 0.8,
        weight: 2,
      });

      const locationLabel = soldier.hometown_district || soldier.hometown_province || "Unknown";
      const sublabel = soldier.hometown_province || "";

      marker.bindPopup(`
        <div style="min-width:180px;font-family:monospace;font-size:12px;">
          <p style="font-weight:700;margin:0 0 2px;font-size:13px;">${escapeHtml(soldier.name)}</p>
          ${soldier.rank ? `<p style="font-size:10px;color:#64748b;margin:0 0 4px;">${escapeHtml(soldier.rank)}</p>` : ""}
          <span style="background:${fc.fill};color:#fff;font-size:9px;padding:1px 6px;border-radius:3px;font-weight:600;">${escapeHtml(force)}</span>
          <p style="font-size:11px;margin:6px 0 2px;">${escapeHtml(locationLabel)}</p>
          <p style="font-size:10px;color:#64748b;margin:0;">${escapeHtml(sublabel)}</p>
        </div>
      `);

      markers.addLayer(marker);
      markerMapRef.current.set(soldier.id, marker);
      points.push([lat, lng]);
    });

    // Render grouped circles for unknown/province-only soldiers
    Object.values(groupedBuckets).forEach((bucket) => {
      const isUnknown = bucket.matchType === "unknown";
      const radius = Math.max(8, Math.min(22, 6 + bucket.soldiers.length * 3));

      // Determine dominant force for color
      const forceCounts: Record<string, number> = {};
      bucket.soldiers.forEach((s) => { const f = s.force_type || "Army"; forceCounts[f] = (forceCounts[f] || 0) + 1; });
      const hasArmy = forceCounts["Army"] > 0;
      const hasFC = forceCounts["FC"] > 0;
      const dominantForce = hasArmy ? "Army" : hasFC ? "FC" : (Object.keys(forceCounts)[0] || "Army");
      const fc = FORCE_COLORS[dominantForce] || FORCE_COLORS.Army;

      const marker = L.circleMarker([bucket.lat, bucket.lng], {
        radius,
        color: isUnknown ? "#6b7280" : "#7c3aed",
        fillColor: isUnknown ? "#9ca3af" : "#a78bfa",
        fillOpacity: 0.8,
        weight: 2,
        dashArray: isUnknown ? "4 4" : undefined,
      });

      const locationLabel = isUnknown ? "Hometown Unknown" : `${bucket.soldiers[0]?.hometown_province || "Unknown"} (approx.)`;

      const forceBreakdown = Object.entries(forceCounts)
        .map(([f, c]) => {
          const fColor = FORCE_COLORS[f] || FORCE_COLORS.Army;
          return `<span style="background:${fColor.fill};color:#fff;font-size:9px;padding:1px 6px;border-radius:3px;font-weight:600;">${f}: ${c}</span>`;
        }).join(" ");

      const namesList = bucket.soldiers.slice(0, 15).map((s) => {
        const fColor = FORCE_COLORS[s.force_type || "Army"] || FORCE_COLORS.Army;
        return `<span>${escapeHtml(s.name)}</span> <span style="background:${fColor.fill};color:#fff;font-size:8px;padding:1px 4px;border-radius:3px;font-weight:600;margin-left:4px;">${escapeHtml(s.force_type || "Army")}</span>`;
      }).join("<br/>");
      const more = bucket.soldiers.length > 15 ? `<br/><i>+${bucket.soldiers.length - 15} more</i>` : "";

      marker.bindPopup(`
        <div style="min-width:200px;font-family:monospace;font-size:12px;">
          <p style="font-weight:700;margin:0 0 4px;font-size:13px;">${escapeHtml(locationLabel)}</p>
          <p style="font-size:12px;font-weight:700;color:#dc2626;margin:0 0 6px;">${bucket.soldiers.length} KIA</p>
          <div style="margin:0 0 8px;display:flex;gap:4px;flex-wrap:wrap;">${forceBreakdown}</div>
          <div style="font-size:11px;line-height:1.8;">${namesList}${more}</div>
        </div>
      `);

      markers.addLayer(marker);
      // Store with first soldier's id for reference
      bucket.soldiers.forEach((s) => markerMapRef.current.set(s.id, marker));
      points.push([bucket.lat, bucket.lng]);
    });

    onMapStats?.({
      totalSoldiers: soldiers.length,
      mappedSoldiers: mappedCount,
      unmappedGroups: Object.values(unmappedGroupsMap),
    });

    const wasEditing = wasEditingRef.current;
    wasEditingRef.current = editMode;
    if (points.length > 0 && !editMode && !wasEditing) {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 7 });
    }
  }, [soldiers, coords, editMode, onMapStats]);

  // Edit mode: draggable markers per soldier
  useEffect(() => {
    const map = mapRef.current;
    const dragLayer = dragLayerRef.current;
    if (!map || !dragLayer) return;
    dragLayer.clearLayers();
    if (!editMode) return;

    markerMapRef.current.forEach((circleMarker, soldierId) => {
      const soldier = soldiers.find((s) => s.id === soldierId);
      if (!soldier) return;

      const latlng = circleMarker.getLatLng();
      const label = soldier.name || soldierId;

      const dragIcon = L.divIcon({
        className: "edit-drag-marker",
        html: `<div style="width:14px;height:14px;border-radius:50%;border:2px solid #f59e0b;background:rgba(245,158,11,0.3);cursor:grab;"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const dragMarker = L.marker(latlng, {
        draggable: true,
        icon: dragIcon,
        zIndexOffset: 1000,
      });

      dragMarker.bindTooltip(
        `<span style="font-family:monospace;font-size:10px;">${escapeHtml(label)} — Drag to adjust</span>`,
        { direction: "top", offset: [0, -10] }
      );

      dragMarker.on("dragend", async () => {
        const newPos = dragMarker.getLatLng();
        try {
          const { error } = await supabase
            .from("kia_soldiers")
            .update({ hometown_latitude: newPos.lat, hometown_longitude: newPos.lng })
            .eq("id", soldierId);
          if (error) throw error;

          circleMarker.setLatLng(newPos);
          toast({
            title: "Coordinates saved",
            description: `${label}: ${newPos.lat.toFixed(4)}, ${newPos.lng.toFixed(4)}`,
          });
          qc.invalidateQueries({ queryKey: ["kia"] });
        } catch (err) {
          console.error("Failed to update soldier coords:", err);
          toast({ title: "Failed to save", description: "Could not update coordinates.", variant: "destructive" });
          dragMarker.setLatLng(latlng);
        }
      });

      dragLayer.addLayer(dragMarker);
    });
  }, [editMode, soldiers, coords, qc, toast]);

  return (
    <div className="relative h-full w-full">
      <div className="absolute top-2 left-2 z-[1000] flex gap-1 flex-wrap">
        <button
          onClick={() => setDetailedMap((v) => !v)}
          className={`px-2 py-1 rounded text-[10px] font-mono font-semibold transition-colors ${
            detailedMap
              ? "bg-emerald-600 text-white shadow-lg"
              : "bg-card border border-border text-muted-foreground hover:bg-accent"
          }`}
        >
          Detailed Map
        </button>
        {editMode && (
          <span className="px-2 py-1 bg-amber-500/90 text-black rounded text-[10px] font-mono font-semibold">
            DRAG MARKERS TO ADJUST
          </span>
        )}
      </div>
      {isAdmin && (
        <button
          onClick={() => setEditMode((v) => !v)}
          className={`absolute top-2 right-2 z-[1000] px-3 py-1.5 rounded text-xs font-mono font-semibold transition-colors ${
            editMode
              ? "bg-amber-500 text-black shadow-lg"
              : "bg-card border border-border text-muted-foreground hover:bg-accent"
          }`}
        >
          {editMode ? "✎ EDITING — Click to Exit" : "✎ Edit Coords"}
        </button>
      )}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
});

export default KiaHometownMap;
