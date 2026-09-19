import { useState, useMemo, useCallback, useDeferredValue, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useIncidents } from "@/hooks/useIncidents";
import { useKiaSoldiers } from "@/hooks/useKiaSoldiers";
import LiveIncidentTable from "@/components/LiveIncidentTable";
import { normalizeDistrict } from "@/lib/normalize";
import { isIrregularForce } from "@/lib/forces";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAuth } from "@/hooks/useAuth";

import StatsBar from "@/components/StatsBar";
import LiveIncidentFeed from "@/components/LiveIncidentFeed";
import IntelPanel from "@/components/IntelPanel";
import SEO from "@/components/SEO";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { parseIncidentDate } from "@/lib/date";
import { cn } from "@/lib/utils";
import { Search, AlertTriangle, SlidersHorizontal, X, Layers, ShieldAlert, Skull, Shield, CalendarIcon, RotateCcw } from "lucide-react";
import { EVENT_TYPE_LABELS } from "@/lib/types";
import { Constants } from "@/integrations/supabase/types";
import type { EventType, Incident } from "@/lib/types";
import QuickIncidentEditDialog from "@/components/admin/QuickIncidentEditDialog";
import IncidentKiaDialog from "@/components/IncidentKiaDialog";

// Heavy / data-fetching components deferred until their tab/map is opened.
// This keeps the initial Supabase request fan-out small (incidents + kia only).
const IncidentMap = lazy(() => import("@/components/IncidentMap"));
const MilitantRegistry = lazy(() => import("@/components/MilitantRegistry"));
const KiaTracker = lazy(() => import("@/pages/KiaTracker"));


const LazyFallback = () => (
  <div className="flex items-center justify-center h-40 text-muted-foreground font-mono text-[11px] uppercase tracking-wider">
    Loading…
  </div>
);


