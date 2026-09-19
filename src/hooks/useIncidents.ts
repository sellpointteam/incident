import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeProvince, normalizeDistrict, WAZIRISTAN_MIDPOINT } from "@/lib/normalize";
import type { DistrictCoordinate, IncidentWithCoords } from "@/lib/types";
import { qk, type IncidentFilters } from "@/lib/queryKeys";
import { INCIDENT_LIST_COLUMNS } from "@/lib/selectors";

export interface UseIncidentsOptions extends IncidentFilters {
  /** Maximum rows to return. Defaults to 2000 to keep public payloads bounded. */
  limit?: number;
}

// Lowered from 2000 → 750 to shrink the initial payload/parse and memory
// footprint for the public map. The map already clusters, filters and
// virtualizes downstream, so 750 recent-by-date incidents cover the visible
// UX while cutting first-paint work ~2.7x. Admin/analytics paths use their
// own paginated hooks and are not bound by this cap.
const DEFAULT_LIMIT = 750;

export function useIncidents(options: UseIncidentsOptions = {}) {
  const {
    dateFrom = null,
    dateTo = null,
    province = null,
    district = null,
    eventType = null,
    search = null,
    limit = DEFAULT_LIMIT,
  } = options;

  const filterKey = { dateFrom, dateTo, province, district, eventType, search, limit, publishedOnly: true };

  return useQuery({
    queryKey: qk.incidents.map(filterKey),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<IncidentWithCoords[]> => {
      let incQuery = supabase
        .from("incidents")
        .select(INCIDENT_LIST_COLUMNS)
        .eq("published", true)
        .eq("country", "Pakistan")
        .order("date", { ascending: false })
        .limit(limit);

      if (dateFrom) incQuery = incQuery.gte("date", dateFrom);
      if (dateTo) incQuery = incQuery.lte("date", dateTo);
      if (province && province !== "all") incQuery = incQuery.eq("province", province);
      if (district && district !== "all") incQuery = incQuery.eq("district", district);
      if (eventType && eventType !== "all") incQuery = incQuery.eq("event_type", eventType as any);
      if (search) {
        const s = `%${search}%`;
        incQuery = incQuery.or(
          `province.ilike.${s},district.ilike.${s},location_name.ilike.${s},summary.ilike.${s}`,
        );
      }

      const [incidentsRes, coordsRes] = await Promise.all([
        incQuery,
        supabase.from("district_coordinates").select("country,province,district,tehsil,latitude,longitude"),
      ]);

      if (incidentsRes.error) throw incidentsRes.error;
      if (coordsRes.error) throw coordsRes.error;

      // Do not join/fetch incident_sources for the whole public map load.
      // With thousands of visible incidents, a single `.in(id[])` request turns
      // into an enormous URL and can intermittently hang/fail in browsers,
      // leaving the homepage stuck on the skeleton. The incidents table already
      // carries `source_url` for the popup/feed, so keep the map query bounded.

      // Build lookup maps: tehsil-level first, then district-level
      const tehsilMap = new Map<string, DistrictCoordinate>();
      const districtMap = new Map<string, DistrictCoordinate>();

      (coordsRes.data as DistrictCoordinate[]).forEach((c) => {
        const provinceN = normalizeProvince(c.province);
        const districtN = normalizeDistrict(c.district);
        const districtKey = `${c.country}|${provinceN}|${districtN}`;
        if (!c.tehsil) {
          districtMap.set(districtKey, c);
        } else {
          const tehsilKey = `${c.country}|${provinceN}|${districtN}|${c.tehsil}`;
          tehsilMap.set(tehsilKey, c);
        }
      });

      const PROVINCE_DEFAULTS: Record<string, { latitude: number; longitude: number }> = {
        "Balochistan": { latitude: 28.49, longitude: 65.09 },
        "Khyber Pakhtunkhwa": { latitude: 34.17, longitude: 71.84 },
        "Sindh": { latitude: 25.89, longitude: 68.52 },
        "Punjab": { latitude: 31.17, longitude: 72.71 },
        "Gilgit-Baltistan": { latitude: 35.80, longitude: 74.98 },
        "Azad Jammu & Kashmir": { latitude: 33.93, longitude: 73.78 },
        "FATA": { latitude: 33.50, longitude: 70.50 },
        "Islamabad Capital Territory": { latitude: 33.6844, longitude: 73.0479 },
      };

      // (country = Pakistan is already filtered server-side)
      return (incidentsRes.data as any[]).map((raw) => {
        const provinceN = normalizeProvince(raw.province);
        const districtN = normalizeDistrict(raw.district);
        const tehsil = raw.location_name?.trim();

        const inc = { ...raw, province: provinceN, district: districtN } as IncidentWithCoords;

        if (inc.latitude && inc.longitude) return inc;

        if (districtN === "Waziristan") {
          return { ...inc, latitude: WAZIRISTAN_MIDPOINT.latitude, longitude: WAZIRISTAN_MIDPOINT.longitude };
        }

        if (tehsil) {
          const tehsilKey = `${inc.country}|${provinceN}|${districtN}|${tehsil}`;
          const tehsilCoords = tehsilMap.get(tehsilKey);
          if (tehsilCoords) {
            return { ...inc, latitude: tehsilCoords.latitude, longitude: tehsilCoords.longitude };
          }
        }

        const districtKey = `${inc.country}|${provinceN}|${districtN}`;
        const districtCoords = districtMap.get(districtKey);
        if (districtCoords) {
          return { ...inc, latitude: districtCoords.latitude, longitude: districtCoords.longitude };
        }

        const provDefault = PROVINCE_DEFAULTS[provinceN];
        return { ...inc, latitude: provDefault?.latitude, longitude: provDefault?.longitude };
      });
    },
  });
}

export function useDistrictCoordinates() {
  return useQuery({
    queryKey: qk.geo.districts,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("district_coordinates")
        .select("id,country,province,district,tehsil,latitude,longitude")
        .order("province");
      if (error) throw error;
      return data as DistrictCoordinate[];
    },
  });
}
