import { useState, useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { EVENT_TYPE_LABELS } from "@/lib/types";
import { Constants } from "@/integrations/supabase/types";
import type { EventType, SourceType, ConfidenceLevel, Incident } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Sparkles, Check, Plus, Trash2, Skull, ChevronDown, ChevronUp, ArrowLeft, LogOut, Pencil, Search, UserX } from "lucide-react";
import LocationPicker from "@/components/LocationPicker";
import LiveIncidentTable from "@/components/LiveIncidentTable";
import QuickIncidentEditDialog from "@/components/admin/QuickIncidentEditDialog";
import { INCIDENT_DETAIL_COLUMNS } from "@/lib/selectors";
import { format } from "date-fns";
import {
  useMilitantCasualties,
  useUpsertMilitantCasualty,
  useDeleteMilitantCasualty,
  MILITANT_AFFILIATIONS,
  getMilitantAffiliationColor,
  type MilitantCasualty,
} from "@/hooks/useMilitantCasualties";
import { Badge } from "@/components/ui/badge";
import { useCreateKiaSoldier } from "@/hooks/useKiaSoldiers";

const FORCE_TYPES = ["Army", "Air Force", "ASF", "Police/CTD", "FC", "Rangers", "Coast Guards", "Pro-State Militia"] as const;

interface KiaEntry {
  name: string;
  rank: string;
  force_type: string;
  unit: string;
  date_of_death: string;
  casualty_district: string;
  casualty_province: string;
  casualty_country: string;
  casualty_tehsil: string;
  media_acknowledged: boolean;
  source_url: string;
  notes: string;
}

function guessForceType(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("peace committee") || t.includes("aman committee") || t.includes("razakar") || t.includes("pro-state militia")) return "Pro-State Militia";
  if (t.includes("police") || t.includes("ctd") || t.includes("constab")) return "Police/CTD";
  if (t.includes("coast guard")) return "Coast Guards";
  if (t.includes("ranger")) return "Rangers";
  if (t.includes("air force") || t.includes("paf") || t.includes("pilot") || t.includes("squadron") || t.includes("airman")) return "Air Force";
  if (t.includes("fc ") || t.includes("frontier corps")) return "FC";
  return "Army";
}


interface ExtractedData {
  date: string;
  country: string;
  province: string;
  district: string;
  location_name: string;
  event_type: EventType;
  soldiers_killed: number;
  soldiers_injured: number;
  others_killed: number;
  others_injured: number;
  summary: string;
  source_type: SourceType;
  source_url: string;
  confidence: ConfidenceLevel;
}

interface MilitantEntry {
  name: string;
  alias: string;
  affiliation: string;
  rank_role: string;
  date_of_death: string;
  province: string;
  district: string;
  location_name: string;
  source_url: string;
  notes: string;
}

const emptyData: ExtractedData = {
  date: new Date().toISOString().split("T")[0],
  country: "Pakistan",
  province: "",
  district: "",
  location_name: "",
  event_type: "armed_clash",
  soldiers_killed: 0,
  soldiers_injured: 0,
  others_killed: 0,
  others_injured: 0,
  summary: "",
  source_type: "news_article",
  source_url: "",
  confidence: "medium",
};

