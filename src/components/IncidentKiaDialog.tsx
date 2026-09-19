import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import LocationPicker from "@/components/LocationPicker";
import { Loader2, Plus, Trash2, Pencil, X, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useCreateKiaSoldier, useUpdateKiaSoldier, useDeleteKiaSoldier, type KiaSoldier } from "@/hooks/useKiaSoldiers";
import { useUpsertMilitantCasualty, useDeleteMilitantCasualty, MILITANT_AFFILIATIONS, getMilitantAffiliationColor, type MilitantCasualty } from "@/hooks/useMilitantCasualties";
import { useQuery } from "@tanstack/react-query";
import { useUpdateIncident } from "@/hooks/useAdminIncidents";
import { supabase } from "@/integrations/supabase/client";
import { KIA_DETAIL_COLUMNS } from "@/lib/selectors";
import { qk } from "@/lib/queryKeys";
import { format } from "date-fns";
import { parseDateLocal } from "@/lib/utils";
import type { Incident } from "@/lib/types";

const FORCE_TYPES = ["Army", "Air Force", "ASF", "Police/CTD", "FC", "Rangers", "Coast Guards", "Pro-State Militia", "Other"] as const;

interface Props {
  incident: Incident | null;
  onOpenChange: (open: boolean) => void;
}

