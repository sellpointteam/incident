/**
 * Client-side helpers for the versioned administrative-geography system.
 * Pure functions only — no data-access.
 */
import type { AdminArea, AreaType } from "@/hooks/useAdminAreas";

export type HierarchyNode = AdminArea & { children: HierarchyNode[] };

/** Build a nested tree (division → district → subdivision → tehsil → sub_tehsil). */
export function buildHierarchy(areas: AdminArea[]): HierarchyNode[] {
  const byId = new Map<string, HierarchyNode>();
  for (const a of areas) byId.set(a.id, { ...a, children: [] });
  const roots: HierarchyNode[] = [];
  for (const node of byId.values()) {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const typeOrder: Record<AreaType, number> = {
    division: 0, district: 1, subdivision: 2, tehsil: 3, sub_tehsil: 4,
  };
  const sortRec = (nodes: HierarchyNode[]) => {
    nodes.sort((a, b) => {
      const t = typeOrder[a.area_type as AreaType] - typeOrder[b.area_type as AreaType];
      return t !== 0 ? t : a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

/** Human-friendly area-type label. */
export function areaTypeLabel(t: string): string {
  switch (t) {
    case "division": return "Division";
    case "district": return "District";
    case "subdivision": return "Subdivision";
    case "tehsil": return "Tehsil";
    case "sub_tehsil": return "Sub-Tehsil";
    default: return t;
  }
}

/** Convert an uploaded GeoJSON FeatureCollection to a normalized preview list. */
export interface ParsedGeoJsonFeature {
  name: string | null;
  properties: Record<string, unknown>;
  geometryType: string;
  raw: unknown;
}

export function parseGeoJsonFeatures(text: string, nameProp = "name"): ParsedGeoJsonFeature[] {
  const gj = JSON.parse(text);
  const features: any[] =
    gj?.type === "FeatureCollection" ? gj.features :
    gj?.type === "Feature" ? [gj] :
    [];
  return features.map((f) => ({
    name: (f?.properties?.[nameProp] as string) ?? null,
    properties: f?.properties ?? {},
    geometryType: f?.geometry?.type ?? "unknown",
    raw: f,
  }));
}
