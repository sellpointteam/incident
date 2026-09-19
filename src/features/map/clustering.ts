/**
 * Supercluster-backed clustering for incident markers.
 *
 * We index all geo-located incidents once and ask supercluster for the
 * visible clusters/leaves on each map move. This scales to tens of
 * thousands of points without breaking a sweat — the prior implementation
 * recreated every marker on every render and could not survive past a
 * couple thousand rows.
 */
import Supercluster from "supercluster";
import type { IncidentWithCoords } from "@/lib/types";

export type IncidentClusterProps = {
  incidentId: string;
  eventType: string;
  casualties: number;
  isRecent: boolean;
};

export type ClusterFeature = Supercluster.PointFeature<IncidentClusterProps> & {
  properties: IncidentClusterProps;
};

export type ClusterOrPoint =
  | (Supercluster.ClusterFeature<Supercluster.AnyProps> & {
      properties: { cluster: true; cluster_id: number; point_count: number };
    })
  | ClusterFeature;

export function buildIndex(
  incidents: IncidentWithCoords[],
  isRecent: (inc: IncidentWithCoords) => boolean,
): Supercluster<IncidentClusterProps> {
  const index = new Supercluster<IncidentClusterProps>({
    radius: 60,
    maxZoom: 11,
    minPoints: 3,
  });

  const features: ClusterFeature[] = [];
  for (const inc of incidents) {
    if (inc.latitude == null || inc.longitude == null) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [inc.longitude, inc.latitude] },
      properties: {
        incidentId: inc.id,
        eventType: inc.event_type,
        casualties: inc.soldiers_killed,
        isRecent: isRecent(inc),
      },
    });
  }
  index.load(features);
  return index;
}

export function getVisibleClusters(
  index: Supercluster<IncidentClusterProps>,
  bbox: [number, number, number, number],
  zoom: number,
): ClusterOrPoint[] {
  return index.getClusters(bbox, Math.round(zoom)) as ClusterOrPoint[];
}