export default function Index() {
  const navigate = useNavigate();
  const { data: incidents, isLoading } = useIncidents();
  const { isAdmin } = useAuth();

  const [logView, setLogView] = useState<"incidents" | "militant" | "security">("incidents");
  const [filters, setFilters] = useState({
    province: "all",
    eventType: "all",
    district: "all",
    dateFrom: "",
    dateTo: "",
  });
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);
  const [kiaIncident, setKiaIncident] = useState<Incident | null>(null);
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(true);
  const needsKiaRegistry = isAdmin;
  const { data: kiaSoldiers } = useKiaSoldiers({ enabled: needsKiaRegistry });

  const provinces = useMemo(() => {
    if (!incidents) return [];
    return [...new Set(incidents.map((i) => i.province))].sort();
  }, [incidents]);

  const districts = useMemo(() => {
    if (!incidents) return [];
    const relevant = filters.province !== "all" ? incidents.filter((i) => i.province === filters.province) : incidents;
    return [...new Set(relevant.map((i) => normalizeDistrict(i.district)).filter(Boolean) as string[])].sort();
  }, [incidents, filters.province]);

  // Debounce search; defer filter object so typing/select changes stay snappy
  // while the heavy filtered-list memo runs in a lower-priority render.
  const debouncedSearch = useDebouncedValue(search, 180);
  const deferredFilters = useDeferredValue(filters);
  const deferredSearch = useDeferredValue(debouncedSearch);

  const filtered = useMemo(() => {
    if (!incidents) return [];
    const q = deferredSearch ? deferredSearch.toLowerCase() : "";
    return incidents.filter((i) => {
      if (deferredFilters.province !== "all" && i.province !== deferredFilters.province) return false;
      if (deferredFilters.district !== "all" && i.district !== deferredFilters.district) return false;
      if (deferredFilters.eventType !== "all" && i.event_type !== deferredFilters.eventType) return false;
      if (deferredFilters.dateFrom && i.date < deferredFilters.dateFrom) return false;
      if (deferredFilters.dateTo && i.date > deferredFilters.dateTo) return false;
      if (q) {
        if (
          !i.province?.toLowerCase().includes(q) &&
          !i.district?.toLowerCase().includes(q) &&
          !i.location_name?.toLowerCase().includes(q) &&
          !i.summary?.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [incidents, deferredFilters, deferredSearch]);

  const discrepancy = useMemo(() => {
    if (!isAdmin || !incidents || !kiaSoldiers) return null;
    const publishedIds = new Set(incidents.map((i) => i.id));
    // Only count official Security Forces on both sides. Pro-state irregulars
    // are tracked in kia_soldiers too but sit in `irregulars_killed` on the
    // incident, so mixing them into the comparison creates a fake mismatch.
    const regularKia = kiaSoldiers.filter((s) => !isIrregularForce(s.force_type));
    const mapTotal = incidents.reduce((s, i) => s + i.soldiers_killed, 0);
    const kiaTotal = regularKia.length;
    const delta = kiaTotal - mapTotal;
    if (delta === 0) return null;
    const missing = regularKia.filter((s) => !s.incident_id || !publishedIds.has(s.incident_id));
    return { mapTotal, kiaTotal, delta, missing };
  }, [isAdmin, incidents, kiaSoldiers]);

  const selectedIncident = useMemo(
    () => (selectedId ? filtered.find((i) => i.id === selectedId) || null : null),
    [selectedId, filtered]
  );

  const handleSelect = useCallback((id: string) => {
    setHighlightedId(id);
  }, []);

  const handleShowDetails = useCallback((id: string) => {
    setHighlightedId(id);
    setSelectedId(id);
  }, []);

  const handleEdit = useCallback(
    (id: string) => {
      const inc = incidents?.find((i) => i.id === id);
      if (inc) setEditingIncident(inc as unknown as Incident);
    },
    [incidents]
  );


  const handleEditIncident = useCallback((inc: Incident) => setEditingIncident(inc), []);
  const handleManageKia = useCallback((inc: Incident) => setKiaIncident(inc), []);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-3 lg:p-4 min-h-[calc(100vh-3.5rem)]">
        <Skeleton className="h-16 w-full" />
        <div className="flex gap-3 h-[calc(100vh-3.5rem-96px)] min-h-[480px]">
          <Skeleton className="hidden md:block h-full w-[260px] shrink-0" />
          <Skeleton className="flex-1 h-full" />
          <Skeleton className="hidden xl:block h-full w-[340px] shrink-0" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col min-h-[calc(100vh-3.5rem)] bg-background">
      <SEO
        title="Pakistan Casualty Intelligence Live Map"
        description="Live OSINT map of Pakistani security force casualties (KIA/WIA) and insurgency incidents across Pakistan, with filters and analytics."
        path="/"
      />
      <h1 className="sr-only">Pakistan Casualty Intelligence Live Map</h1>


      {/* Top stats strip */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-4 lg:px-6 py-3 border-b border-border/60"
      >
        <StatsBar
          incidents={filtered}
          compact
          filters={{
            dateFrom: deferredFilters.dateFrom,
            dateTo: deferredFilters.dateTo,
            province: deferredFilters.province,
            district: deferredFilters.district,
            eventType: deferredFilters.eventType,
            search: deferredSearch,
          }}
        />
      </motion.div>

      {/* Discrepancy banner */}
      {discrepancy && (
        <div className="mx-4 lg:mx-6 mt-3 rounded-lg glass border-warning/40 p-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div className="space-y-1 font-mono text-[11px]">
              <p>
                <span className="font-bold text-warning uppercase tracking-wider">KIA discrepancy:</span> map total{" "}
                <span className="text-foreground font-bold">{discrepancy.mapTotal}</span> · registry{" "}
                <span className="text-foreground font-bold">{discrepancy.kiaTotal}</span> · Δ{" "}
                <span className="text-danger font-bold">{discrepancy.delta}</span>
              </p>
              {discrepancy.missing.length > 0 && (
                <div className="text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5">
                  {discrepancy.missing.slice(0, 6).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => navigate(`/kia?search=${encodeURIComponent(s.name)}`)}
                      className="underline text-primary hover:text-primary-glow"
                    >
                      {s.name}
                    </button>
                  ))}
                  {discrepancy.missing.length > 6 && <span>+{discrepancy.missing.length - 6} more</span>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main 3-column tactical layout */}
      <div className="flex h-[calc(100vh-3.5rem-104px)] min-h-[520px] gap-3 p-3 lg:p-4">
        {/* LEFT — Filters sidebar */}
        <motion.aside
          initial={false}
          animate={{ width: filterOpen ? 260 : 48 }}
          transition={{ duration: 0.25 }}
          className="hidden md:flex flex-col rounded-xl glass overflow-hidden shrink-0"
        >
          {filterOpen ? (
            <>
              <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
                  <h3 className="font-mono text-[11px] uppercase tracking-[0.2em]">Filters</h3>
                </div>
                <Button variant="ghost" size="icon" aria-label="Collapse filters" className="h-6 w-6" onClick={() => setFilterOpen(false)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-tactical p-3 space-y-3">
                <FilterField label="Search">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Region, summary…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8 h-8 text-xs font-mono"
                    />
                  </div>
                </FilterField>

                <FilterField label="Province">
                  <Select
                    value={filters.province}
                    onValueChange={(v) => setFilters((f) => ({ ...f, province: v, district: "all" }))}
                  >
                    <SelectTrigger className="h-8 text-xs font-mono"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Provinces</SelectItem>
                      {provinces.filter((p) => p?.trim()).map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterField>

                <FilterField label="District">
                  <Select value={filters.district} onValueChange={(v) => setFilters((f) => ({ ...f, district: v }))}>
                    <SelectTrigger className="h-8 text-xs font-mono"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Districts</SelectItem>
                      {districts.filter((d) => d?.trim()).map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterField>

                <FilterField label="Event Type">
                  <Select value={filters.eventType} onValueChange={(v) => setFilters((f) => ({ ...f, eventType: v }))}>
                    <SelectTrigger className="h-8 text-xs font-mono"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {Constants.public.Enums.event_type.filter((et) => et !== "raid").map((et) => (
                        <SelectItem key={et} value={et}>{EVENT_TYPE_LABELS[et as EventType]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterField>

                <FilterField label="From">
                  <CalendarDateField
                    value={filters.dateFrom}
                    onChange={(v) => setFilters((f) => ({ ...f, dateFrom: v }))}
                    placeholder="Start date"
                  />
                </FilterField>
                <FilterField label="To">
                  <CalendarDateField
                    value={filters.dateTo}
                    onChange={(v) => setFilters((f) => ({ ...f, dateTo: v }))}
                    placeholder="End date"
                  />
                </FilterField>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-8 gap-1.5 font-mono text-[11px] uppercase tracking-wider"
                  onClick={() => {
                    setFilters({ province: "all", eventType: "all", district: "all", dateFrom: "", dateTo: "" });
                    setSearch("");
                  }}
                >
                  <RotateCcw className="h-3 w-3" /> Clear filters
                </Button>
              </div>
            </>
          ) : (
            <Button variant="ghost" aria-label="Expand filters" className="h-12 w-12 rounded-none" onClick={() => setFilterOpen(true)}>
              <SlidersHorizontal className="h-4 w-4 text-primary" />
            </Button>
          )}
        </motion.aside>

        {/* CENTER — Incident Map */}
        <div className="relative flex-1 min-w-0 rounded-xl glass overflow-hidden">
          <div className="absolute inset-0 bg-grid bg-grid-fade pointer-events-none opacity-40 z-[1]" />
          <Suspense fallback={<LazyFallback />}>
            <IncidentMap
              incidents={filtered}
              highlightedId={highlightedId}
              onMarkerClick={handleSelect}
            />
          </Suspense>
          <div className="absolute top-3 right-3 z-[1000] flex items-center gap-2 px-2.5 py-1 rounded-md glass-strong">
            <Layers className="h-3 w-3 text-primary" />
            <span className="font-mono text-[10px] uppercase tracking-wider">
              <span className="text-foreground font-bold">{filtered.length}</span> <span className="text-muted-foreground">events</span>
            </span>
          </div>
        </div>


        {/* RIGHT — Live feed */}
        <aside className="hidden xl:flex flex-col w-[340px] rounded-xl glass overflow-hidden shrink-0">
          <LiveIncidentFeed
            incidents={filtered}
            activeId={highlightedId}
            onSelect={handleSelect}
            onShowDetails={handleShowDetails}
            onEdit={isAdmin ? handleEdit : undefined}
          />
        </aside>
      </div>

      {/* Unified logs section — Incident / Militant / Security Force */}
      <div className="p-3 lg:p-4 space-y-3 border-t border-border/60">
        <div className="flex items-center gap-1 p-1 rounded-md glass w-fit">
          {([
            { k: "incidents", label: "Incident Log", icon: ShieldAlert },
            { k: "security", label: "Security Force / Irregulars KIA", icon: Shield },
            { k: "militant", label: "Militant Casualty Log", icon: Skull },
          ] as const).map((v) => (
            <button
              key={v.k}
              onClick={() => setLogView(v.k)}
              className={`px-3 py-1.5 rounded text-[11px] font-mono uppercase tracking-wider transition-colors inline-flex items-center gap-1.5 ${
                logView === v.k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <v.icon className="h-3 w-3" />
              {v.label}
            </button>
          ))}
        </div>
        {logView === "incidents" && (
          <LiveIncidentTable
            incidents={filtered as any}
            isAdmin={isAdmin}
            onEdit={isAdmin ? handleEditIncident : undefined}
            onManageKia={isAdmin ? handleManageKia : undefined}
          />
        )}
        {logView === "militant" && <Suspense fallback={<LazyFallback />}><MilitantRegistry /></Suspense>}
        {logView === "security" && <Suspense fallback={<LazyFallback />}><KiaTracker embed /></Suspense>}
      </div>




      {/* Intelligence slide-out panel */}
      <IntelPanel
        incident={selectedIncident}
        onClose={() => setSelectedId(null)}
        onEdit={isAdmin ? handleEdit : undefined}
      />

      {/* Admin quick-edit dialog */}
      {isAdmin && (
        <QuickIncidentEditDialog
          incident={editingIncident}
          onOpenChange={(open) => !open && setEditingIncident(null)}
        />
      )}

      {/* Admin KIA / casualty manager */}
      {isAdmin && (
        <IncidentKiaDialog
          incident={kiaIncident}
          onOpenChange={(open) => !open && setKiaIncident(null)}
        />
      )}
    </div>
  );
}

function CasualtyLogTable({ soldiers }: { soldiers: any[] }) {
  if (soldiers.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground font-mono text-sm rounded-lg border border-border">
        No casualty records.
      </div>
    );
  }
  const sorted = [...soldiers].sort((a, b) => (b.date_of_death || "").localeCompare(a.date_of_death || ""));
  return (
    <div className="rounded-lg border border-border overflow-auto">
      <table className="w-full text-xs">
        <thead className="bg-secondary/40">
          <tr className="border-b border-border">
            <th className="font-mono text-[10px] uppercase tracking-wider text-left p-2">Date</th>
            <th className="font-mono text-[10px] uppercase tracking-wider text-left p-2">Name</th>
            <th className="font-mono text-[10px] uppercase tracking-wider text-left p-2">Rank</th>
            <th className="font-mono text-[10px] uppercase tracking-wider text-left p-2">Force</th>
            <th className="font-mono text-[10px] uppercase tracking-wider text-left p-2">Hometown</th>
            <th className="font-mono text-[10px] uppercase tracking-wider text-left p-2">Location of Death</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s) => (
            <tr key={s.id} className="border-b border-border/60 hover:bg-secondary/20">
              <td className="font-mono p-2 whitespace-nowrap">{s.date_of_death || "—"}</td>
              <td className="p-2 font-medium">
                <Link to={`/kia?search=${encodeURIComponent(s.name || "")}`} className="text-primary hover:underline">
                  {s.name || "—"}
                </Link>
              </td>
              <td className="p-2">{s.rank || "—"}</td>
              <td className="p-2">{s.force_type || "—"}</td>
              <td className="p-2">{[s.hometown_district, s.hometown_province].filter(Boolean).join(", ") || "—"}</td>
              <td className="p-2">{[s.casualty_district, s.casualty_province].filter(Boolean).join(", ") || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

/** Calendar-popover date field; value is a YYYY-MM-DD string ("" = unset). */
function CalendarDateField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const selected = parseIncidentDate(value) ?? undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full h-8 justify-start text-left font-mono text-xs font-normal",
            !selected && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
          {selected ? format(selected, "dd MMM yyyy") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => onChange(d ? format(d, "yyyy-MM-dd") : "")}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}



