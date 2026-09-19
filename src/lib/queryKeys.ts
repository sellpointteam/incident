/**
 * Centralized React Query key factory. Every query in the app pulls
 * its key from here so invalidations stay correct as filters/columns evolve.
 *
 * Use `casualtyInvalidation.invalidateAllCasualtyData(qc)` after any KIA /
 * militant / incident mutation instead of hand-invalidating individual keys.
 */

export type IncidentFilters = {
  province?: string | null;
  district?: string | null;
  eventType?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  publishedOnly?: boolean;
  search?: string | null;
};

export type KiaFilters = {
  province?: string | null;
  district?: string | null;
  force?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  search?: string | null;
};

export const qk = {
  incidents: {
    all: ["incidents"] as const,
    list: (f: IncidentFilters = {}) => ["incidents", "list", f] as const,
    map: (f: IncidentFilters = {}) => ["incidents", "map", f] as const,
    detail: (id: string) => ["incidents", "detail", id] as const,
    admin: (f: IncidentFilters = {}) => ["incidents", "admin", f] as const,
    counts: (ids: ReadonlyArray<string>) =>
      ["incidents", "counts", [...ids].sort().join(",")] as const,
    countsAll: ["incidents", "counts"] as const,
  },
  kia: {
    all: ["kia"] as const,
    list: (f: KiaFilters = {}) => ["kia", "list", f] as const,
    byIncident: (ids: ReadonlyArray<string>) =>
      ["kia", "byIncident", [...ids].sort()] as const,
    byIncidentFull: (id: string) => ["kia", "byIncidentFull", id] as const,
  },
  militants: {
    all: ["militant_casualties"] as const,
    list: () => ["militant_casualties", "list"] as const,
  },
  stats: {
    all: ["public_stats"] as const,
  },
  integrity: {
    all: ["admin", "integrity"] as const,
  },
  channels: {
    all: ["channels"] as const,
    list: () => ["channels", "list"] as const,
  },
  reviews: {
    all: ["reviews"] as const,
    pending: () => ["reviews", "pending"] as const,
  },
  blog: {
    all: ["blog"] as const,
    published: () => ["blog", "published"] as const,
    bySlug: (slug: string) => ["blog", "bySlug", slug] as const,
  },
  auth: {
    isAdmin: (userId: string | null | undefined) =>
      ["auth", "isAdmin", userId ?? "anon"] as const,
  },
  geo: {
    districts: ["geo", "districts"] as const,
  },
} as const;
