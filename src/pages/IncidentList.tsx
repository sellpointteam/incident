import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { useIncidents } from "@/hooks/useIncidents";
import { useKiaSoldiers } from "@/hooks/useKiaSoldiers";
import { useAuth } from "@/hooks/useAuth";
import { normalizeDistrict } from "@/lib/normalize";
import IncidentFilters from "@/components/IncidentFilters";
import LiveIncidentTable from "@/components/LiveIncidentTable";
import StatsBar from "@/components/StatsBar";
import { Loader2, Crosshair, SlidersHorizontal, Activity, Search, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import SEO from "@/components/SEO";
import QuickIncidentEditDialog from "@/components/admin/QuickIncidentEditDialog";
import { useDeleteIncident } from "@/hooks/useAdminIncidents";
import { useToast } from "@/hooks/use-toast";
import IncidentKiaDialog from "@/components/IncidentKiaDialog";
import { EVENT_TYPE_LABELS } from "@/lib/types";
import type { Incident } from "@/lib/types";

function csvEscape(v: any): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCSV(filename: string, rows: (string | number | null)[][]) {
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function IncidentList() {
  const { data: incidents, isLoading } = useIncidents();
  const { data: allKia } = useKiaSoldiers();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const deleteIncident = useDeleteIncident();
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);
  const [kiaIncident, setKiaIncident] = useState<Incident | null>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    province: "all",
    eventType: "all",
    district: "all",
    dateFrom: "2026-01-01",
    dateTo: new Date().toISOString().split("T")[0],
  });

  const provinces = useMemo(() => {
    if (!incidents) return [];
    return [...new Set(incidents.map((i) => i.province))].sort();
  }, [incidents]);

  const districts = useMemo(() => {
    if (!incidents) return [];
    const relevant = filters.province !== "all"
      ? incidents.filter((i) => i.province === filters.province)
      : incidents;
    return [...new Set(relevant.map((i) => normalizeDistrict(i.district)).filter(Boolean) as string[])].sort();
  }, [incidents, filters.province]);

  const filtered = useMemo(() => {
    if (!incidents) return [];
    const q = search.trim().toLowerCase();
    return incidents.filter((i) => {
      if (filters.province !== "all" && i.province !== filters.province) return false;
      if (filters.district !== "all" && normalizeDistrict(i.district) !== filters.district) return false;
      if (filters.eventType !== "all" && i.event_type !== filters.eventType) return false;
      if (filters.dateFrom && i.date < filters.dateFrom) return false;
      if (filters.dateTo && i.date > filters.dateTo) return false;
      if (q) {
        const hay = `${i.summary} ${i.province} ${i.district || ""} ${i.location_name || ""} ${EVENT_TYPE_LABELS[i.event_type]}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [incidents, filters, search]);

  const getKiaCount = useCallback((incidentId: string) => (allKia || []).filter((k) => k.incident_id === incidentId).length, [allKia]);

  const handleDownload = useCallback(() => {
    const header = [
      "incident_id", "date", "country", "province", "district", "location_name",
      "event_type", "soldiers_killed", "soldiers_injured", "others_killed", "others_injured",
      "confidence", "verification_status", "summary", "source_url",
      "kia_name", "kia_rank", "kia_unit", "kia_force", "kia_date_of_death",
      "kia_hometown_district", "kia_hometown_province", "kia_hometown_tehsil",
      "kia_casualty_district", "kia_casualty_province", "kia_casualty_tehsil",
      "kia_media_coverage", "kia_source_url",
    ];
    const rows: (string | number | null)[][] = [header];
    for (const i of filtered) {
      const kiaRows = (allKia || []).filter((k) => k.incident_id === i.id);
      const base = [
        i.id, i.date, i.country, i.province, i.district, i.location_name,
        EVENT_TYPE_LABELS[i.event_type], i.soldiers_killed, i.soldiers_injured,
        i.others_killed, i.others_injured, i.confidence, i.verification_status,
        i.summary, i.source_url,
      ];
      if (kiaRows.length === 0) {
        rows.push([...base, "", "", "", "", "", "", "", "", "", "", "", "", ""]);
      } else {
        for (const k of kiaRows) {
          rows.push([
            ...base,
            k.name, k.rank, k.unit, k.force_type, k.date_of_death,
            k.hometown_district, k.hometown_province, k.hometown_tehsil,
            k.casualty_district, k.casualty_province, k.casualty_tehsil,
            k.media_acknowledged ? "Covered" : "Hidden", k.source_url,
          ]);
        }
      }
    }
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCSV(`incidents-${stamp}.csv`, rows);
  }, [filtered, allKia]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-7xl mx-auto">
      <SEO
        title="Incident Registry — Pakistani Casualty Tracker"
        description="Searchable registry of insurgency incidents in Pakistan with casualties, sources, and verification status."
        path="/incidents"
        jsonLd={{ "@context": "https://schema.org", "@type": "CollectionPage", name: "Incident Registry", url: "https://example.invalid/incidents" }}
      />
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-1">
          <Crosshair className="h-5 w-5 text-primary" />
          <h1 className="font-display text-2xl font-bold tracking-wider uppercase">Incident Registry</h1>
        </div>
        <p className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
          {filtered.length} of {incidents?.length || 0} incidents · Pakistan AOR
        </p>
      </motion.div>

      <StatsBar
        incidents={filtered}
        filters={{
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          province: filters.province,
          district: filters.district,
          eventType: filters.eventType,
          search,
        }}
      />

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl glass p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
            <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground">Filters &amp; Search</h3>
          </div>
          <Button size="sm" variant="outline" onClick={handleDownload} className="gap-1.5 font-mono text-[11px] h-8">
            <Download className="h-3.5 w-3.5" /> Export CSV ({filtered.length})
          </Button>
        </div>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search summary, location, type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs font-mono bg-secondary border-border"
            />
          </div>
          <IncidentFilters filters={filters} onChange={setFilters} provinces={provinces} districts={districts} />
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl glass p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-3.5 w-3.5 text-primary" />
          <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground">Live Feed</h3>
        </div>
        <LiveIncidentTable
          incidents={filtered as unknown as Incident[]}
          isAdmin={isAdmin}
          onEdit={isAdmin ? (inc) => setEditingIncident(inc) : undefined}
          onManageKia={(inc) => setKiaIncident(inc)}
          onDelete={isAdmin ? async (inc) => {
            try {
              await deleteIncident.mutateAsync({ id: inc.id });
              toast({ title: "Deleted", description: "Incident removed." });
            } catch (err: any) {
              toast({ title: "Error", description: err.message, variant: "destructive" });
            }
          } : undefined}
          getKiaCount={getKiaCount}
        />
      </motion.div>

      {isAdmin && (
        <QuickIncidentEditDialog
          incident={editingIncident}
          onOpenChange={(open) => !open && setEditingIncident(null)}
        />
      )}
      <IncidentKiaDialog
        incident={kiaIncident}
        onOpenChange={(open) => !open && setKiaIncident(null)}
      />
    </div>
  );
}
