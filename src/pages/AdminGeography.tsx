/**
 * Administrative Geography — Phase A admin console.
 *
 * Lets admins browse the current + historical boundary versions, edit areas
 * and aliases, upload GeoJSON polygons (matched by name/stable_key), and
 * export a version as GeoJSON. Nothing here mutates existing incidents.
 */
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  useBoundaryVersions, useAdminAreas, useUpsertAdminArea, useDeleteAdminArea,
  useAdminAreaAliases, useAddAlias, useDeleteAlias, useSetCurrentVersion,
  AREA_TYPES, type AdminArea, type BoundaryVersion,
} from "@/hooks/useAdminAreas";
import { buildHierarchy, areaTypeLabel, parseGeoJsonFeatures } from "@/lib/adminGeography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronRight, ChevronDown, Upload, Download, Plus, Trash2, Check, Loader2, Star } from "lucide-react";
import { toast } from "sonner";

const TREE_INDENT: Record<string, number> = {
  division: 0, district: 1, subdivision: 2, tehsil: 3, sub_tehsil: 4,
};

export default function AdminGeography() {
  const versionsQ = useBoundaryVersions();
  const [versionId, setVersionId] = useState<string | null>(null);
  const activeVersionId = versionId ?? versionsQ.data?.[0]?.id ?? null;
  const areasQ = useAdminAreas(activeVersionId);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editArea, setEditArea] = useState<AdminArea | null>(null);
  const [newAreaParent, setNewAreaParent] = useState<AdminArea | "root" | null>(null);
  const setCurrent = useSetCurrentVersion();

  const activeVersion: BoundaryVersion | undefined =
    versionsQ.data?.find((v) => v.id === activeVersionId);

  const filteredAreas = useMemo(() => {
    if (!areasQ.data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return areasQ.data;
    return areasQ.data.filter(
      (a) => a.name.toLowerCase().includes(q) || (a.stable_key ?? "").toLowerCase().includes(q),
    );
  }, [areasQ.data, search]);

  const hierarchy = useMemo(() => buildHierarchy(filteredAreas), [filteredAreas]);
  const toggle = (id: string) =>
    setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const exportGeoJson = () => {
    if (!areasQ.data) return;
    const fc = {
      type: "FeatureCollection",
      features: areasQ.data
        .filter((a) => a.geom)
        .map((a) => ({
          type: "Feature",
          properties: {
            id: a.id, name: a.name, area_type: a.area_type,
            stable_key: a.stable_key, province: a.province, status: a.status,
          },
          geometry: a.geom,
        })),
    };
    const blob = new Blob([JSON.stringify(fc)], { type: "application/geo+json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeVersion?.name ?? "boundary-version"}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 lg:px-6 py-6 space-y-6">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-wide">Administrative Geography</h1>
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider mt-1">
              Versioned divisions, districts, subdivisions and tehsils
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <Select value={activeVersionId ?? undefined} onValueChange={(v) => setVersionId(v)}>
              <SelectTrigger className="w-[360px] h-9 text-xs font-mono bg-secondary border-border">
                <SelectValue placeholder="Select boundary version" />
              </SelectTrigger>
              <SelectContent>
                {versionsQ.data?.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    <span className="flex items-center gap-2">
                      {v.is_current && <Star className="h-3 w-3 text-primary" fill="currentColor" />}
                      {v.name}
                      <span className="text-[10px] text-muted-foreground">({v.effective_from})</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeVersion && !activeVersion.is_current && (
              <Button
                size="sm"
                variant="outline"
                className="h-9 gap-1.5 text-xs"
                onClick={() =>
                  setCurrent.mutate(
                    { id: activeVersion.id, province: activeVersion.province, country: activeVersion.country },
                    {
                      onSuccess: () => toast.success("Marked as current"),
                      onError: (e: any) => toast.error(e.message),
                    },
                  )
                }
              >
                <Star className="h-3.5 w-3.5" /> Make current
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-9 gap-1.5 text-xs" onClick={exportGeoJson}>
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
          </div>
        </header>

        {activeVersion && (
          <div className="rounded border border-border/60 bg-card/40 p-3 text-xs font-mono">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Info label="Province" value={activeVersion.province ?? "—"} />
              <Info label="Effective from" value={activeVersion.effective_from} />
              <Info label="Effective to" value={activeVersion.effective_to ?? "open"} />
              <Info label="Source" value={activeVersion.source_title ?? "—"} />
            </div>
            {activeVersion.notes && (
              <p className="mt-3 text-muted-foreground italic">{activeVersion.notes}</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: hierarchy */}
          <section className="rounded border border-border/60 bg-card/30">
            <div className="flex items-center gap-2 p-3 border-b border-border/40">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or stable key…"
                className="h-8 text-xs bg-secondary border-border font-mono"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs shrink-0"
                onClick={() => setNewAreaParent("root")}
              >
                <Plus className="h-3.5 w-3.5" /> Add division
              </Button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-2">
              {areasQ.isLoading && <p className="text-xs text-muted-foreground p-4">Loading…</p>}
              {hierarchy.map((node) => (
                <TreeNode
                  key={node.id}
                  node={node}
                  expanded={expanded}
                  onToggle={toggle}
                  onEdit={setEditArea}
                  onAddChild={setNewAreaParent}
                />
              ))}
              {!areasQ.isLoading && hierarchy.length === 0 && (
                <p className="text-xs text-muted-foreground p-4">No areas match the current filter.</p>
              )}
            </div>
          </section>

          {/* Right: upload */}
          <section className="rounded border border-border/60 bg-card/30 p-4 space-y-4">
            <div>
              <h2 className="text-sm font-semibold tracking-wide">GeoJSON polygon upload</h2>
              <p className="text-[11px] text-muted-foreground mt-1">
                Upload a FeatureCollection. Each feature is matched to an existing area by
                <code className="mx-1 text-primary">stable_key</code> or <code className="text-primary">name</code>.
                Unmatched features are listed so you can rename them and re-upload.
              </p>
            </div>
            <GeoJsonUploader areas={areasQ.data ?? []} versionId={activeVersionId} />
          </section>
        </div>

        <VersionsAdminPanel versions={versionsQ.data ?? []} />
      </div>

      {editArea && (
        <EditAreaDialog
          area={editArea}
          allAreas={areasQ.data ?? []}
          onClose={() => setEditArea(null)}
        />
      )}
      {newAreaParent && activeVersion && (
        <NewAreaDialog
          version={activeVersion}
          parent={newAreaParent === "root" ? null : newAreaParent}
          onClose={() => setNewAreaParent(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------ subviews ------------------------------ */

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-foreground">{value}</p>
    </div>
  );
}

function TreeNode({
  node, expanded, onToggle, onEdit, onAddChild,
}: {
  node: ReturnType<typeof buildHierarchy>[number];
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (a: AdminArea) => void;
  onAddChild: (a: AdminArea) => void;
}) {
  const open = expanded.has(node.id);
  const hasChildren = node.children.length > 0;
  const indent = (TREE_INDENT[node.area_type] ?? 0) * 12;
  return (
    <>
      <div
        className="group flex items-center gap-1.5 py-1 px-1 rounded hover:bg-secondary/40 text-xs font-mono"
        style={{ paddingLeft: 4 + indent }}
      >
        <button
          onClick={() => hasChildren && onToggle(node.id)}
          className="w-4 h-4 flex items-center justify-center text-muted-foreground shrink-0"
        >
          {hasChildren ? (open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />) : null}
        </button>
        <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-border/60 uppercase tracking-wider">
          {areaTypeLabel(node.area_type)}
        </Badge>
        <button className="text-left flex-1 hover:text-primary" onClick={() => onEdit(node)}>
          {node.name}
        </button>
        <Badge
          variant="outline"
          className={`text-[9px] px-1.5 py-0 uppercase ${
            node.geometry_status === "verified"
              ? "border-primary/50 text-primary"
              : node.geometry_status === "draft"
              ? "border-amber-500/50 text-amber-500"
              : "border-muted-foreground/40 text-muted-foreground"
          }`}
        >
          {node.geometry_status}
        </Badge>
        <button
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-opacity"
          onClick={() => onAddChild(node)}
          title="Add child area"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
      {open && node.children.map((c) => (
        <TreeNode
          key={c.id} node={c} expanded={expanded}
          onToggle={onToggle} onEdit={onEdit} onAddChild={onAddChild}
        />
      ))}
    </>
  );
}

function EditAreaDialog({
  area, allAreas, onClose,
}: { area: AdminArea; allAreas: AdminArea[]; onClose: () => void }) {
  const [draft, setDraft] = useState<AdminArea>(area);
  const upsert = useUpsertAdminArea();
  const del = useDeleteAdminArea();
  const aliasesQ = useAdminAreaAliases(area.id);
  const addAlias = useAddAlias();
  const delAlias = useDeleteAlias();
  const [newAlias, setNewAlias] = useState("");

  const save = () => {
    upsert.mutate(
      {
        id: draft.id,
        boundary_version_id: draft.boundary_version_id,
        parent_id: draft.parent_id,
        country: draft.country, province: draft.province,
        area_type: draft.area_type, name: draft.name,
        stable_key: draft.stable_key, status: draft.status,
      } as any,
      {
        onSuccess: () => { toast.success("Saved"); onClose(); },
        onError: (e: any) => toast.error(e.message),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono tracking-wider text-sm">Edit area</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Row label="Name">
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="h-8 text-xs font-mono bg-secondary border-border" />
          </Row>
          <Row label="Type">
            <Select value={draft.area_type} onValueChange={(v) => setDraft({ ...draft, area_type: v })}>
              <SelectTrigger className="h-8 text-xs font-mono bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {AREA_TYPES.map((t) => <SelectItem key={t} value={t}>{areaTypeLabel(t)}</SelectItem>)}
              </SelectContent>
            </Select>
          </Row>
          <Row label="Parent">
            <Select
              value={draft.parent_id ?? "__none__"}
              onValueChange={(v) => setDraft({ ...draft, parent_id: v === "__none__" ? null : v })}
            >
              <SelectTrigger className="h-8 text-xs font-mono bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value="__none__">— none (top-level) —</SelectItem>
                {allAreas.filter((a) => a.id !== draft.id).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {areaTypeLabel(a.area_type)}: {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row label="Stable key">
            <Input value={draft.stable_key ?? ""} onChange={(e) => setDraft({ ...draft, stable_key: e.target.value || null })}
              className="h-8 text-xs font-mono bg-secondary border-border" />
          </Row>
          <Row label="Status">
            <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v })}>
              <SelectTrigger className="h-8 text-xs font-mono bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["current", "historical", "proposed", "retired"].map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>

          <div className="pt-2 border-t border-border/40">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Aliases</p>
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {aliasesQ.data?.map((al) => (
                <div key={al.id} className="flex items-center gap-2 text-xs font-mono">
                  <span className="flex-1">{al.alias}</span>
                  {al.notes && <span className="text-muted-foreground italic text-[10px]">{al.notes}</span>}
                  <button onClick={() => delAlias.mutate({ id: al.id, areaId: area.id })}
                    className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {(!aliasesQ.data || aliasesQ.data.length === 0) && (
                <p className="text-[11px] text-muted-foreground italic">No aliases yet.</p>
              )}
            </div>
            <div className="flex gap-2 mt-2">
              <Input value={newAlias} onChange={(e) => setNewAlias(e.target.value)}
                placeholder="New alias" className="h-8 text-xs font-mono bg-secondary border-border" />
              <Button size="sm" variant="outline" className="h-8"
                onClick={() => {
                  if (!newAlias.trim()) return;
                  addAlias.mutate(
                    { admin_area_id: area.id, alias: newAlias.trim() },
                    { onSuccess: () => setNewAlias(""), onError: (e: any) => toast.error(e.message) },
                  );
                }}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex justify-between pt-3 border-t border-border/40">
            <Button
              variant="ghost" size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => {
                if (confirm(`Delete "${area.name}"? Children lose their parent link.`)) {
                  del.mutate(
                    { id: area.id, versionId: area.boundary_version_id },
                    { onSuccess: () => { toast.success("Deleted"); onClose(); }, onError: (e: any) => toast.error(e.message) },
                  );
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
              <Button size="sm" onClick={save} disabled={upsert.isPending}>
                {upsert.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewAreaDialog({
  version, parent, onClose,
}: { version: BoundaryVersion; parent: AdminArea | null; onClose: () => void }) {
  const upsert = useUpsertAdminArea();
  const [name, setName] = useState("");
  const [type, setType] = useState<string>(parent ? nextTypeFor(parent.area_type) : "division");
  const [stable, setStable] = useState("");

  const create = () => {
    if (!name.trim()) return;
    upsert.mutate(
      {
        boundary_version_id: version.id,
        parent_id: parent?.id ?? null,
        country: version.country,
        province: version.province ?? parent?.province ?? "Balochistan",
        area_type: type, name: name.trim(),
        stable_key: stable.trim() || null,
        status: "current", geometry_status: "pending",
      } as any,
      {
        onSuccess: () => { toast.success("Added"); onClose(); },
        onError: (e: any) => toast.error(e.message),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono tracking-wider text-sm">
            New area {parent && <>— under {parent.name}</>}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Row label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)}
              className="h-8 text-xs font-mono bg-secondary border-border" />
          </Row>
          <Row label="Type">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-8 text-xs font-mono bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {AREA_TYPES.map((t) => <SelectItem key={t} value={t}>{areaTypeLabel(t)}</SelectItem>)}
              </SelectContent>
            </Select>
          </Row>
          <Row label="Stable key">
            <Input value={stable} onChange={(e) => setStable(e.target.value)}
              placeholder="optional" className="h-8 text-xs font-mono bg-secondary border-border" />
          </Row>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={create} disabled={upsert.isPending || !name.trim()}>Create</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function nextTypeFor(parentType: string): string {
  const order = ["division", "district", "subdivision", "tehsil", "sub_tehsil"];
  const idx = order.indexOf(parentType);
  return order[Math.min(order.length - 1, idx + 1)];
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

/* ---------------------------- GeoJSON upload ---------------------------- */

function GeoJsonUploader({ areas, versionId }: { areas: AdminArea[]; versionId: string | null }) {
  const [features, setFeatures] = useState<
    { name: string | null; geometry: any; matchId: string | null; matchLabel: string }[]
  >([]);
  const [nameProp, setNameProp] = useState("name");
  const [keyProp, setKeyProp] = useState("stable_key");
  const [mark, setMark] = useState<"draft" | "verified">("draft");
  const [uploading, setUploading] = useState(false);

  const onFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseGeoJsonFeatures(text, nameProp);
      const rows = parsed.map((f) => {
        const props = f.properties as any;
        const rawName = (props?.[nameProp] as string) ?? null;
        const rawKey = (props?.[keyProp] as string) ?? null;
        let match: AdminArea | undefined;
        if (rawKey) match = areas.find((a) => a.stable_key === rawKey);
        if (!match && rawName) {
          const low = rawName.trim().toLowerCase();
          match = areas.find((a) => a.name.toLowerCase() === low);
        }
        return {
          name: rawName,
          geometry: (f.raw as any).geometry,
          matchId: match?.id ?? null,
          matchLabel: match ? `${areaTypeLabel(match.area_type)}: ${match.name}` : "— no match —",
        };
      });
      setFeatures(rows);
      toast.success(`Parsed ${rows.length} feature(s)`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const upload = async () => {
    if (!versionId) return;
    setUploading(true);
    let ok = 0, skipped = 0, failed = 0;
    for (const f of features) {
      if (!f.matchId || !f.geometry) { skipped++; continue; }
      const { error } = await supabase.rpc("set_admin_area_geometry", {
        _area_id: f.matchId, _geojson: f.geometry as any, _mark: mark,
      });
      if (error) { failed++; console.error(error); } else ok++;
    }
    setUploading(false);
    toast[failed ? "error" : "success"](
      `Uploaded ${ok}, skipped ${skipped}, failed ${failed}`,
    );
    setFeatures([]);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Row label="Name property">
          <Input value={nameProp} onChange={(e) => setNameProp(e.target.value)}
            className="h-8 text-xs font-mono bg-secondary border-border" />
        </Row>
        <Row label="Stable-key property">
          <Input value={keyProp} onChange={(e) => setKeyProp(e.target.value)}
            className="h-8 text-xs font-mono bg-secondary border-border" />
        </Row>
      </div>
      <label className="flex flex-col items-center justify-center border border-dashed border-border/60 rounded p-6 cursor-pointer hover:bg-secondary/30 transition-colors">
        <Upload className="h-6 w-6 text-muted-foreground mb-2" />
        <span className="text-xs font-mono text-muted-foreground">Choose .geojson file</span>
        <input
          type="file"
          accept=".geojson,.json,application/geo+json,application/json"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
      </label>
      {features.length > 0 && (
        <>
          <div className="max-h-64 overflow-y-auto rounded border border-border/40 divide-y divide-border/40">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-2 p-2 text-[11px] font-mono">
                {f.matchId ? <Check className="h-3.5 w-3.5 text-primary shrink-0" /> :
                  <span className="h-3.5 w-3.5 rounded-full border border-amber-500/50 shrink-0" />}
                <span className="flex-1">{f.name ?? "(no name)"}</span>
                <span className={f.matchId ? "text-primary" : "text-amber-500"}>{f.matchLabel}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Select value={mark} onValueChange={(v) => setMark(v as "draft" | "verified")}>
              <SelectTrigger className="w-32 h-8 text-xs font-mono bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={upload} disabled={uploading} className="gap-1.5">
              {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save matched polygons
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setFeatures([])}>Clear</Button>
          </div>
        </>
      )}
    </div>
  );
}

/* --------------------------- Version list panel --------------------------- */

function VersionsAdminPanel({ versions }: { versions: BoundaryVersion[] }) {
  return (
    <section className="rounded border border-border/60 bg-card/30">
      <div className="p-3 border-b border-border/40">
        <h2 className="text-sm font-semibold tracking-wide">Boundary versions</h2>
        <p className="text-[11px] text-muted-foreground">Only one version per province can be marked current.</p>
      </div>
      <div className="divide-y divide-border/40">
        {versions.map((v) => (
          <div key={v.id} className="flex items-center gap-3 px-3 py-2 text-xs font-mono">
            {v.is_current && <Star className="h-3 w-3 text-primary" fill="currentColor" />}
            <span className="flex-1">{v.name}</span>
            <span className="text-muted-foreground">{v.province ?? "—"}</span>
            <span className="text-muted-foreground">{v.effective_from}</span>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0">
              {v.is_current ? "current" : "historical"}
            </Badge>
          </div>
        ))}
      </div>
    </section>
  );
}