function makeEmptyMilitant(incident: ExtractedData): MilitantEntry {
  return {
    name: "",
    alias: "",
    affiliation: "TTP",
    rank_role: "",
    date_of_death: incident.date,
    province: incident.province || "",
    district: incident.district || "",
    location_name: incident.location_name || "",
    source_url: incident.source_url || "",
    notes: "",
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}


function makeEmptyKia(incident: ExtractedData): KiaEntry {
  return {
    name: "",
    rank: "",
    force_type: guessForceType(`${incident.summary} ${incident.event_type}`),
    unit: "",
    date_of_death: incident.date,
    casualty_district: incident.district || "",
    casualty_province: incident.province || "",
    casualty_country: incident.country || "Pakistan",
    casualty_tehsil: incident.location_name || "",
    media_acknowledged: true,
    source_url: incident.source_url || "",
    notes: "",
  };
}

export default function AdminMilitantCasualties() {
  const { user, isAdmin, isMilitantAdmin, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: rows, isLoading } = useMilitantCasualties();
  const upsert = useUpsertMilitantCasualty();
  const del = useDeleteMilitantCasualty();
  const createKia = useCreateKiaSoldier();

  // Entry flow state (mirrors Admin.tsx)
  const [textBlocks, setTextBlocks] = useState<string[]>([""]);
  const [extracting, setExtracting] = useState(false);
  const [extractionDone, setExtractionDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extractedList, setExtractedList] = useState<ExtractedData[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mPerIncident, setMPerIncident] = useState<MilitantEntry[][]>([]);
  const [mExpanded, setMExpanded] = useState(true);
  const [kiaPerIncident, setKiaPerIncident] = useState<KiaEntry[][]>([]);
  const [kiaExpanded, setKiaExpanded] = useState(true);


  // Edit existing record dialog state
  const [editing, setEditing] = useState<Partial<MilitantCasualty> | null>(null);
  const [search, setSearch] = useState("");

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin && !isMilitantAdmin) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <p className="font-mono text-sm text-muted-foreground">Access denied.</p>
      </div>
    );
  }

  const addTextBlock = () => setTextBlocks([...textBlocks, ""]);
  const removeTextBlock = (idx: number) => textBlocks.length > 1 && setTextBlocks(textBlocks.filter((_, i) => i !== idx));
  const updateTextBlock = (idx: number, val: string) => {
    const updated = [...textBlocks];
    updated[idx] = val;
    setTextBlocks(updated);
  };

  const handleExtract = async () => {
    const nonEmpty = textBlocks.filter((t) => t.trim());
    if (nonEmpty.length === 0) return;
    setExtracting(true);
    setExtractionDone(false);
    try {
      const responses = await Promise.allSettled(
        nonEmpty.map((text) => supabase.functions.invoke("extract-incident", { body: { text } }))
      );
      const results: ExtractedData[] = [];
      const errors: string[] = [];
      for (const res of responses) {
        if (res.status === "rejected") {
          console.error("extract-incident rejected", res.reason);
          errors.push(String(res.reason?.message ?? res.reason));
          continue;
        }
        const { data, error } = res.value as any;
        if (error) {
          console.error("extract-incident error", error, data);
          errors.push(error.message || (data?.error ?? "Unknown edge function error"));
          continue;
        }
        if (!data?.incident) {
          console.error("extract-incident no incident in response", data);
          errors.push(data?.error || "No incident returned");
          continue;
        }
        const inc = data.incident;
        if (inc.date) {
          const year = parseInt(inc.date.split("-")[0], 10);
          if (year < 2026) inc.date = "2026" + inc.date.substring(4);
        }
        results.push(inc);
      }
      if (results.length === 0) {
        throw new Error(errors[0] || "No incidents could be extracted");
      }
      setExtractedList(results);
      setActiveIndex(0);
      // Build militant entries: prefer named militants from AI; otherwise N "Unknown" entries based on others_killed
      setMPerIncident(results.map((r) => {
        const named = Array.isArray((r as any).militants) ? (r as any).militants : [];
        const entries: MilitantEntry[] = [];
        for (const m of named) {
          const base = makeEmptyMilitant(r);
          entries.push({
            ...base,
            name: (m.name || "").trim(),
            alias: (m.alias || "").trim(),
            affiliation: (m.affiliation || "").trim() || "TTP",
            rank_role: (m.rank_role || "").trim(),
          });
        }
        const target = Math.max(entries.length, r.others_killed || 0, 1);
        while (entries.length < target) entries.push(makeEmptyMilitant(r));
        return entries;
      }));
      setMExpanded(true);
      setExtractionDone(true);
      toast({ title: "Extraction complete", description: `${results.length} of ${nonEmpty.length} incidents extracted.` });
    } catch (err: any) {
      toast({ title: "Extraction failed", description: err.message, variant: "destructive" });
    } finally {
      setExtracting(false);
    }
  };

  const sanitizeForInsert = (ex: ExtractedData) => ({
    date: ex.date,
    country: ex.country || "Pakistan",
    province: ex.province,
    district: ex.district || null,
    location_name: ex.location_name || null,
    event_type: ex.event_type,
    soldiers_killed: ex.soldiers_killed || 0,
    soldiers_injured: ex.soldiers_injured || 0,
    others_killed: ex.others_killed || 0,
    others_injured: ex.others_injured || 0,
    summary: ex.summary,
    source_type: ex.source_type,
    source_url: ex.source_url || null,
    confidence: ex.confidence,
    published: true,
    verification_status: "verified" as const,
    created_by: user!.id,
  });

  const saveMilitants = async (incidentId: string, entries: MilitantEntry[]) => {
    for (const e of entries) {
      const name = e.name.trim() || (e.alias.trim() ? "" : "Unknown");
      await upsert.mutateAsync({
        incident_id: incidentId,
        name: name || null,
        alias: e.alias.trim() || null,
        affiliation: e.affiliation || null,
        rank_role: e.rank_role || null,
        date_of_death: e.date_of_death || null,
        province: e.province || null,
        district: e.district || null,
        location_name: e.location_name || null,
        source_url: e.source_url || null,
        notes: e.notes || null,
        confirmed: true,

        created_by: user!.id,
      } as any);
    }
  };

  const handlePublishSingle = async (idx: number) => {
    setSaving(true);
    try {
      const ex = extractedList[idx];
      const { data, error } = await (supabase as any).from("incidents").insert(sanitizeForInsert(ex)).select().single();
      if (error) throw error;
      await saveMilitants(data.id, mPerIncident[idx] || []);
      toast({ title: "Published", description: "Incident + militant casualties saved." });
      const updated = extractedList.filter((_, i) => i !== idx);
      const updatedM = mPerIncident.filter((_, i) => i !== idx);
      setExtractedList(updated);
      setMPerIncident(updatedM);
      if (activeIndex >= updated.length) setActiveIndex(Math.max(0, updated.length - 1));
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      queryClient.invalidateQueries({ queryKey: ["militant_casualties"] });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePublishAll = async () => {
    if (extractedList.length === 0) return;
    setSaving(true);
    try {
      const rowsToInsert = extractedList.map(sanitizeForInsert);
      const { data, error } = await (supabase as any).from("incidents").insert(rowsToInsert).select();
      if (error) throw error;
      if (data) {
        for (let i = 0; i < data.length; i++) {
          await saveMilitants(data[i].id, mPerIncident[i] || []);
        }
      }
      toast({ title: "Published", description: `${rowsToInsert.length} incident(s) saved.` });
      setExtractedList([]);
      setMPerIncident([]);
      setTextBlocks([""]);
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      queryClient.invalidateQueries({ queryKey: ["militant_casualties"] });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key: keyof ExtractedData, value: any) => {
    const updated = [...extractedList];
    updated[activeIndex] = { ...updated[activeIndex], [key]: value };
    setExtractedList(updated);
    // Propagate location/date/source to militant entries
    if (["province", "district", "location_name", "date", "source_url"].includes(key)) {
      const inc = updated[activeIndex];
      const entries = mPerIncident[activeIndex] || [];
      if (entries.length > 0) {
        const map: Record<string, keyof MilitantEntry> = {
          province: "province",
          district: "district",
          location_name: "location_name",
          date: "date_of_death",
          source_url: "source_url",
        };
        const mKey = map[key];
        if (mKey) {
          const nextM = [...mPerIncident];
          nextM[activeIndex] = entries.map((e) => ({ ...e, [mKey]: value || "" }));
          setMPerIncident(nextM);
        }
        // Keep inc reference used (lint)
        void inc;
      }
    }
  };

  const removeExtracted = (idx: number) => {
    const updated = extractedList.filter((_, i) => i !== idx);
    const updatedM = mPerIncident.filter((_, i) => i !== idx);
    setExtractedList(updated);
    setMPerIncident(updatedM);
    if (activeIndex >= updated.length) setActiveIndex(Math.max(0, updated.length - 1));
  };

  const updateMField = (entryIdx: number, key: keyof MilitantEntry, value: any) => {
    setMPerIncident((prev) => {
      const next = [...prev];
      const entries = [...(next[activeIndex] || [])];
      entries[entryIdx] = { ...entries[entryIdx], [key]: value };
      next[activeIndex] = entries;
      return next;
    });
  };
  const updateMFields = (entryIdx: number, updates: Partial<MilitantEntry>) => {
    setMPerIncident((prev) => {
      const next = [...prev];
      const entries = [...(next[activeIndex] || [])];
      entries[entryIdx] = { ...entries[entryIdx], ...updates };
      next[activeIndex] = entries;
      return next;
    });
  };
  const addMEntry = () => {
    const inc = extractedList[activeIndex] || emptyData;
    const next = [...mPerIncident];
    next[activeIndex] = [...(next[activeIndex] || []), makeEmptyMilitant(inc)];
    setMPerIncident(next);
  };
  const removeMEntry = (entryIdx: number) => {
    const next = [...mPerIncident];
    next[activeIndex] = (next[activeIndex] || []).filter((_, i) => i !== entryIdx);
    setMPerIncident(next);
  };

  const extracted = extractedList[activeIndex] || null;
  const currentM = mPerIncident[activeIndex] || [];

  const filteredRows = (rows ?? []).filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [r.name, r.alias, r.affiliation, r.district, r.province, r.location_name]
      .filter(Boolean)
      .some((v) => (v as string).toLowerCase().includes(q));
  });

  const handleEditSave = async () => {
    if (!editing) return;
    if (!editing.name?.trim() && !editing.alias?.trim()) {
      toast({ title: "Provide a name or alias", variant: "destructive" });
      return;
    }
    try {
      await upsert.mutateAsync({ ...editing, created_by: editing.created_by ?? user!.id } as any);
      toast({ title: "Updated" });
      setEditing(null);
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link to="/admin" className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3 w-3" /> Admin
              </Link>
            )}
            <h1 className="font-mono text-lg font-semibold tracking-wider">MILITANT INCIDENT EXTRACTION</h1>
          </div>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            Paste articles/tweets, extract as incidents, then add militant casualties inline. Saves to the public incident log + militant casualty registry.
          </p>
        </div>
        {isMilitantAdmin && !isAdmin && (
          <Button variant="outline" size="sm" onClick={signOut} className="gap-2 font-mono text-xs">
            <LogOut className="h-3.5 w-3.5" /> Sign Out
          </Button>
        )}
      </div>

      {/* Input Area */}
      <div className="space-y-3">
        {textBlocks.map((block, idx) => (
          <div key={idx} className="relative">
            <Textarea
              value={block}
              onChange={(e) => updateTextBlock(idx, e.target.value)}
              placeholder={`Paste text #${idx + 1}...`}
              className="min-h-[100px] font-mono text-sm bg-card border-border pr-10"
            />
            {textBlocks.length > 1 && (
              <Button variant="ghost" size="sm" onClick={() => removeTextBlock(idx)} className="absolute top-1 right-1 h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={addTextBlock} className="gap-1.5 font-mono text-xs">
            <Plus className="h-3.5 w-3.5" /> Add Another Text
          </Button>
          <Button onClick={handleExtract} disabled={extracting || textBlocks.every((t) => !t.trim())} className="gap-2 font-mono text-xs">
            {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : extractionDone ? <Check className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            {extracting ? "EXTRACTING..." : extractionDone ? "EXTRACTION COMPLETE ✓" : `EXTRACT ALL (${textBlocks.filter((t) => t.trim()).length})`}
          </Button>
        </div>
      </div>

      {/* Extracted Data */}
      {extractedList.length > 0 && (
        <div className="space-y-4 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-sm font-semibold tracking-wider text-primary">
              REVIEW EXTRACTED DATA ({extractedList.length} incidents)
            </h2>
            <Button onClick={handlePublishAll} disabled={saving} className="gap-2 font-mono text-xs">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              PUBLISH ALL
            </Button>
          </div>

          <div className="flex gap-1 flex-wrap">
            {extractedList.map((ex, idx) => (
              <div key={idx} className="flex items-center">
                <Button
                  variant={idx === activeIndex ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveIndex(idx)}
                  className="font-mono text-[10px] h-7 rounded-r-none"
                >
                  #{idx + 1} {ex.district || ex.province || "Unknown"}
                </Button>
                <Button
                  variant={idx === activeIndex ? "default" : "outline"}
                  size="sm"
                  onClick={() => removeExtracted(idx)}
                  className="h-7 w-6 p-0 rounded-l-none border-l-0"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>

          {extracted && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Field label="Date">
                  <Input type="date" value={extracted.date} min="2026-01-01" onChange={(e) => updateField("date", e.target.value)} className="h-8 text-xs font-mono bg-secondary border-border" />
                </Field>
                <div className="col-span-1 sm:col-span-2 lg:col-span-3">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Location</p>
                  <LocationPicker
                    country={extracted.country}
                    province={extracted.province}
                    district={extracted.district}
                    tehsil={extracted.location_name}
                    onCountryChange={(v) => updateField("country", v)}
                    onProvinceChange={(v) => updateField("province", v)}
                    onDistrictChange={(v) => updateField("district", v)}
                    onTehsilChange={(v) => updateField("location_name", v)}
                    showCountry
                    showTehsil
                    size="sm"
                  />
                </div>
                <Field label="Event Type">
                  <Select value={extracted.event_type} onValueChange={(v) => updateField("event_type", v)}>
                    <SelectTrigger className="h-8 text-xs font-mono bg-secondary border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Constants.public.Enums.event_type.filter((et) => et !== "raid").map((et) => (
                        <SelectItem key={et} value={et}>{EVENT_TYPE_LABELS[et as EventType]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Forces KIA">
                  <Input type="number" min={0} value={extracted.soldiers_killed} onChange={(e) => updateField("soldiers_killed", parseInt(e.target.value) || 0)} className="h-8 text-xs font-mono bg-secondary border-border" />
                </Field>
                <Field label="Forces WIA">
                  <Input type="number" min={0} value={extracted.soldiers_injured} onChange={(e) => updateField("soldiers_injured", parseInt(e.target.value) || 0)} className="h-8 text-xs font-mono bg-secondary border-border" />
                </Field>
                <Field label="Militants KIA">
                  <Input type="number" min={0} value={extracted.others_killed} onChange={(e) => updateField("others_killed", parseInt(e.target.value) || 0)} className="h-8 text-xs font-mono bg-secondary border-border" />
                </Field>
                <Field label="Militants WIA">
                  <Input type="number" min={0} value={extracted.others_injured} onChange={(e) => updateField("others_injured", parseInt(e.target.value) || 0)} className="h-8 text-xs font-mono bg-secondary border-border" />
                </Field>
                <Field label="Source Type">
                  <Select value={extracted.source_type} onValueChange={(v) => updateField("source_type", v)}>
                    <SelectTrigger className="h-8 text-xs font-mono bg-secondary border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Constants.public.Enums.source_type.map((st) => (
                        <SelectItem key={st} value={st}>{st.replace(/_/g, " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

              </div>

              <Field label="Source URL">
                <Input value={extracted.source_url} onChange={(e) => updateField("source_url", e.target.value)} className="h-8 text-xs font-mono bg-secondary border-border" placeholder="https://..." />
              </Field>

              <Field label="Summary">
                <Textarea value={extracted.summary} onChange={(e) => updateField("summary", e.target.value)} className="min-h-[80px] text-xs font-mono bg-secondary border-border" />
              </Field>

              {/* Inline militant casualty entries */}
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-3">
                <button onClick={() => setMExpanded(!mExpanded)} className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <Skull className="h-4 w-4 text-destructive" />
                    <span className="font-mono text-xs font-semibold tracking-wider text-destructive">
                      MILITANT CASUALTIES ({currentM.length})
                    </span>
                  </div>
                  {mExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>

                {mExpanded && (
                  <div className="space-y-3">
                    {currentM.map((entry, idx) => (
                      <div key={idx} className="rounded border border-border bg-card p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="font-mono text-xs font-semibold text-muted-foreground">MILITANT #{idx + 1}</p>
                          <Button variant="ghost" size="sm" onClick={() => removeMEntry(idx)} className="h-6 w-6 p-0 text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                          <Field label="Name">
                            <Input value={entry.name} onChange={(e) => updateMField(idx, "name", e.target.value)} className="h-7 text-xs font-mono bg-secondary border-border" placeholder="If unknown, leave blank" />
                          </Field>
                          <Field label="Alias / Kunya">
                            <Input value={entry.alias} onChange={(e) => updateMField(idx, "alias", e.target.value)} className="h-7 text-xs font-mono bg-secondary border-border" />
                          </Field>
                          <Field label="Affiliation">
                            <Select value={entry.affiliation} onValueChange={(v) => updateMField(idx, "affiliation", v)}>
                              <SelectTrigger className="h-7 text-xs font-mono bg-secondary border-border"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {MILITANT_AFFILIATIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </Field>
                          <Field label="Rank / Role">
                            <Input value={entry.rank_role} onChange={(e) => updateMField(idx, "rank_role", e.target.value)} className="h-7 text-xs font-mono bg-secondary border-border" placeholder="e.g. Commander" />
                          </Field>
                          <Field label="Date of Death">
                            <Input type="date" value={entry.date_of_death} min="2026-01-01" onChange={(e) => updateMField(idx, "date_of_death", e.target.value)} className="h-7 text-xs font-mono bg-secondary border-border" />
                          </Field>
                          <div className="col-span-2 lg:col-span-3">
                            <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Killed Location</Label>
                            <LocationPicker
                              province={entry.province}
                              district={entry.district}
                              tehsil={entry.location_name}
                              onProvinceChange={(v) => updateMFields(idx, { province: v, district: "", location_name: "" })}
                              onDistrictChange={(v) => updateMFields(idx, { district: v, location_name: "" })}
                              onTehsilChange={(v) => updateMField(idx, "location_name", v)}
                              showTehsil
                              size="sm"
                            />
                          </div>

                        </div>
                        <Field label="Source URL">
                          <Input value={entry.source_url} onChange={(e) => updateMField(idx, "source_url", e.target.value)} className="h-7 text-xs font-mono bg-secondary border-border" placeholder="https://..." />
                        </Field>
                        <Field label="Notes">
                          <Textarea value={entry.notes} onChange={(e) => updateMField(idx, "notes", e.target.value)} className="min-h-[60px] text-xs font-mono bg-secondary border-border" />
                        </Field>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addMEntry} className="gap-1.5 font-mono text-xs">
                      <Plus className="h-3.5 w-3.5" /> Add Another Militant
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button onClick={() => handlePublishSingle(activeIndex)} disabled={saving} className="gap-2 font-mono text-xs">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  PUBLISH THIS ONE
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* My Incidents */}
      <MyIncidentsSection userId={user!.id} isAdmin={isAdmin} />

      {/* Existing records */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="font-mono text-sm font-semibold tracking-wider">EXISTING RECORDS</h2>
          <div className="relative max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-8 h-8 text-xs" />
          </div>
        </div>
        <Card>
          {isLoading ? (
            <p className="p-4 font-mono text-sm text-muted-foreground">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name / Alias</TableHead>
                  <TableHead>Affiliation</TableHead>
                  <TableHead>Rank</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{r.name || "—"}</div>
                      {r.alias && <div className="text-xs text-muted-foreground">aka {r.alias}</div>}
                    </TableCell>
                    <TableCell className="text-sm"><Badge variant="outline" className={`font-mono text-[10px] ${getMilitantAffiliationColor(r.affiliation)}`}>{r.affiliation || "—"}</Badge></TableCell>
                    <TableCell className="text-sm">{r.rank_role || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.date_of_death ? format(new Date(r.date_of_death + "T00:00:00"), "yyyy-MM-dd") : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {[r.location_name, r.district, r.province].filter(Boolean).join(", ") || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={async () => {
                          if (!confirm("Delete this record?")) return;
                          try { await del.mutateAsync(r.id); toast({ title: "Deleted" }); }
                          catch (e: any) { toast({ title: "Delete failed", description: e.message, variant: "destructive" }); }
                        }}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredRows.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No records.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      {/* Edit dialog (simple) */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Militant Casualty</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Alias</Label>
                  <Input value={editing.alias ?? ""} onChange={(e) => setEditing({ ...editing, alias: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Affiliation</Label>
                  <Select value={editing.affiliation ?? ""} onValueChange={(v) => setEditing({ ...editing, affiliation: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {MILITANT_AFFILIATIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Rank / Role</Label>
                  <Input value={editing.rank_role ?? ""} onChange={(e) => setEditing({ ...editing, rank_role: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Date of Death</Label>
                  <Input type="date" value={editing.date_of_death ?? ""} onChange={(e) => setEditing({ ...editing, date_of_death: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Province</Label>
                  <Input value={editing.province ?? ""} onChange={(e) => setEditing({ ...editing, province: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">District</Label>
                  <Input value={editing.district ?? ""} onChange={(e) => setEditing({ ...editing, district: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Location</Label>
                  <Input value={editing.location_name ?? ""} onChange={(e) => setEditing({ ...editing, location_name: e.target.value })} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Source URL</Label>
                <Input value={editing.source_url ?? ""} onChange={(e) => setEditing({ ...editing, source_url: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Notes</Label>
                <Textarea value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} rows={3} />
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={editing.confirmed ?? true} onCheckedChange={(v) => setEditing({ ...editing, confirmed: v })} />
                  Confirmed
                </label>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                  <Button onClick={handleEditSave} disabled={upsert.isPending}>Save</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MyIncidentsSection({ userId, isAdmin = false }: { userId: string; isAdmin?: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Incident | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["incidents", "with-militants"],
    queryFn: async (): Promise<Incident[]> => {
      // Get distinct incident_ids that have at least one militant casualty
      const { data: links, error: linkErr } = await (supabase as any)
        .from("militant_casualties")
        .select("incident_id")
        .not("incident_id", "is", null);
      if (linkErr) throw linkErr;
      const ids = Array.from(new Set(((links ?? []) as any[]).map((r) => r.incident_id).filter(Boolean)));
      if (ids.length === 0) return [];
      const { data, error } = await (supabase as any)
        .from("incidents")
        .select(INCIDENT_DETAIL_COLUMNS)
        .in("id", ids)
        .order("date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Incident[];
    },
    staleTime: 10_000,
  });

  // Realtime: refresh when militant_casualties change
  useEffect(() => {
    const channel = supabase
      .channel(`militant-incidents`)
      .on("postgres_changes", { event: "*", schema: "public", table: "militant_casualties" },
        () => queryClient.invalidateQueries({ queryKey: ["incidents", "with-militants"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents" },
        () => queryClient.invalidateQueries({ queryKey: ["incidents", "with-militants"] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const handleDelete = async (inc: Incident) => {
    setDeletingId(inc.id);
    try {
      await (supabase as any).from("militant_casualties").delete().eq("incident_id", inc.id);
      const { error } = await (supabase as any).from("incidents").delete().eq("id", inc.id);
      if (error) throw error;
      toast({ title: "Deleted", description: "Incident removed." });
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      queryClient.invalidateQueries({ queryKey: ["militant_casualties"] });
      queryClient.invalidateQueries({ queryKey: ["incidents", "with-militants"] });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-mono text-sm font-semibold tracking-wider">INCIDENTS WITH MILITANT CASUALTIES ({rows.length})</h2>
      </div>
      {isLoading ? (
        <Card><p className="p-4 font-mono text-sm text-muted-foreground">Loading…</p></Card>
      ) : rows.length === 0 ? (
        <Card><p className="p-4 font-mono text-sm text-muted-foreground">No incidents with militant casualties yet.</p></Card>
      ) : (
        <LiveIncidentTable
          incidents={rows}
          isAdmin={isAdmin}
          onEdit={(inc) => setEditing(inc)}
          onDelete={(inc) => handleDelete(inc)}
        />
      )}
      {deletingId && (
        <p className="font-mono text-[10px] text-muted-foreground flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Deleting…
        </p>
      )}
      <QuickIncidentEditDialog incident={editing} onOpenChange={(o) => !o && setEditing(null)} />
    </div>
  );
}


