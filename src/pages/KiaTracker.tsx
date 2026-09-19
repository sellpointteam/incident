import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { parseDateLocal } from "@/lib/utils";
import { useKiaSoldiers, useCreateKiaSoldier, useUpdateKiaSoldier, useDeleteKiaSoldier, type KiaSoldier } from "@/hooks/useKiaSoldiers";
import { useIncidents } from "@/hooks/useIncidents";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Loader2, Plus, Pencil, Trash2, Search, UserX, CheckCircle, XCircle, ExternalLink, Sparkles, ImageIcon, X, MapPin, ArrowUp, ArrowDown, Filter, Clock, Shield, Skull } from "lucide-react";
import SEO from "@/components/SEO";
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import KiaHometownMap, { type KiaMapHandle } from "@/components/KiaHometownMap";
import MilitantRegistry from "@/components/MilitantRegistry";
import LocationPicker from "@/components/LocationPicker";
import AnimatedCounter from "@/components/AnimatedCounter";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const FORCE_TYPES = ["Army", "Air Force", "ASF", "Police/CTD", "FC", "Rangers", "Coast Guards", "Pro-State Militia"] as const;

const emptyKia: Omit<KiaSoldier, "id" | "created_at" | "updated_at"> = {
  incident_id: null,
  name: "",
  rank: "",
  unit: "",
  hometown_district: "",
  hometown_province: "",
  hometown_tehsil: "",
  hometown_latitude: null,
  hometown_longitude: null,
  casualty_district: "",
  casualty_province: "",
  casualty_country: "Pakistan",
  casualty_tehsil: "",
  date_of_death: new Date().toISOString().split("T")[0],
  media_acknowledged: false,
  notes: "",
  created_by: null,
  source_url: "",
  force_type: "Army",
};

type ExtractedSoldier = Omit<KiaSoldier, "id" | "created_at" | "updated_at" | "incident_id" | "created_by"> & { incident_id?: string | null; created_by?: string | null };

import { normalizeProvince, normalizeDistrict } from "@/lib/normalize";
import { isIrregularForce, IRREGULARS_TOOLTIP } from "@/lib/forces";

function formatLocation(district?: string | null, province?: string | null, tehsil?: string | null): string {
  const prov = normalizeProvince(province);
  const dist = normalizeDistrict(district);
  const teh = tehsil?.trim() || null;
  if (teh && dist && prov && prov !== "Unknown") return `${teh}, ${dist}, ${prov}`;
  if (dist && prov && prov !== "Unknown") return `${dist}, ${prov}`;
  if (prov && prov !== "Unknown") return prov;
  if (dist) return dist;
  return "—";
}

