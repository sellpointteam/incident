import { describe, it, expect } from "vitest";
import { buildHierarchy, parseGeoJsonFeatures, areaTypeLabel } from "@/lib/adminGeography";
import type { AdminArea } from "@/hooks/useAdminAreas";

const mk = (o: Partial<AdminArea>): AdminArea => ({
  id: o.id ?? crypto.randomUUID(),
  boundary_version_id: "v",
  parent_id: o.parent_id ?? null,
  country: "Pakistan",
  province: "Balochistan",
  area_type: o.area_type ?? "district",
  name: o.name ?? "X",
  stable_key: o.stable_key ?? null,
  status: "current",
  geometry_status: "pending",
  geom: null,
  centroid: null,
  metadata: {},
  created_by: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} as unknown as AdminArea);

describe("buildHierarchy", () => {
  it("nests districts under divisions and orders by type then name", () => {
    const div = mk({ id: "1", area_type: "division", name: "Quetta Division" });
    const qw = mk({ id: "3", parent_id: "1", area_type: "district", name: "Quetta West" });
    const qe = mk({ id: "2", parent_id: "1", area_type: "district", name: "Quetta East" });
    const saddar = mk({ id: "4", parent_id: "2", area_type: "subdivision", name: "Saddar" });
    const tree = buildHierarchy([qw, qe, div, saddar]);
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe("Quetta Division");
    expect(tree[0].children.map((c) => c.name)).toEqual(["Quetta East", "Quetta West"]);
    expect(tree[0].children[0].children[0].name).toBe("Saddar");
  });

  it("keeps orphans as roots (never silently attaches to wrong parent)", () => {
    const orphan = mk({ id: "9", parent_id: "does-not-exist", name: "Orphan" });
    const tree = buildHierarchy([orphan]);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("9");
  });
});

describe("parseGeoJsonFeatures", () => {
  it("parses a FeatureCollection with configurable name prop", () => {
    const gj = JSON.stringify({
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: { DISTRICT: "Quetta East" }, geometry: { type: "Polygon", coordinates: [] } },
      ],
    });
    const rows = parseGeoJsonFeatures(gj, "DISTRICT");
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Quetta East");
    expect(rows[0].geometryType).toBe("Polygon");
  });
});

describe("areaTypeLabel", () => {
  it("formats sub_tehsil as Sub-Tehsil", () => {
    expect(areaTypeLabel("sub_tehsil")).toBe("Sub-Tehsil");
  });
});
