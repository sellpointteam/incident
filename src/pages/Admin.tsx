import { memo, useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { EVENT_TYPE_LABELS } from "@/lib/types";
import { Constants } from "@/integrations/supabase/types";
import type { EventType, SourceType, ConfidenceLevel, Incident } from "@/lib/types";
import { Loader2, Save, Check, Plus, Trash2, UserX, ChevronDown, ChevronUp, Skull, ShieldAlert } from "lucide-react";
import { useCreateKiaSoldier } from "@/hooks/useKiaSoldiers";
import { useUpsertMilitantCasualty, MILITANT_AFFILIATIONS } from "@/hooks/useMilitantCasualties";
import { usePublishIncidentBundle } from "@/hooks/usePublishIncidentBundle";
import EconomicDamageFields from "@/components/admin/EconomicDamageFields";
import { cleanEconomicDamage, type EconomicDamage } from "@/lib/economicDamage";
import { invalidateAllCasualtyData } from "@/lib/casualtyInvalidation";
import LocationPicker from "@/components/LocationPicker";
import ActorPicker from "@/components/admin/ActorPicker";
import { suggestPerpetratorForLocation } from "@/hooks/useOperationalAreas";
import LiveIncidentTable from "@/components/LiveIncidentTable";
import QuickIncidentEditDialog from "@/components/admin/QuickIncidentEditDialog";
import BatchIncidentExtractor from "@/components/admin/BatchIncidentExtractor";

import AdminAttributionPanel from "@/components/admin/AdminAttributionPanel";
import { INCIDENT_DETAIL_COLUMNS } from "@/lib/selectors";
import { confirmDateChange, todayLocalISO } from "@/lib/dateGuard";


const FORCE_TYPES = ["Army", "Air Force", "ASF", "Police/CTD", "FC", "Rangers", "Levies", "Coast Guards"] as const;
const IRREGULAR_FORCE_TYPES = ["Pro-State Militia"] as const;

interface ExtractedData {
  date: string;
  country: string;
  province: string;
  district: string;
  location_name: string;
  event_type: EventType;
  soldiers_killed: number;
  soldiers_injured: number;
  irregulars_killed: number;
  irregulars_injured: number;
  others_killed: number;
  others_injured: number;
  summary: string;
  source_type: SourceType;
  source_url: string;
  confidence: ConfidenceLevel;
  perpetrator_actor_id: string | null;
  target_actor_id: string | null;
  economic_damage: EconomicDamage;
}

interface KiaEntry {
  name: string;
  rank: string;
  force_type: string;
  unit: string;
  date_of_death: string;
  casualty_district: string;
  casualty_province: string;
  casualty_country: string;
  hometown_district: string;
  hometown_province: string;
  hometown_tehsil: string;
  casualty_tehsil: string;
  media_acknowledged: boolean;
  source_url: string;
  notes: string;
}

const emptyData: ExtractedData = {
  date: todayLocalISO(),
  country: "Pakistan",
  province: "",
  district: "",
  location_name: "",
  event_type: "other",
  soldiers_killed: 0,
  soldiers_injured: 0,
  irregulars_killed: 0,
  irregulars_injured: 0,
  others_killed: 0,
  others_injured: 0,
  summary: "",
  source_type: "news_article",
  source_url: "",
  confidence: "medium",
  perpetrator_actor_id: null,
  target_actor_id: null,
  economic_damage: {},
};

function guessForceType(incident: ExtractedData): string {
  const text = `${incident.summary} ${incident.event_type}`.toLowerCase();
  if (text.includes("peace committee") || text.includes("peace commitee") || text.includes("aman committee") || text.includes("razakar") || text.includes("pro-state militia") || text.includes("amn lashkar")) return "Pro-State Militia";
  if (text.includes("police") || text.includes("ctd") || text.includes("constab")) return "Police/CTD";
  if (text.includes("coast guard")) return "Coast Guards";
  if (text.includes("ranger")) return "Rangers";
  if (text.includes("asf") || text.includes("airport security")) return "ASF";
  if (text.includes("air force") || text.includes("paf") || text.includes("pilot") || text.includes("squadron") || text.includes("airman")) return "Air Force";
  if (text.includes("fc") || text.includes("frontier corps")) return "FC";
  return "Army";
}

function makeEmptyKia(incident: ExtractedData): KiaEntry {
  return {
    name: "",
    rank: "",
    force_type: guessForceType(incident),
    unit: "",
    date_of_death: incident.date,
    casualty_district: incident.district || "",
    casualty_province: incident.province || "",
    casualty_country: incident.country || "Pakistan",
    hometown_district: "",
    hometown_province: "",
    hometown_tehsil: "",
    casualty_tehsil: "",
    media_acknowledged: true,
    source_url: incident.source_url || "",
    notes: "",
  };
}

/** Build KIA entries for an extracted incident based on soldiers_killed count
 *  and any named soldiers returned by the AI extractor. Excludes irregulars. */
function buildKiaEntries(incident: ExtractedData, named: any[] = []): KiaEntry[] {
  const count = incident.soldiers_killed || 0;
  const entries: KiaEntry[] = [];
  for (const s of named) {
    const base = makeEmptyKia(incident);
    const force = (s?.force_type || "").trim();
    // Skip irregulars — they have their own list
    if ((IRREGULAR_FORCE_TYPES as readonly string[]).includes(force)) continue;
    entries.push({
      ...base,
      name: (s?.name || "").trim(),
      rank: (s?.rank || "").trim(),
      unit: (s?.unit || "").trim(),
      force_type: force || (base.force_type === "Pro-State Militia" ? "Army" : base.force_type),
    });
  }
  const target = Math.max(entries.length, count);
  while (entries.length < target) {
    const e = makeEmptyKia(incident);
    if ((IRREGULAR_FORCE_TYPES as readonly string[]).includes(e.force_type)) e.force_type = "Army";
    entries.push(e);
  }
  return entries;
}

/** Build pro-state irregular KIA entries (peace committee, VDC, razakar, informants). */
function buildIrregularEntries(incident: ExtractedData, named: any[] = []): KiaEntry[] {
  const count = incident.irregulars_killed || 0;
  const entries: KiaEntry[] = [];
  for (const s of named) {
    const base = makeEmptyKia(incident);
    const force = (s?.force_type || "").trim();
    entries.push({
      ...base,
      name: (s?.name || "").trim(),
      rank: (s?.rank_role || s?.rank || "").trim(),
      unit: (s?.group || s?.unit || "").trim(),
      force_type: (IRREGULAR_FORCE_TYPES as readonly string[]).includes(force) ? force : "Pro-State Militia",
    });
  }
  const target = Math.max(entries.length, count);
  while (entries.length < target) {
    entries.push({ ...makeEmptyKia(incident), force_type: "Pro-State Militia" });
  }
  return entries;
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

function buildMilitantEntries(incident: ExtractedData, named: any[] = []): MilitantEntry[] {
  const entries: MilitantEntry[] = [];
  for (const m of named) {
    const base = makeEmptyMilitant(incident);
    entries.push({
      ...base,
      name: (m?.name || "").trim(),
      alias: (m?.alias || "").trim(),
      affiliation: (m?.affiliation || "").trim() || "TTP",
      rank_role: (m?.rank_role || "").trim(),
    });
  }
  const target = Math.max(entries.length, incident.others_killed || 0);
  while (entries.length < target) entries.push(makeEmptyMilitant(incident));
  return entries;
}

export default function Admin() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createKia = useCreateKiaSoldier();
  const upsertMilitant = useUpsertMilitantCasualty();
  const publishBundle = usePublishIncidentBundle();

  const [extractionDone, setExtractionDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extractedList, setExtractedList] = useState<ExtractedData[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [inputResetSignal, setInputResetSignal] = useState(0);

  /**
   * Stable idempotency key per staged incident. Generated once at extraction
   * time; retained across publish retries so a network timeout or a
   * double-click cannot create a duplicate incident.
   */
  const [clientRequestIds, setClientRequestIds] = useState<string[]>([]);

  /**
   * Synchronous re-entrancy guard. React only disables the button on the
   * next render tick, which is too slow for double-clicks. A ref changes
   * immediately.
   */
  const publishingRef = useRef(false);

  // KIA entries per extracted incident (parallel array)
  const [kiaPerIncident, setKiaPerIncident] = useState<KiaEntry[][]>([]);
  const [kiaExpanded, setKiaExpanded] = useState(true);
  // Pro-state irregulars KIA entries per incident
  const [irrPerIncident, setIrrPerIncident] = useState<KiaEntry[][]>([]);
  const [irrExpanded, setIrrExpanded] = useState(true);
  // Militant entries per extracted incident
  const [mPerIncident, setMPerIncident] = useState<MilitantEntry[][]>([]);
  const [mExpanded, setMExpanded] = useState(true);


  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <p className="font-mono text-sm text-muted-foreground">Access denied. Admin role required.</p>
      </div>
    );
  }

  /** Called by BatchIncidentExtractor once the edge function returns.
   *  All heavy per-incident state derivation lives here (KIA/irregular/militant
   *  scaffolding), unchanged from previous behavior. */
  const handleExtracted = useCallback((results: ExtractedData[]) => {
    setExtractedList(results);
    setActiveIndex(0);
    setClientRequestIds(results.map(() => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`)));
    setKiaPerIncident(results.map((r) => buildKiaEntries(r, Array.isArray((r as any).soldiers) ? (r as any).soldiers : [])));
    setIrrPerIncident(results.map((r) => buildIrregularEntries(r, Array.isArray((r as any).irregulars) ? (r as any).irregulars : [])));
    setMPerIncident(results.map((r) => buildMilitantEntries(r, Array.isArray((r as any).militants) ? (r as any).militants : [])));
    setKiaExpanded(true);
    setIrrExpanded(true);
    setMExpanded(true);
    setExtractionDone(true);
  }, []);


  /** Build the incident payload for the atomic RPC. */
  const buildIncidentPayload = (ex: ExtractedData) => ({
    date: ex.date,
    country: ex.country || "Pakistan",
    province: ex.province,
    district: ex.district || null,
    location_name: ex.location_name || null,
    event_type: ex.event_type,
    // Counts are recomputed by the DB trigger from the child rows, but we
    // pass what the extractor saw so incidents with 0 linked rows still
    // display sensible numbers.
    soldiers_killed: ex.soldiers_killed || 0,
    soldiers_injured: ex.soldiers_injured || 0,
    irregulars_killed: ex.irregulars_killed || 0,
    irregulars_injured: ex.irregulars_injured || 0,
    others_killed: ex.others_killed || 0,
    others_injured: ex.others_injured || 0,
    summary: ex.summary,
    source_type: ex.source_type,
    source_url: ex.source_url || null,
    confidence: "medium" as const,
    verification_status: "verified" as const,
    published: true,
    perpetrator_actor_id: ex.perpetrator_actor_id,
    target_actor_id: ex.target_actor_id,
    economic_damage: cleanEconomicDamage(ex.economic_damage ?? {}),
  });

  const buildKiaPayload = (entry: KiaEntry) => ({
    name: entry.name.trim() || "Unknown",
    rank: entry.rank || null,
    unit: entry.unit || null,
    force_type: entry.force_type || "Army",
    date_of_death: entry.date_of_death,
    casualty_country: entry.casualty_country || "Pakistan",
    casualty_province: entry.casualty_province,
    casualty_district: entry.casualty_district || null,
    casualty_tehsil: entry.casualty_tehsil || null,
    hometown_province: entry.hometown_province || null,
    hometown_district: entry.hometown_district || null,
    hometown_tehsil: entry.hometown_tehsil || null,
    media_acknowledged: entry.media_acknowledged,
    source_url: entry.source_url || null,
    notes: entry.notes || null,
  });

  const buildMilitantPayload = (e: MilitantEntry) => ({
    name: e.name.trim() || (e.alias.trim() ? null : "Unknown"),
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
  });

  /**
   * Publish one staged incident via the atomic RPC. Uses the retained
   * clientRequestId so a retry after a network timeout does not create a
   * duplicate. On success, drops the incident from the staging list; on
   * failure it stays with the same key for retry.
   */
  const publishOne = async (idx: number): Promise<boolean> => {
    const ex = extractedList[idx];
    if (!ex) return false;
    let requestId = clientRequestIds[idx];
    if (!requestId) {
      requestId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
      setClientRequestIds((prev) => {
        const next = [...prev];
        next[idx] = requestId!;
        return next;
      });
    }
    const result = await publishBundle.mutateAsync({
      incident: buildIncidentPayload(ex),
      kia: (kiaPerIncident[idx] || []).map(buildKiaPayload),
      irregulars: (irrPerIncident[idx] || []).map(buildKiaPayload),
      militants: (mPerIncident[idx] || []).map(buildMilitantPayload),
      clientRequestId: requestId,
    });
    return !!result.incident_id;
  };

  const handlePublishAll = async () => {
    if (extractedList.length === 0) return;
    if (publishingRef.current) return; // sync guard: double-click safe
    publishingRef.current = true;
    setSaving(true);
    const successIdx: number[] = [];
    const failures: { idx: number; err: string }[] = [];
    try {
      for (let i = 0; i < extractedList.length; i++) {
        try {
          const ok = await publishOne(i);
          if (ok) successIdx.push(i);
        } catch (err: any) {
          failures.push({ idx: i, err: err?.message ?? String(err) });
        }
      }
      // Remove only successful incidents, preserving request IDs for retries.
      if (successIdx.length > 0) {
        const drop = new Set(successIdx);
        setExtractedList((prev) => prev.filter((_, i) => !drop.has(i)));
        setKiaPerIncident((prev) => prev.filter((_, i) => !drop.has(i)));
        setIrrPerIncident((prev) => prev.filter((_, i) => !drop.has(i)));
        setMPerIncident((prev) => prev.filter((_, i) => !drop.has(i)));
        setClientRequestIds((prev) => prev.filter((_, i) => !drop.has(i)));
        setActiveIndex(0);
      }
      if (failures.length === 0) {
        setInputResetSignal((n) => n + 1);
        setExtractionDone(false);
        toast({ title: "Published", description: `${successIdx.length} incident bundle(s) committed.` });
      } else {
        toast({
          title: `Published ${successIdx.length}, ${failures.length} failed`,
          description: failures.map((f) => f.err).join("; "),
          variant: "destructive",
        });
      }
      invalidateAllCasualtyData(queryClient);
    } finally {
      setSaving(false);
      publishingRef.current = false;
    }
  };

  const handlePublishSingle = async (idx: number) => {
    if (publishingRef.current) return;
    publishingRef.current = true;
    setSaving(true);
    try {
      const ok = await publishOne(idx);
      if (ok) {
        setExtractedList((prev) => prev.filter((_, i) => i !== idx));
        setKiaPerIncident((prev) => prev.filter((_, i) => i !== idx));
        setIrrPerIncident((prev) => prev.filter((_, i) => i !== idx));
        setMPerIncident((prev) => prev.filter((_, i) => i !== idx));
        setClientRequestIds((prev) => prev.filter((_, i) => i !== idx));
        if (activeIndex >= idx && activeIndex > 0) setActiveIndex(activeIndex - 1);
        toast({ title: "Published", description: "Incident bundle committed." });
        invalidateAllCasualtyData(queryClient);
      }
    } catch (err: any) {
      toast({ title: "Save failed", description: err?.message ?? String(err), variant: "destructive" });
    } finally {
      setSaving(false);
      publishingRef.current = false;
    }
  };


  const updateField = (key: keyof ExtractedData, value: any) => {
    const updated = [...extractedList];
    updated[activeIndex] = { ...updated[activeIndex], [key]: value };
    setExtractedList(updated);

    // If soldiers_killed changed, sync KIA entry count
    if (key === "soldiers_killed") {
      const newCount = parseInt(value) || 0;
      const currentEntries = kiaPerIncident[activeIndex] || [];
      const incident = updated[activeIndex];
      let newEntries: KiaEntry[];
      if (newCount > currentEntries.length) {
        newEntries = [...currentEntries];
        for (let i = currentEntries.length; i < newCount; i++) {
          newEntries.push(makeEmptyKia(incident));
        }
      } else {
        newEntries = currentEntries.slice(0, newCount);
      }
      const updatedKia = [...kiaPerIncident];
      updatedKia[activeIndex] = newEntries;
      setKiaPerIncident(updatedKia);
    }

    // If irregulars_killed changed, sync irregulars entry count
    if (key === "irregulars_killed") {
      const newCount = parseInt(value) || 0;
      const currentEntries = irrPerIncident[activeIndex] || [];
      const incident = updated[activeIndex];
      let newEntries: KiaEntry[];
      if (newCount > currentEntries.length) {
        newEntries = [...currentEntries];
        for (let i = currentEntries.length; i < newCount; i++) {
          newEntries.push({ ...makeEmptyKia(incident), force_type: "Pro-State Militia" });
        }
      } else {
        newEntries = currentEntries.slice(0, newCount);
      }
      const next = [...irrPerIncident];
      next[activeIndex] = newEntries;
      setIrrPerIncident(next);
    }

    // If others_killed changed, sync militant entry count
    if (key === "others_killed") {
      const newCount = parseInt(value) || 0;
      const currentEntries = mPerIncident[activeIndex] || [];
      const incident = updated[activeIndex];
      let newEntries: MilitantEntry[];
      if (newCount > currentEntries.length) {
        newEntries = [...currentEntries];
        for (let i = currentEntries.length; i < newCount; i++) {
          newEntries.push(makeEmptyMilitant(incident));
        }
      } else {
        newEntries = currentEntries.slice(0, newCount);
      }
      const updatedM = [...mPerIncident];
      updatedM[activeIndex] = newEntries;
      setMPerIncident(updatedM);
    }

    // If province/district/date/source_url changed, update existing KIA + irregular entries
    if (["province", "district", "date", "source_url", "country"].includes(key)) {
      const incident = updated[activeIndex];
      const fieldMap: Record<string, string> = {
        province: "casualty_province",
        district: "casualty_district",
        date: "date_of_death",
        source_url: "source_url",
        country: "casualty_country",
      };
      const kiaKey = fieldMap[key];
      if (kiaKey) {
        const cur = kiaPerIncident[activeIndex] || [];
        if (cur.length > 0) {
          const next = [...kiaPerIncident];
          next[activeIndex] = cur.map((e) => ({ ...e, [kiaKey]: value || "" }));
          setKiaPerIncident(next);
        }
        const curI = irrPerIncident[activeIndex] || [];
        if (curI.length > 0) {
          const nextI = [...irrPerIncident];
          nextI[activeIndex] = curI.map((e) => ({ ...e, [kiaKey]: value || "" }));
          setIrrPerIncident(nextI);
        }
      }
      // Propagate to militant entries too
      const curM = mPerIncident[activeIndex] || [];
      if (curM.length > 0) {
        const mMap: Record<string, keyof MilitantEntry> = {
          province: "province",
          district: "district",
          date: "date_of_death",
          source_url: "source_url",
        };
        const mKey = mMap[key];
        if (mKey) {
          const updatedM = [...mPerIncident];
          updatedM[activeIndex] = curM.map((e) => ({ ...e, [mKey]: value || "" }));
          setMPerIncident(updatedM);
        }
      }
      void incident;

      // Auto-suggest perpetrator from operational areas / memberships when blank
      if (["province", "district", "location_name"].includes(key)) {
        const cur = updated[activeIndex];
        if (!cur.perpetrator_actor_id && (cur.province || cur.district || cur.location_name)) {
          void suggestPerpetratorForLocation({
            lng: null,
            lat: null,
            province: cur.province || null,
            district: cur.district || null,
            tehsil: cur.location_name || null,
          }).then((suggestion) => {
            if (!suggestion) return;
            setExtractedList((prev) => {
              const next = [...prev];
              if (next[activeIndex] && !next[activeIndex].perpetrator_actor_id) {
                next[activeIndex] = { ...next[activeIndex], perpetrator_actor_id: suggestion.actor_id };
                toast({
                  title: "Perpetrator suggested",
                  description: `${suggestion.actor_name} (via ${suggestion.source})`,
                });
              }
              return next;
            });
          }).catch(() => { /* silent */ });
        }
      }
    }
  };

  const removeExtracted = (idx: number) => {
    const updated = extractedList.filter((_, i) => i !== idx);
    setExtractedList(updated);
    setKiaPerIncident(kiaPerIncident.filter((_, i) => i !== idx));
    setIrrPerIncident(irrPerIncident.filter((_, i) => i !== idx));
    setMPerIncident(mPerIncident.filter((_, i) => i !== idx));
    if (activeIndex >= updated.length) setActiveIndex(Math.max(0, updated.length - 1));
  };


  const updateKiaField = (entryIdx: number, key: string, value: any) => {
    setKiaPerIncident(prev => {
      const updatedKia = [...prev];
      const entries = [...(updatedKia[activeIndex] || [])];
      entries[entryIdx] = { ...entries[entryIdx], [key]: value };
      updatedKia[activeIndex] = entries;
      return updatedKia;
    });
  };

  const updateKiaFields = (entryIdx: number, updates: Record<string, any>) => {
    setKiaPerIncident(prev => {
      const updatedKia = [...prev];
      const entries = [...(updatedKia[activeIndex] || [])];
      entries[entryIdx] = { ...entries[entryIdx], ...updates };
      updatedKia[activeIndex] = entries;
      return updatedKia;
    });
  };

  const addKiaEntry = () => {
    const incident = extractedList[activeIndex] || emptyData;
    const updatedKia = [...kiaPerIncident];
    updatedKia[activeIndex] = [...(updatedKia[activeIndex] || []), makeEmptyKia(incident as ExtractedData)];
    setKiaPerIncident(updatedKia);
  };

  const removeKiaEntry = (entryIdx: number) => {
    const updatedKia = [...kiaPerIncident];
    updatedKia[activeIndex] = (updatedKia[activeIndex] || []).filter((_, i) => i !== entryIdx);
    setKiaPerIncident(updatedKia);
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
    const incident = extractedList[activeIndex] || emptyData;
    const next = [...mPerIncident];
    next[activeIndex] = [...(next[activeIndex] || []), makeEmptyMilitant(incident)];
    setMPerIncident(next);
  };
  const removeMEntry = (entryIdx: number) => {
    const next = [...mPerIncident];
    next[activeIndex] = (next[activeIndex] || []).filter((_, i) => i !== entryIdx);
    setMPerIncident(next);
  };

  // Irregulars KIA helpers
  const updateIrrField = (entryIdx: number, key: string, value: any) => {
    setIrrPerIncident((prev) => {
      const next = [...prev];
      const entries = [...(next[activeIndex] || [])];
      entries[entryIdx] = { ...entries[entryIdx], [key]: value };
      next[activeIndex] = entries;
      return next;
    });
  };
  const updateIrrFields = (entryIdx: number, updates: Record<string, any>) => {
    setIrrPerIncident((prev) => {
      const next = [...prev];
      const entries = [...(next[activeIndex] || [])];
      entries[entryIdx] = { ...entries[entryIdx], ...updates };
      next[activeIndex] = entries;
      return next;
    });
  };
  const addIrrEntry = () => {
    const incident = extractedList[activeIndex] || emptyData;
    const next = [...irrPerIncident];
    next[activeIndex] = [...(next[activeIndex] || []), { ...makeEmptyKia(incident as ExtractedData), force_type: "Pro-State Militia" }];
    setIrrPerIncident(next);
  };
  const removeIrrEntry = (entryIdx: number) => {
    const next = [...irrPerIncident];
    next[activeIndex] = (next[activeIndex] || []).filter((_, i) => i !== entryIdx);
    setIrrPerIncident(next);
  };

  const extracted = extractedList[activeIndex] || null;
  const currentKiaEntries = kiaPerIncident[activeIndex] || [];
  const currentIrrEntries = irrPerIncident[activeIndex] || [];
  const currentMEntries = mPerIncident[activeIndex] || [];


  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-mono text-lg font-semibold tracking-wider">BATCH INCIDENT EXTRACTION</h1>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          Paste multiple articles/tweets below (one per block), then extract all at once.
        </p>
      </div>

      {/* Input Area — isolated so typing does NOT rerender parent tree */}
      <BatchIncidentExtractor
        onExtracted={handleExtracted as any}
        resetSignal={inputResetSignal}
        extractionDone={extractionDone}
      />

        {/* Success Banner */}
        {extractionDone && extractedList.length > 0 && (
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-4 space-y-3">
            <div className="flex items-center justify-center gap-2 text-primary">
              <Check className="h-5 w-5" />
              <span className="font-mono text-sm font-semibold">EXTRACTION SUCCESSFUL</span>
            </div>
            {extractedList.map((inc, idx) => {
              const kias = kiaPerIncident[idx] || [];
              const location = [inc.district, inc.province].filter(Boolean).join(", ") || "Unknown Location";
              const totalKilled = inc.soldiers_killed + inc.others_killed;
              const totalWounded = inc.soldiers_injured + inc.others_injured;
              const branches = [...new Set(kias.map(k => k.force_type).filter(Boolean))];
              const names = kias.map(k => k.name).filter(n => n && n !== "Unknown Soldier");
              const branchStr = branches.length > 0 ? branches.join(", ") : "Unknown Branch";
              const nameStr = names.length > 0 ? ` (including ${names.join(", ")})` : "";
              const personnelCount = totalKilled + totalWounded;

              return (
                <div key={idx} className="rounded border border-primary/20 bg-primary/5 px-3 py-2 text-left">
                  <p className="font-mono text-xs text-primary/90">
                    Incident at <span className="font-semibold">{location}</span> successfully logged.{" "}
                    {personnelCount > 0 && (
                      <>
                        <span className="font-semibold">{personnelCount}</span> personnel from{" "}
                        <span className="font-semibold">{branchStr}</span> identified{nameStr}.
                      </>
                    )}
                    {totalKilled > 0 && <> — <span className="font-semibold">{totalKilled} killed</span></>}
                    {totalWounded > 0 && <>, <span className="font-semibold">{totalWounded} wounded</span></>}
                    .
                  </p>
                </div>
              );
            })}
          </div>
        )}

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

          {/* Incident tabs */}
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
                  <Input
                    type="date"
                    value={extracted.date}
                    min="2026-01-01"
                    onChange={(e) => updateField("date", e.target.value)}
                    onBlur={(e) => { const v = e.target.value; if (v && !confirmDateChange(v)) updateField("date", todayLocalISO()); }}
                    className="h-8 text-xs font-mono bg-secondary border-border"
                  />
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
                <Field label="Irregulars KIA">
                  <Input
                    type="number"
                    min={0}
                    value={extracted.irregulars_killed}
                    onChange={(e) => updateField("irregulars_killed", parseInt(e.target.value) || 0)}
                    className="h-8 text-xs font-mono bg-secondary border-border ring-1 ring-orange-500/40"
                    title="Pro-state irregulars: peace committee, VDC, razakar, informants"
                  />
                </Field>
                <Field label="Irregulars WIA">
                  <Input
                    type="number"
                    min={0}
                    value={extracted.irregulars_injured}
                    onChange={(e) => updateField("irregulars_injured", parseInt(e.target.value) || 0)}
                    className="h-8 text-xs font-mono bg-secondary border-border ring-1 ring-orange-500/40"
                  />
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

              {extracted.event_type === "economic_attack" && (
                <EconomicDamageFields
                  value={extracted.economic_damage ?? {}}
                  onChange={(v) => updateField("economic_damage", v as any)}
                />
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Perpetrator / Target">
                  <ActorPicker
                    value={extracted.perpetrator_actor_id}
                    onChange={(v) => updateField("perpetrator_actor_id", v)}
                  />
                </Field>
              </div>


              <Field label="Source URL">
                <Input value={extracted.source_url} onChange={(e) => updateField("source_url", e.target.value)} className="h-8 text-xs font-mono bg-secondary border-border" placeholder="https://..." />
              </Field>

              <Field label="Summary">
                <Textarea value={extracted.summary} onChange={(e) => updateField("summary", e.target.value)} className="min-h-[80px] text-xs font-mono bg-secondary border-border" />
              </Field>

              {/* Inline KIA Section */}
              {currentKiaEntries.length > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-3">
                  <button
                    onClick={() => setKiaExpanded(!kiaExpanded)}
                    className="flex items-center justify-between w-full"
                  >
                    <div className="flex items-center gap-2">
                      <UserX className="h-4 w-4 text-destructive" />
                      <span className="font-mono text-xs font-semibold tracking-wider text-destructive">
                        KIA SOLDIERS ({currentKiaEntries.length})
                      </span>
                    </div>
                    {kiaExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </button>

                  {kiaExpanded && (
                    <div className="space-y-3">
                      {currentKiaEntries.map((entry, idx) => (
                        <div key={idx} className="rounded border border-border bg-card p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="font-mono text-xs font-semibold text-muted-foreground">SOLDIER #{idx + 1}</p>
                            <Button variant="ghost" size="sm" onClick={() => removeKiaEntry(idx)} className="h-6 w-6 p-0 text-destructive">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                            <Field label="Name">
                              <Input value={entry.name} onChange={(e) => updateKiaField(idx, "name", e.target.value)} className="h-7 text-xs font-mono bg-secondary border-border" placeholder="Unknown if blank" />
                            </Field>
                            <Field label="Rank">
                              <Input value={entry.rank} onChange={(e) => updateKiaField(idx, "rank", e.target.value)} className="h-7 text-xs font-mono bg-secondary border-border" />
                            </Field>
                            <Field label="Force">
                              <Select value={entry.force_type} onValueChange={(v) => updateKiaField(idx, "force_type", v)}>
                                <SelectTrigger className="h-7 text-xs font-mono bg-secondary border-border"><SelectValue /></SelectTrigger>
                                <SelectContent>{FORCE_TYPES.map((ft) => <SelectItem key={ft} value={ft}>{ft}</SelectItem>)}</SelectContent>
                              </Select>
                            </Field>
                            <div className="col-span-2 lg:col-span-3">
                              <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Casualty Location</Label>
                              <LocationPicker
                                province={entry.casualty_province}
                                district={entry.casualty_district}
                                tehsil={entry.casualty_tehsil}
                                 onProvinceChange={(v) => updateKiaFields(idx, { casualty_province: v, casualty_district: "", casualty_tehsil: "" })}
                                 onDistrictChange={(v) => updateKiaFields(idx, { casualty_district: v, casualty_tehsil: "" })}
                                 onTehsilChange={(v) => updateKiaField(idx, "casualty_tehsil", v)}
                                 showTehsil
                                 size="sm"
                               />
                             </div>
                            <div className="col-span-2 lg:col-span-3">
                              <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Hometown (Province / District / Tehsil)</Label>
                              <LocationPicker
                                province={entry.hometown_province}
                                district={entry.hometown_district}
                                tehsil={entry.hometown_tehsil}
                                onProvinceChange={(v) => updateKiaFields(idx, { hometown_province: v, hometown_district: "", hometown_tehsil: "" })}
                                onDistrictChange={(v) => updateKiaFields(idx, { hometown_district: v, hometown_tehsil: "" })}
                                onTehsilChange={(v) => updateKiaField(idx, "hometown_tehsil", v)}
                                showTehsil
                                size="sm"
                              />
                            </div>


                            <Field label="Media Ack.">
                              <div className="flex items-center h-7 gap-2">
                                <Checkbox checked={entry.media_acknowledged} onCheckedChange={(v) => updateKiaField(idx, "media_acknowledged", !!v)} />
                                <span className="font-mono text-xs">{entry.media_acknowledged ? "Yes" : "No"}</span>
                              </div>
                            </Field>
                          </div>
                          <Field label="Source URL">
                            <Input value={entry.source_url} onChange={(e) => updateKiaField(idx, "source_url", e.target.value)} className="h-7 text-xs font-mono bg-secondary border-border" placeholder="https://..." />
                          </Field>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={addKiaEntry} className="gap-1.5 font-mono text-xs">
                        <Plus className="h-3.5 w-3.5" /> Add Another Soldier
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Show add KIA button when no entries exist */}
              {currentKiaEntries.length === 0 && (
                <Button variant="outline" size="sm" onClick={addKiaEntry} className="gap-1.5 font-mono text-xs">
                  <UserX className="h-3.5 w-3.5" /> Add KIA Soldier
                </Button>
              )}

              {/* Pro-State Irregulars KIA Section (peace committee, VDC, razakars, informants) */}
              <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3 space-y-3">
                <button onClick={() => setIrrExpanded(!irrExpanded)} className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-orange-400" />
                    <span className="font-mono text-xs font-semibold tracking-wider text-orange-400">
                      PRO-STATE IRREGULARS KIA ({currentIrrEntries.length})
                    </span>
                  </div>
                  {irrExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
                <p className="font-mono text-[10px] text-muted-foreground -mt-1">
                  Peace committee / aman committee / VDC / razakar / tribal lashkar / spies / informants. Counted separately from uniformed forces.
                </p>
                {irrExpanded && (
                  <div className="space-y-3">
                    {currentIrrEntries.map((entry, idx) => (
                      <div key={idx} className="rounded border border-border bg-card p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="font-mono text-xs font-semibold text-muted-foreground">IRREGULAR #{idx + 1}</p>
                          <Button variant="ghost" size="sm" onClick={() => removeIrrEntry(idx)} className="h-6 w-6 p-0 text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                          <Field label="Name">
                            <Input value={entry.name} onChange={(e) => updateIrrField(idx, "name", e.target.value)} className="h-7 text-xs font-mono bg-secondary border-border" placeholder="Unknown if blank" />
                          </Field>
                          <Field label="Role">
                            <Input value={entry.rank} onChange={(e) => updateIrrField(idx, "rank", e.target.value)} className="h-7 text-xs font-mono bg-secondary border-border" placeholder="e.g. Member" />
                          </Field>
                          <Field label="Group / Type">
                            <Select value={entry.force_type} onValueChange={(v) => updateIrrField(idx, "force_type", v)}>
                              <SelectTrigger className="h-7 text-xs font-mono bg-secondary border-border"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {IRREGULAR_FORCE_TYPES.map((ft) => <SelectItem key={ft} value={ft}>{ft}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </Field>
                          <Field label="Unit / Committee">
                            <Input value={entry.unit} onChange={(e) => updateIrrField(idx, "unit", e.target.value)} className="h-7 text-xs font-mono bg-secondary border-border" placeholder="e.g. Bakakhel Peace Committee" />
                          </Field>
                          <div className="col-span-2 lg:col-span-3">
                            <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Casualty Location</Label>
                            <LocationPicker
                              province={entry.casualty_province}
                              district={entry.casualty_district}
                              tehsil={entry.casualty_tehsil}
                              onProvinceChange={(v) => updateIrrFields(idx, { casualty_province: v, casualty_district: "", casualty_tehsil: "" })}
                              onDistrictChange={(v) => updateIrrFields(idx, { casualty_district: v, casualty_tehsil: "" })}
                              onTehsilChange={(v) => updateIrrField(idx, "casualty_tehsil", v)}
                              showTehsil
                              size="sm"
                            />
                          </div>
                        </div>
                        <Field label="Source URL">
                          <Input value={entry.source_url} onChange={(e) => updateIrrField(idx, "source_url", e.target.value)} className="h-7 text-xs font-mono bg-secondary border-border" placeholder="https://..." />
                        </Field>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addIrrEntry} className="gap-1.5 font-mono text-xs">
                      <Plus className="h-3.5 w-3.5" /> Add Irregular KIA
                    </Button>
                  </div>
                )}
              </div>


              {/* Inline Militant Casualties Section */}
              <div className="rounded-lg border border-success/30 bg-success/5 p-3 space-y-3">
                <button onClick={() => setMExpanded(!mExpanded)} className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <Skull className="h-4 w-4 text-success" />
                    <span className="font-mono text-xs font-semibold tracking-wider text-success">
                      MILITANT CASUALTIES ({currentMEntries.length})
                    </span>
                  </div>
                  {mExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
                {mExpanded && (
                  <div className="space-y-3">
                    {currentMEntries.map((entry, idx) => (
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
                            <Input type="date" value={entry.date_of_death} min="2026-01-01" onChange={(e) => updateMField(idx, "date_of_death", e.target.value)} onBlur={(e) => { const v = e.target.value; if (v && !confirmDateChange(v)) updateMField(idx, "date_of_death", todayLocalISO()); }} className="h-7 text-xs font-mono bg-secondary border-border" />
                          </Field>
                        </div>
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
                        <Field label="Source URL">
                          <Input value={entry.source_url} onChange={(e) => updateMField(idx, "source_url", e.target.value)} className="h-7 text-xs font-mono bg-secondary border-border" placeholder="https://..." />
                        </Field>
                        <Field label="Notes">
                          <Textarea value={entry.notes} onChange={(e) => updateMField(idx, "notes", e.target.value)} className="min-h-[60px] text-xs font-mono bg-secondary border-border" />
                        </Field>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addMEntry} className="gap-1.5 font-mono text-xs">
                      <Plus className="h-3.5 w-3.5" /> Add Militant Casualty
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

      <RecentIncidentsSection />
      
      <AdminAttributionPanel />
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

const RecentIncidentsSection = memo(function RecentIncidentsSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Incident | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["incidents", "admin-recent"],
    queryFn: async (): Promise<Incident[]> => {
      const { data, error } = await (supabase as any)
        .from("incidents")
        .select(INCIDENT_DETAIL_COLUMNS)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Incident[];
    },
    staleTime: 10_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel(`admin-recent-incidents`)
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents" },
        () => queryClient.invalidateQueries({ queryKey: ["incidents", "admin-recent"] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const handleDelete = async (inc: Incident) => {
    setDeletingId(inc.id);
    try {
      await (supabase as any).from("militant_casualties").delete().eq("incident_id", inc.id);
      await (supabase as any).from("kia_soldiers").delete().eq("incident_id", inc.id);
      const { error } = await (supabase as any).from("incidents").delete().eq("id", inc.id);
      if (error) throw error;
      toast({ title: "Deleted", description: "Incident removed." });
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      queryClient.invalidateQueries({ queryKey: ["kia_soldiers"] });
      queryClient.invalidateQueries({ queryKey: ["militant_casualties"] });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-3 pt-4 border-t border-border">
      <h2 className="font-mono text-sm font-semibold tracking-wider">RECENT INCIDENTS ({rows.length})</h2>
      {isLoading ? (
        <p className="font-mono text-xs text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="font-mono text-xs text-muted-foreground">No incidents yet.</p>
      ) : (
        <LiveIncidentTable
          incidents={rows}
          isAdmin={true}
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
});