export default function KiaTracker({ embed = false }: { embed?: boolean } = {}) {
  const { user, isAdmin } = useAuth();
  const { data: soldiers, isLoading } = useKiaSoldiers();
  const { data: incidents } = useIncidents();
  const createSoldier = useCreateKiaSoldier();
  const updateSoldier = useUpdateKiaSoldier();
  const deleteSoldier = useDeleteKiaSoldier();
  const { toast } = useToast();
  const [editing, setEditing] = useState<(Partial<KiaSoldier> & { isNew?: boolean }) | null>(null);
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const debouncedSearch = useDebouncedValue(searchQuery, 200);
  const [filterAck, setFilterAck] = useState<string>("all");
  const [filterForces, setFilterForces] = useState<string[]>([]);
  const [filterIncidentId, setFilterIncidentId] = useState<string>("all");
  const [filterProvince, setFilterProvince] = useState<string>("all");
  const [filterDistrict, setFilterDistrict] = useState<string>("all");
  const [dateSort, setDateSort] = useState<"desc" | "asc">("desc");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);
  const [showMap, setShowMap] = useState(!embed);
  const [sortByAdded, setSortByAdded] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const kiaMapRef = useRef<KiaMapHandle>(null);
  const [mapStats, setMapStats] = useState<import("@/components/KiaHometownMap").KiaMapStats | null>(null);

  // Extraction state
  const [showExtract, setShowExtract] = useState(false);
  const [extractText, setExtractText] = useState("");
  const [extractImageUrl, setExtractImageUrl] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractedList, setExtractedList] = useState<ExtractedSoldier[]>([]);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);

  // Build incident options for filter (only incidents that have linked KIA soldiers)
  const incidentOptions = useMemo(() => {
    if (!incidents || !soldiers) return [];
    const incidentIds = new Set(soldiers.map((s) => s.incident_id).filter(Boolean));
    return incidents
      .filter((i) => incidentIds.has(i.id))
      .map((i) => ({
        id: i.id,
        label: `${i.date} — ${i.province}${i.district ? ', ' + i.district : ''} (${i.soldiers_killed} KIA)`,
      }))
      .sort((a, b) => b.label.localeCompare(a.label));
  }, [incidents, soldiers]);

  // Province/district options derived from soldier data (hometown location)
  const provinceOptions = useMemo(() => {
    if (!soldiers) return [];
    const set = new Set<string>();
    let hasUnknown = false;
    soldiers.forEach((s) => {
      const p = normalizeProvince(s.hometown_province);
      if (p === "Unknown") { hasUnknown = true; return; }
      if (p) set.add(p);
    });
    const sorted = [...set].sort();
    if (hasUnknown) sorted.push("Unknown");
    return sorted;
  }, [soldiers]);

  const districtOptions = useMemo(() => {
    if (!soldiers) return [];
    const set = new Set<string>();
    soldiers.forEach((s) => {
      if (filterProvince !== "all" && normalizeProvince(s.hometown_province) !== filterProvince) return;
      const d = normalizeDistrict(s.hometown_district);
      if (d) set.add(d);
    });
    return [...set].sort();
  }, [soldiers, filterProvince]);

  // Map incident_id -> incident.date so date filters bucket KIA the same way
  // the Incidents page does (by incident.date). Keeps monthly totals consistent.
  const incidentDateById = useMemo(() => {
    const m = new Map<string, string>();
    (incidents || []).forEach((i) => m.set(i.id, i.date));
    return m;
  }, [incidents]);

  const filtered = useMemo(() => {
    if (!soldiers) return [];
    return soldiers.filter((s) => {
      if (filterAck === "yes" && !s.media_acknowledged) return false;
      if (filterAck === "no" && s.media_acknowledged) return false;
      if (filterForces.length > 0 && !filterForces.includes(s.force_type)) return false;
      if (filterIncidentId !== "all" && s.incident_id !== filterIncidentId) return false;
      if (filterProvince !== "all" && normalizeProvince(s.hometown_province) !== filterProvince) return false;
      if (filterDistrict !== "all" && normalizeDistrict(s.hometown_district) !== filterDistrict) return false;
      const bucketDate = (s.incident_id && incidentDateById.get(s.incident_id)) || s.date_of_death;
      if (dateFrom && bucketDate < dateFrom) return false;
      if (dateTo && bucketDate > dateTo) return false;
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          (s.rank?.toLowerCase().includes(q)) ||
          (s.unit?.toLowerCase().includes(q)) ||
          (s.hometown_district?.toLowerCase().includes(q)) ||
          (s.hometown_province?.toLowerCase().includes(q)) ||
          (s.hometown_tehsil?.toLowerCase().includes(q)) ||
          (s.casualty_district?.toLowerCase().includes(q)) ||
          (s.casualty_province?.toLowerCase().includes(q)) ||
          (s.casualty_tehsil?.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [soldiers, debouncedSearch, filterAck, filterForces, filterIncidentId, filterProvince, filterDistrict, dateFrom, dateTo, incidentDateById]);


  const sortedFiltered = useMemo(() => {
    if (sortByAdded) {
      return [...filtered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return [...filtered].sort((a, b) => {
      const dateDiff = new Date(a.date_of_death).getTime() - new Date(b.date_of_death).getTime();
      if (dateDiff !== 0) return dateSort === "asc" ? dateDiff : -dateDiff;
      const createdDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return createdDiff;
    });
  }, [filtered, dateSort, sortByAdded]);

  const totalKia = soldiers?.length || 0;
  const irregularKia = soldiers?.filter((s) => isIrregularForce(s.force_type)).length || 0;
  const regularKia = totalKia - irregularKia;
  const acknowledged = soldiers?.filter((s) => s.media_acknowledged).length || 0;

  const handleRowClick = useCallback((soldier: KiaSoldier) => {
    if (!showMap) setShowMap(true);
    const district = soldier.hometown_district || "";
    const province = soldier.hometown_province || "";
    const tehsil = soldier.hometown_tehsil || "";
    if (!district && !province) return;
    mapContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => {
      kiaMapRef.current?.highlightHometown(district, province, tehsil, soldier.id);
    }, 400);
  }, [showMap]);

  const handleSave = async () => {
    if (!editing) return;
    try {
      if (editing.isNew) {
        const { isNew, id, created_at, updated_at, ...rest } = editing as any;
        // Normalize unknown hometown
        const normProv = normalizeProvince(rest.hometown_province);
        if (normProv === "Unknown") { rest.hometown_province = null; rest.hometown_district = null; rest.hometown_tehsil = null; }
        await createSoldier.mutateAsync({ ...rest, created_by: user?.id || null });
      } else {
        const { isNew, ...rest } = editing as any;
        const normProv = normalizeProvince(rest.hometown_province);
        if (normProv === "Unknown") { rest.hometown_province = null; rest.hometown_district = null; rest.hometown_tehsil = null; }
        await updateSoldier.mutateAsync(rest);
      }
      toast({ title: editing.isNew ? "Added" : "Updated", description: "KIA record saved." });
      setEditing(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSoldier.mutateAsync(id);
      toast({ title: "Deleted", description: "KIA record removed." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const updateField = (key: string, value: any) => {
    setEditing((prev) => {
      if (!prev) return prev;
      // When selecting an incident, auto-fill casualty location from incident
      if (key === "incident_id" && value && incidents) {
        const inc = incidents.find((i) => i.id === value);
        if (inc) {
          return {
            ...prev,
            incident_id: value,
            casualty_province: prev.casualty_province || inc.province || "",
            casualty_district: prev.casualty_district || inc.district || "",
            casualty_country: prev.casualty_country || inc.country || "Pakistan",
            casualty_tehsil: prev.casualty_tehsil || inc.location_name || "",
            date_of_death: prev.date_of_death || inc.date,
          };
        }
      }
      // When hometown province is set to Unknown or cleared, clear district/tehsil
      if (key === "hometown_province") {
        const normVal = normalizeProvince(value);
        if (!value || normVal === "Unknown") {
          return { ...prev, hometown_province: "Unknown", hometown_district: "", hometown_tehsil: "" };
        }
      }
      return { ...prev, [key]: value };
    });
  };

  // Extraction handlers
  const handleExtract = async () => {
    if (!extractText && !extractImageUrl) {
      toast({ title: "Nothing to extract", description: "Paste text, a tweet, or an image URL.", variant: "destructive" });
      return;
    }
    setExtracting(true);
    setExtractedList([]);
    try {
      const { data, error } = await supabase.functions.invoke("extract-kia", {
        body: { text: extractText || undefined, image_url: extractImageUrl || undefined },
      });
      if (error) throw error;
      if (data?.soldiers && data.soldiers.length > 0) {
        setExtractedList(data.soldiers);
        toast({ title: "Extracted", description: `Found ${data.soldiers.length} soldier(s).` });
      } else {
        toast({ title: "No results", description: "Could not extract any KIA info from the input.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Extraction failed", description: err.message, variant: "destructive" });
    } finally {
      setExtracting(false);
    }
  };

  const handleSaveExtracted = async (idx: number) => {
    const s = extractedList[idx];
    setSavingIdx(idx);
    try {
      await createSoldier.mutateAsync({
        name: s.name,
        rank: s.rank || null,
        unit: s.unit || null,
        force_type: s.force_type || "Army",
        date_of_death: s.date_of_death,
        casualty_district: s.casualty_district || "",
        casualty_province: s.casualty_province,
        casualty_country: s.casualty_country || "Pakistan",
        hometown_district: s.hometown_district || null,
        hometown_province: s.hometown_province || null,
        hometown_tehsil: s.hometown_tehsil || null,
        hometown_latitude: null,
        hometown_longitude: null,
        casualty_tehsil: s.casualty_tehsil || null,
        media_acknowledged: s.media_acknowledged ?? false,
        source_url: s.source_url || null,
        notes: s.notes || null,
        incident_id: null,
        created_by: user?.id || null,
      });
      toast({ title: "Saved", description: `${s.name} added to KIA records.` });
      setExtractedList((prev) => prev.filter((_, i) => i !== idx));
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingIdx(null);
    }
  };

  const handleSaveAllExtracted = async () => {
    for (let i = extractedList.length - 1; i >= 0; i--) {
      await handleSaveExtracted(i);
    }
  };

  const updateExtractedField = (idx: number, key: string, value: any) => {
    setExtractedList((prev) => prev.map((s, i) => (i === idx ? { ...s, [key]: value } : s)));
  };

  return (
    <div className={embed ? "space-y-4" : "p-4 lg:p-6 space-y-4 max-w-7xl mx-auto"}>
      {!embed && (
        <SEO
          title="KIA Registry — Pakistani Casualty Tracker"
          description="Registry of Pakistani security personnel killed in action, with hometown, force branch, and incident details."
          path="/kia"
          jsonLd={{ "@context": "https://schema.org", "@type": "CollectionPage", name: "KIA Registry", url: "https://example.invalid/kia" }}
        />
      )}
      <Tabs defaultValue="security" className="space-y-4">
        {!embed && (
          <TabsList className="font-mono">
            <TabsTrigger value="security" className="gap-1.5 text-xs"><Shield className="h-3.5 w-3.5" /> Security Force / Pro-State</TabsTrigger>
            <TabsTrigger value="militant" className="gap-1.5 text-xs"><Skull className="h-3.5 w-3.5" /> Militant Casualties</TabsTrigger>
          </TabsList>
        )}
        {!embed && (
          <TabsContent value="militant" className="m-0">
            <MilitantRegistry />
          </TabsContent>
        )}
        <TabsContent value="security" className="m-0 space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl glass p-4 flex items-center gap-3 hover:border-primary/40 transition-all">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-danger/10 text-danger">
            <UserX className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Security Force KIA</p>
            <AnimatedCounter value={regularKia} className="font-display text-3xl font-bold text-danger leading-none" />
            <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70 mt-1">Army · Air Force · FC · Police · CTD</p>
          </div>
        </div>
        <div
          className="rounded-xl glass p-4 flex items-center gap-3 hover:border-primary/40 transition-all"
          title={IRREGULARS_TOOLTIP}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-orange-500/10 text-orange-400">
            <UserX className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Pro-State Irregulars</p>
            <AnimatedCounter value={irregularKia} className="font-display text-3xl font-bold text-orange-400 leading-none" />
            <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70 mt-1">Pro-State Militia</p>
          </div>
        </div>
        <div className="rounded-xl glass p-4 flex items-center gap-3 hover:border-primary/40 transition-all">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-success/10 text-success">
            <CheckCircle className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Media Coverage</p>
            <AnimatedCounter value={acknowledged} className="font-display text-3xl font-bold text-success leading-none" />
          </div>
        </div>
        <div className="rounded-xl glass p-4 flex items-center gap-3 hover:border-primary/40 transition-all">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-warning/10 text-warning">
            <XCircle className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">No Coverage</p>
            <AnimatedCounter value={totalKia - acknowledged} className="font-display text-3xl font-bold text-warning leading-none" />
          </div>
        </div>
      </div>

      <p className="font-mono text-[10px] text-muted-foreground/80 leading-relaxed -mt-1">
        <span className="text-orange-400">●</span> Pro-State Irregulars (Pro-State Militia) support state operations but are <span className="text-foreground">not</span> official government forces. They are tracked separately from Security Force totals.
      </p>

      {/* Header + Filters */}
      <div className="relative z-20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="font-mono text-lg font-semibold tracking-wider">KIA SOLDIERS TRACKER <span className="text-sm text-muted-foreground font-normal">({filtered.length} entries)</span></h1>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <Button
              variant={sortByAdded ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs font-mono gap-1"
              onClick={() => setSortByAdded((v) => !v)}
            >
              <Clock className="h-3 w-3" />
              Recently Added
            </Button>
          )}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search name/rank/area..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 h-8 w-56 text-xs font-mono bg-card border-border" />
          </div>
          <Select value={filterAck} onValueChange={setFilterAck}>
            <SelectTrigger className="h-8 w-44 text-xs font-mono bg-card border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Coverage</SelectItem>
              <SelectItem value="yes">Media Covered</SelectItem>
              <SelectItem value="no">Hidden / Unreported</SelectItem>
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs font-mono bg-card border-border gap-1">
                <Filter className="h-3 w-3" />
                {filterForces.length === 0 ? "All Forces" : filterForces.join(", ")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              {FORCE_TYPES.map((ft) => (
                <DropdownMenuCheckboxItem
                  key={ft}
                  checked={filterForces.includes(ft)}
                  onCheckedChange={(checked) => {
                    setFilterForces((prev) =>
                      checked ? [...prev, ft] : prev.filter((f) => f !== ft)
                    );
                  }}
                  className="font-mono text-xs"
                >
                  {ft}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Select value={filterProvince} onValueChange={(v) => { setFilterProvince(v); setFilterDistrict("all"); }}>
            <SelectTrigger className="h-8 w-44 text-xs font-mono bg-card border-border"><SelectValue placeholder="All Provinces" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Provinces</SelectItem>
              {provinceOptions.map((p) => (
                <SelectItem key={p} value={p} className="text-xs font-mono">{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterDistrict} onValueChange={setFilterDistrict}>
            <SelectTrigger className="h-8 w-44 text-xs font-mono bg-card border-border"><SelectValue placeholder="All Districts" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Districts</SelectItem>
              {districtOptions.map((d) => (
                <SelectItem key={d} value={d} className="text-xs font-mono">{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterIncidentId} onValueChange={setFilterIncidentId}>
            <SelectTrigger className="h-8 w-56 text-xs font-mono bg-card border-border"><SelectValue placeholder="All Incidents" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Incidents</SelectItem>
              {incidentOptions.map((opt) => (
                <SelectItem key={opt.id} value={opt.id} className="text-xs font-mono">{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 w-36 text-xs font-mono bg-card border-border" placeholder="From" title="From date" />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 w-36 text-xs font-mono bg-card border-border" placeholder="To" title="To date" />
          {!embed && (
            <Button size="sm" variant={showMap ? "default" : "outline"} onClick={() => setShowMap(!showMap)} className="gap-1.5 font-mono text-xs">
              <MapPin className="h-3.5 w-3.5" /> Hometown Map
            </Button>
          )}
          {/* AI Extract / Add KIA buttons moved to Admin panel — edit existing rows via the pencil icon. */}
        </div>
      </div>

      {/* KIA Hometown Map */}
      {!embed && showMap && soldiers && soldiers.length > 0 && (
        <div className="relative z-0 rounded-lg border border-border overflow-hidden" ref={mapContainerRef}>
          <div className="p-2 bg-card border-b border-border flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <MapPin className="h-3 w-3 inline mr-1" /> KIA SOLDIERS — HOMETOWN ORIGINS
              {sortedFiltered.length !== totalKia && (
                <span className="ml-2 text-warning font-bold">
                  (showing {sortedFiltered.length} of {totalKia} — {totalKia - sortedFiltered.length} filtered out by date/search)
                </span>
              )}
            </p>
          </div>
          <KiaHometownMap ref={kiaMapRef} soldiers={sortedFiltered} onMapStats={setMapStats} />
          {isAdmin && mapStats && mapStats.unmappedGroups.length > 0 && (
            <div className="p-3 bg-destructive/10 border-t border-destructive/30">
              <p className="font-mono text-xs font-bold text-destructive mb-2">
                ⚠ {mapStats.totalSoldiers - mapStats.mappedSoldiers} KIA not mapped — coordinate resolution failed:
              </p>
              <div className="space-y-1">
                {mapStats.unmappedGroups.map((g, i) => (
                  <div key={i} className="font-mono text-[11px] text-foreground/80">
                    <span className="font-semibold">{g.count}×</span>{" "}
                    {g.district || "—"}, {g.province || "—"}
                    {g.tehsil ? ` (${g.tehsil})` : ""}
                    {" — "}<span className="text-destructive">{g.reason}</span>
                    <span className="text-muted-foreground ml-1">[{g.names.join(", ")}]</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Extraction Panel */}
      {isAdmin && showExtract && (
        <div className="rounded-lg border border-primary/30 bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-sm font-semibold tracking-wider flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> AI KIA EXTRACTION
            </h2>
            <Button variant="ghost" size="sm" onClick={() => { setShowExtract(false); setExtractedList([]); setExtractText(""); setExtractImageUrl(""); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground font-mono">Paste a tweet, news text, report, or image URL — AI will extract soldier KIA details.</p>
          <Textarea
            value={extractText}
            onChange={(e) => setExtractText(e.target.value)}
            placeholder="Paste tweet, news article text, or casualty report here..."
            className="min-h-[80px] text-xs font-mono bg-secondary border-border"
          />
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
            <Input
              value={extractImageUrl}
              onChange={(e) => setExtractImageUrl(e.target.value)}
              placeholder="Image URL (screenshot of tweet, casualty list, etc.)"
              className="h-8 text-xs font-mono bg-secondary border-border"
            />
          </div>
          <Button onClick={handleExtract} disabled={extracting} className="gap-2 font-mono text-xs">
            {extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {extracting ? "Extracting..." : "Extract KIA Info"}
          </Button>

          {/* Extracted results */}
          {extractedList.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <p className="font-mono text-xs text-muted-foreground">{extractedList.length} soldier(s) extracted — review & save:</p>
                <Button size="sm" onClick={handleSaveAllExtracted} className="gap-1.5 font-mono text-xs">
                  <Plus className="h-3.5 w-3.5" /> Save All
                </Button>
              </div>
              {extractedList.map((s, idx) => (
                <div key={idx} className="rounded border border-border bg-secondary/50 p-3 space-y-2">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    <Field label="Name">
                      <Input value={s.name || ""} onChange={(e) => updateExtractedField(idx, "name", e.target.value)} className="h-7 text-xs font-mono bg-card border-border" />
                    </Field>
                    <Field label="Rank">
                      <Input value={s.rank || ""} onChange={(e) => updateExtractedField(idx, "rank", e.target.value)} className="h-7 text-xs font-mono bg-card border-border" />
                    </Field>
                    <Field label="Force">
                      <Select value={s.force_type || "Army"} onValueChange={(v) => updateExtractedField(idx, "force_type", v)}>
                        <SelectTrigger className="h-7 text-xs font-mono bg-card border-border"><SelectValue /></SelectTrigger>
                        <SelectContent>{FORCE_TYPES.map((ft) => <SelectItem key={ft} value={ft}>{ft}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                    <Field label="Date of Death">
                      <Input type="date" value={s.date_of_death || ""} onChange={(e) => updateExtractedField(idx, "date_of_death", e.target.value)} className="h-7 text-xs font-mono bg-card border-border" />
                    </Field>
                    <Field label="Casualty District">
                      <Input value={s.casualty_district || ""} onChange={(e) => updateExtractedField(idx, "casualty_district", e.target.value)} className="h-7 text-xs font-mono bg-card border-border" />
                    </Field>
                    <Field label="Casualty Province">
                      <Input value={s.casualty_province || ""} onChange={(e) => updateExtractedField(idx, "casualty_province", e.target.value)} className="h-7 text-xs font-mono bg-card border-border" />
                    </Field>
                    <Field label="Hometown District">
                      <Input value={s.hometown_district || ""} onChange={(e) => updateExtractedField(idx, "hometown_district", e.target.value)} className="h-7 text-xs font-mono bg-card border-border" />
                    </Field>
                    <Field label="Hometown Province">
                      <Input value={s.hometown_province || ""} onChange={(e) => updateExtractedField(idx, "hometown_province", e.target.value)} className="h-7 text-xs font-mono bg-card border-border" />
                    </Field>
                    <Field label="Hometown Tehsil">
                      <Input value={s.hometown_tehsil || ""} onChange={(e) => updateExtractedField(idx, "hometown_tehsil", e.target.value)} className="h-7 text-xs font-mono bg-card border-border" placeholder="Optional" />
                    </Field>
                    <Field label="Casualty Tehsil">
                      <Input value={s.casualty_tehsil || ""} onChange={(e) => updateExtractedField(idx, "casualty_tehsil", e.target.value)} className="h-7 text-xs font-mono bg-card border-border" placeholder="Optional" />
                    </Field>
                    <Field label="Source URL">
                      <Input value={s.source_url || ""} onChange={(e) => updateExtractedField(idx, "source_url", e.target.value)} className="h-7 text-xs font-mono bg-card border-border" placeholder="https://..." />
                    </Field>
                    <Field label="Media Ack.">
                      <div className="flex items-center h-7 gap-2">
                        <Checkbox checked={s.media_acknowledged || false} onCheckedChange={(v) => updateExtractedField(idx, "media_acknowledged", !!v)} />
                        <span className="font-mono text-xs">{s.media_acknowledged ? "Yes" : "No"}</span>
                      </div>
                    </Field>
                  </div>
                  {s.notes && <p className="text-xs text-muted-foreground font-mono">{s.notes}</p>}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleSaveExtracted(idx)} disabled={savingIdx === idx} className="gap-1.5 font-mono text-xs">
                      {savingIdx === idx ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setExtractedList((prev) => prev.filter((_, i) => i !== idx))} className="font-mono text-xs text-destructive">
                      Discard
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground font-mono text-sm">No KIA records found.</div>
      ) : (
        <div className="rounded-lg border border-border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="font-mono text-[10px] uppercase tracking-wider">Name</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider">Rank</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider">Force</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider cursor-pointer select-none" onClick={() => setDateSort(d => d === "desc" ? "asc" : "desc")}>
                  <span className="inline-flex items-center gap-1">Date {dateSort === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}</span>
                </TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider">Casualty Location</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider">Hometown</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider text-center">Media Coverage</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider text-center">Source</TableHead>
                {isAdmin && <TableHead className="font-mono text-[10px] uppercase tracking-wider text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedFiltered.map((s) => (
                <TableRow
                  key={s.id}
                  className="border-border cursor-pointer transition-colors hover:bg-muted/50"
                  onClick={() => handleRowClick(s)}
                >
                  <TableCell className="font-mono text-xs font-semibold">{s.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s.rank || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`font-mono text-[10px] ${s.force_type === "FC" ? "border-red-500 text-red-500" : s.force_type === "Police/CTD" ? "border-blue-500 text-blue-500" : s.force_type === "Army" ? "border-green-500 text-green-500" : s.force_type === "Air Force" ? "border-sky-500 text-sky-500" : s.force_type === "ASF" ? "border-amber-500 text-amber-500" : s.force_type === "Rangers" ? "border-yellow-500 text-yellow-500" : s.force_type === "Coast Guards" ? "border-cyan-500 text-cyan-500" : s.force_type === "Pro-State Militia" ? "border-orange-500 text-orange-500" : ""}`}>{s.force_type || "Army"}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs whitespace-nowrap">{format(parseDateLocal(s.date_of_death), "dd MMM yy")}</TableCell>
                  <TableCell className="text-xs">{formatLocation(s.casualty_district, s.casualty_province, s.casualty_tehsil)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatLocation(s.hometown_district, s.hometown_province, s.hometown_tehsil)}</TableCell>
                  <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                    {isAdmin ? (
                      <div className="flex items-center justify-center gap-2">
                        <Checkbox
                          checked={!!s.media_acknowledged}
                          onCheckedChange={async (v) => {
                            try {
                              await updateSoldier.mutateAsync({ id: s.id, media_acknowledged: !!v } as any);
                            } catch (err: any) {
                              toast({ title: "Error", description: err.message, variant: "destructive" });
                            }
                          }}
                        />
                        <span className="font-mono text-[10px] text-muted-foreground">{s.media_acknowledged ? "Covered" : "Hidden"}</span>
                      </div>
                    ) : (
                      <Badge variant={s.media_acknowledged ? "default" : "secondary"} className="font-mono text-[10px]">
                        {s.media_acknowledged ? "Covered" : "Hidden"}
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell className="text-center">
                    {s.source_url ? (
                      <a href={s.source_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                        <ExternalLink className="h-3.5 w-3.5 inline" />
                      </a>
                    ) : "—"}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" onClick={() => setEditing({ ...s })}><Pencil className="h-3.5 w-3.5" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete KIA record?</AlertDialogTitle>
                              <AlertDialogDescription>This will permanently remove the record for {s.name}.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(s.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono tracking-wider">{editing?.isNew ? "ADD" : "EDIT"} KIA RECORD</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <Field label="Linked Incident">
                  <Select value={editing.incident_id || "__none__"} onValueChange={(v) => updateField("incident_id", v === "__none__" ? null : v)}>
                    <SelectTrigger className="h-8 text-xs font-mono bg-secondary border-border"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {incidents?.map((inc) => (
                        <SelectItem key={inc.id} value={inc.id} className="text-xs font-mono">
                          {inc.date} — {inc.province}{inc.district ? ', ' + inc.district : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <Field label="Name *">
                  <Input value={editing.name || ""} onChange={(e) => updateField("name", e.target.value)} className="h-8 text-xs font-mono bg-secondary border-border" />
                </Field>
                <Field label="Rank">
                  <Input value={editing.rank || ""} onChange={(e) => updateField("rank", e.target.value)} className="h-8 text-xs font-mono bg-secondary border-border" />
                </Field>
                <Field label="Force Type *">
                  <Select value={editing.force_type || "Army"} onValueChange={(v) => updateField("force_type", v)}>
                    <SelectTrigger className="h-8 text-xs font-mono bg-secondary border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FORCE_TYPES.map((ft) => (
                        <SelectItem key={ft} value={ft}>{ft}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Unit">
                  <Input value={editing.unit || ""} onChange={(e) => updateField("unit", e.target.value)} className="h-8 text-xs font-mono bg-secondary border-border" />
                </Field>
                <Field label="Date of Death *">
                  <Input type="date" value={editing.date_of_death || ""} onChange={(e) => updateField("date_of_death", e.target.value)} className="h-8 text-xs font-mono bg-secondary border-border" />
                </Field>
              </div>
              <div className="space-y-1">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Casualty Location</p>
                <LocationPicker
                  country={editing.casualty_country || "Pakistan"}
                  province={editing.casualty_province || ""}
                  district={editing.casualty_district || ""}
                  tehsil={editing.casualty_tehsil || ""}
                  onCountryChange={(v) => updateField("casualty_country", v)}
                  onProvinceChange={(v) => updateField("casualty_province", v)}
                  onDistrictChange={(v) => updateField("casualty_district", v)}
                  onTehsilChange={(v) => updateField("casualty_tehsil", v)}
                  showCountry
                  size="md"
                />
              </div>
              <div className="space-y-1">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Hometown Location</p>
                <LocationPicker
                  province={editing.hometown_province || ""}
                  district={editing.hometown_district || ""}
                  tehsil={editing.hometown_tehsil || ""}
                  onProvinceChange={(v) => updateField("hometown_province", v)}
                  onDistrictChange={(v) => updateField("hometown_district", v)}
                  onTehsilChange={(v) => updateField("hometown_tehsil", v)}
                  size="md"
                />
              </div>
              <Field label="Source URL">
                <Input value={editing.source_url || ""} onChange={(e) => updateField("source_url", e.target.value)} className="h-8 text-xs font-mono bg-secondary border-border" placeholder="https://..." />
              </Field>
              <div className="flex items-center gap-2">
                <Checkbox checked={editing.media_acknowledged || false} onCheckedChange={(v) => updateField("media_acknowledged", !!v)} />
                <Label className="font-mono text-xs">Media acknowledged by Pakistani media</Label>
              </div>
              <Field label="Notes">
                <Textarea value={editing.notes || ""} onChange={(e) => updateField("notes", e.target.value)} className="min-h-[60px] text-xs font-mono bg-secondary border-border" />
              </Field>
              <div className="flex gap-3 pt-2">
                <Button variant="secondary" onClick={() => setEditing(null)} className="font-mono text-xs">Cancel</Button>
                <Button onClick={handleSave} disabled={createSoldier.isPending || updateSoldier.isPending} className="gap-2 font-mono text-xs">
                  {(createSoldier.isPending || updateSoldier.isPending) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {editing.isNew ? "Add Record" : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