export default function IncidentKiaDialog({ incident, onOpenChange }: Props) {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const incidentId = incident?.id ?? null;

  // Scoped per-incident fetches — previously we loaded ALL kia_soldiers and
  // ALL militant_casualties rows and filtered client-side, which caused the
  // KIA dialog to freeze once the tables grew to thousands of rows.
  const { data: linked = [] } = useQuery({
    queryKey: incidentId ? qk.kia.byIncidentFull(incidentId) : ["kia", "byIncidentFull", "noop"],
    enabled: !!incidentId,
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async (): Promise<KiaSoldier[]> => {
      const { data, error } = await supabase
        .from("kia_soldiers")
        .select(KIA_DETAIL_COLUMNS)
        .eq("incident_id", incidentId!)
        .order("date_of_death", { ascending: false });
      if (error) throw error;
      return (data as unknown) as KiaSoldier[];
    },
  });
  const createKia = useCreateKiaSoldier();
  const updateKia = useUpdateKiaSoldier();
  const deleteKia = useDeleteKiaSoldier();
  const updateIncident = useUpdateIncident();
  const { data: linkedMilitants = [] } = useQuery({
    queryKey: incidentId ? ["militant_casualties", "by_incident", incidentId] : ["militant_casualties", "noop"],
    enabled: !!incidentId,
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async (): Promise<MilitantCasualty[]> => {
      const { data, error } = await supabase
        .from("militant_casualties" as any)
        .select("*")
        .eq("incident_id", incidentId!)
        .order("date_of_death", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as MilitantCasualty[];
    },
  });
  const upsertMilitant = useUpsertMilitantCasualty();
  const deleteMilitant = useDeleteMilitantCasualty();

  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<Partial<KiaSoldier> | null>(null);
  const [mEditingIdx, setMEditingIdx] = useState<number | null>(null);
  const [mDraft, setMDraft] = useState<Partial<MilitantCasualty> | null>(null);

  useEffect(() => {
    setEditingIdx(null);
    setDraft(null);
    setMEditingIdx(null);
    setMDraft(null);
  }, [incident?.id]);

  const startNewMilitant = () => {
    if (!incident) return;
    setMEditingIdx(-1);
    setMDraft({
      name: "",
      alias: "",
      affiliation: "TTP",
      rank_role: "",
      date_of_death: incident.date,
      province: incident.province,
      district: incident.district || "",
      location_name: incident.location_name || "",
      hometown_province: "",
      hometown_district: "",
      hometown_tehsil: "",
      source_url: incident.source_url || "",
      notes: "",
      confirmed: true,
      incident_id: incident.id,
      created_by: user?.id || null,
    });
  };

  const startEditMilitant = (idx: number) => {
    setMEditingIdx(idx);
    setMDraft({ ...linkedMilitants[idx] });
  };

  const cancelEditMilitant = () => {
    setMEditingIdx(null);
    setMDraft(null);
  };

  const handleSaveMilitant = async () => {
    if (!mDraft || !incident) return;
    try {
      await upsertMilitant.mutateAsync({ ...mDraft, incident_id: incident.id } as any);
      toast({ title: "Saved", description: "Militant casualty saved." });
      cancelEditMilitant();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteMilitant = async (id: string) => {
    try {
      await deleteMilitant.mutateAsync(id);
      toast({ title: "Deleted", description: "Militant record removed." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // NOTE: no client-side syncCount — the DB trigger
  // `sync_incident_killed_count` keeps `incidents.soldiers_killed` and
  // `incidents.irregulars_killed` in lockstep with the kia_soldiers rows.
  // React Query invalidation via `invalidateAllCasualtyData` refreshes the
  // incident row so the new value is displayed.

  const startNew = () => {
    if (!incident) return;
    setEditingIdx(-1);
    setDraft({
      name: "Unknown",
      rank: "",
      unit: "",
      force_type: "Army",
      date_of_death: incident.date,
      casualty_province: incident.province,
      casualty_district: incident.district || "",
      casualty_country: incident.country || "Pakistan",
      casualty_tehsil: incident.location_name || "",
      hometown_province: "",
      hometown_district: "",
      hometown_tehsil: "",
      hometown_latitude: null,
      hometown_longitude: null,
      media_acknowledged: true,
      source_url: incident.source_url || "",
      notes: "",
      incident_id: incident.id,
      created_by: user?.id || null,
    });
  };

  const startEdit = (idx: number) => {
    setEditingIdx(idx);
    setDraft({ ...linked[idx] });
  };

  const cancelEdit = () => {
    setEditingIdx(null);
    setDraft(null);
  };

  const handleSave = async () => {
    if (!draft || !incident) return;
    try {
      const payload = {
        ...draft,
        name: (draft.name || "").trim() || "Unknown",
        incident_id: incident.id,
      } as any;
      if (editingIdx === -1) {
        await createKia.mutateAsync(payload);
        toast({ title: "Added", description: "KIA record created." });
      } else {
        await updateKia.mutateAsync(payload);
        toast({ title: "Updated", description: "KIA record saved." });
      }
      cancelEdit();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!incident) return;
    try {
      await deleteKia.mutateAsync(id);
      toast({ title: "Deleted", description: "KIA record removed." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const toggleMedia = async (k: KiaSoldier) => {
    const next = !k.media_acknowledged;
    try {
      await updateKia.mutateAsync({ id: k.id, media_acknowledged: next } as any);
      toast({ title: "Saved", description: `Media coverage set to ${next ? "Covered" : "Hidden"}.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={!!incident} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono tracking-wider">
            KIA RECORDS · {incident && format(parseDateLocal(incident.date), "dd MMM yy")} · {[incident?.district, incident?.province].filter(Boolean).join(", ")}
          </DialogTitle>
        </DialogHeader>

        {incident && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-mono text-xs text-muted-foreground">
                {linked.length} record{linked.length === 1 ? "" : "s"} linked · Incident reports {incident.soldiers_killed} KIA
              </p>
              {isAdmin && editingIdx === null && (
                <Button size="sm" onClick={startNew} className="gap-1.5 font-mono text-xs">
                  <Plus className="h-3.5 w-3.5" /> Add KIA
                </Button>
              )}
            </div>

            {editingIdx !== null && draft && (
              <div className="rounded-lg border border-primary/30 bg-card/60 p-3 space-y-3">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  <Field label="Name">
                    <Input value={draft.name || ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="h-8 text-xs font-mono" />
                  </Field>
                  <Field label="Rank">
                    <Input value={draft.rank || ""} onChange={(e) => setDraft({ ...draft, rank: e.target.value })} className="h-8 text-xs font-mono" />
                  </Field>
                  <Field label="Unit">
                    <Input value={draft.unit || ""} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} className="h-8 text-xs font-mono" />
                  </Field>
                  <Field label="Force">
                    <Select value={draft.force_type || "Army"} onValueChange={(v) => setDraft({ ...draft, force_type: v })}>
                      <SelectTrigger className="h-8 text-xs font-mono"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FORCE_TYPES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Date of Death">
                    <Input type="date" value={draft.date_of_death || ""} onChange={(e) => setDraft({ ...draft, date_of_death: e.target.value })} className="h-8 text-xs font-mono" />
                  </Field>
                  <Field label="Source URL">
                    <Input value={draft.source_url || ""} onChange={(e) => setDraft({ ...draft, source_url: e.target.value })} className="h-8 text-xs font-mono" />
                  </Field>
                  <Field label="Media Coverage">
                    <div className="flex items-center gap-2 h-8">
                      <Checkbox checked={!!draft.media_acknowledged} onCheckedChange={(v) => setDraft({ ...draft, media_acknowledged: !!v })} />
                      <span className="font-mono text-xs">{draft.media_acknowledged ? "Covered" : "Hidden"}</span>
                    </div>
                  </Field>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Hometown</p>
                  <LocationPicker
                    country="Pakistan"
                    province={draft.hometown_province || ""}
                    district={draft.hometown_district || ""}
                    tehsil={draft.hometown_tehsil || ""}
                    onProvinceChange={(v) => setDraft({ ...draft, hometown_province: v })}
                    onDistrictChange={(v) => setDraft({ ...draft, hometown_district: v })}
                    onTehsilChange={(v) => setDraft({ ...draft, hometown_tehsil: v })}
                    showTehsil
                    size="sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSave} disabled={createKia.isPending || updateKia.isPending} className="gap-1.5 font-mono text-xs">
                    {(createKia.isPending || updateKia.isPending) && <Loader2 className="h-3 w-3 animate-spin" />}
                    <Check className="h-3 w-3" /> Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEdit} className="gap-1.5 font-mono text-xs">
                    <X className="h-3 w-3" /> Cancel
                  </Button>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="font-mono text-[10px] uppercase tracking-wider">Name</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-wider">Rank</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-wider">Force</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-wider">Hometown</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-wider text-center">Media Coverage</TableHead>
                    {isAdmin && <TableHead className="text-right font-mono text-[10px] uppercase tracking-wider">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linked.length === 0 ? (
                    <TableRow><TableCell colSpan={isAdmin ? 6 : 5} className="text-center text-muted-foreground font-mono text-xs py-6">No KIA records linked.</TableCell></TableRow>
                  ) : linked.map((k, idx) => (
                    <TableRow key={k.id} className="border-border">
                      <TableCell className="font-mono text-xs font-semibold">{k.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{k.rank || "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="font-mono text-[10px]">{k.force_type}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{[k.hometown_district, k.hometown_province].filter(Boolean).join(", ") || "—"}</TableCell>
                      <TableCell className="text-center">
                        {isAdmin ? (
                          <div className="flex items-center justify-center gap-2">
                            <Checkbox checked={!!k.media_acknowledged} onCheckedChange={() => toggleMedia(k)} />
                            <span className="font-mono text-[10px] text-muted-foreground">{k.media_acknowledged ? "Covered" : "Hidden"}</span>
                          </div>
                        ) : (
                          <Badge variant={k.media_acknowledged ? "default" : "secondary"} className="font-mono text-[10px]">
                            {k.media_acknowledged ? "Covered" : "Hidden"}
                          </Badge>
                        )}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => startEdit(idx)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete KIA record?</AlertDialogTitle>
                                  <AlertDialogDescription>This will permanently remove the record for {k.name}.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(k.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
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

            {/* Militant Casualties Section */}
            <div className="mt-6 pt-4 border-t border-border space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                  Militant Casualties · {linkedMilitants.length} linked · Incident reports {incident.others_killed || 0} militant KIA
                </p>
                {isAdmin && mEditingIdx === null && (
                  <Button size="sm" onClick={startNewMilitant} className="gap-1.5 font-mono text-xs">
                    <Plus className="h-3.5 w-3.5" /> Add Militant
                  </Button>
                )}
              </div>

              {mEditingIdx !== null && mDraft && (
                <div className="rounded-lg border border-primary/30 bg-card/60 p-3 space-y-3">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    <Field label="Name"><Input value={mDraft.name || ""} onChange={(e) => setMDraft({ ...mDraft, name: e.target.value })} className="h-8 text-xs font-mono" /></Field>
                    <Field label="Alias"><Input value={mDraft.alias || ""} onChange={(e) => setMDraft({ ...mDraft, alias: e.target.value })} className="h-8 text-xs font-mono" /></Field>
                    <Field label="Rank / Role"><Input value={mDraft.rank_role || ""} onChange={(e) => setMDraft({ ...mDraft, rank_role: e.target.value })} className="h-8 text-xs font-mono" /></Field>
                    <Field label="Affiliation">
                      <Select value={mDraft.affiliation || "TTP"} onValueChange={(v) => setMDraft({ ...mDraft, affiliation: v })}>
                        <SelectTrigger className="h-8 text-xs font-mono"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MILITANT_AFFILIATIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Date of Death"><Input type="date" value={mDraft.date_of_death || ""} onChange={(e) => setMDraft({ ...mDraft, date_of_death: e.target.value })} className="h-8 text-xs font-mono" /></Field>
                    <Field label="Source URL"><Input value={mDraft.source_url || ""} onChange={(e) => setMDraft({ ...mDraft, source_url: e.target.value })} className="h-8 text-xs font-mono" /></Field>
                    <Field label="Confirmed">
                      <div className="flex items-center gap-2 h-8">
                        <Checkbox checked={!!mDraft.confirmed} onCheckedChange={(v) => setMDraft({ ...mDraft, confirmed: !!v })} />
                        <span className="font-mono text-xs">{mDraft.confirmed ? "Confirmed" : "Unconfirmed"}</span>
                      </div>
                    </Field>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Hometown</p>
                    <LocationPicker
                      country="Pakistan"
                      province={mDraft.hometown_province || ""}
                      district={mDraft.hometown_district || ""}
                      tehsil={mDraft.hometown_tehsil || ""}
                      onProvinceChange={(v) => setMDraft({ ...mDraft, hometown_province: v })}
                      onDistrictChange={(v) => setMDraft({ ...mDraft, hometown_district: v })}
                      onTehsilChange={(v) => setMDraft({ ...mDraft, hometown_tehsil: v })}
                      showTehsil
                      size="sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveMilitant} disabled={upsertMilitant.isPending} className="gap-1.5 font-mono text-xs">
                      {upsertMilitant.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                      <Check className="h-3 w-3" /> Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEditMilitant} className="gap-1.5 font-mono text-xs">
                      <X className="h-3 w-3" /> Cancel
                    </Button>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="font-mono text-[10px] uppercase tracking-wider">Name</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-wider">Alias</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-wider">Affiliation</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-wider">Hometown</TableHead>
                      {isAdmin && <TableHead className="text-right font-mono text-[10px] uppercase tracking-wider">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linkedMilitants.length === 0 ? (
                      <TableRow><TableCell colSpan={isAdmin ? 5 : 4} className="text-center text-muted-foreground font-mono text-xs py-6">No militant casualties linked.</TableCell></TableRow>
                    ) : linkedMilitants.map((m, idx) => (
                      <TableRow key={m.id} className="border-border">
                        <TableCell className="font-mono text-xs font-semibold">{m.name || "Unknown"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{m.alias || "—"}</TableCell>
                        <TableCell><Badge variant="outline" className={`font-mono text-[10px] ${getMilitantAffiliationColor(m.affiliation)}`}>{m.affiliation || "—"}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{[m.hometown_district, m.hometown_province].filter(Boolean).join(", ") || "—"}</TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => startEditMilitant(idx)}><Pencil className="h-3.5 w-3.5" /></Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete militant record?</AlertDialogTitle>
                                    <AlertDialogDescription>This will permanently remove the record for {m.name || "Unknown"}.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteMilitant(m.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
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
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
