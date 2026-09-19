import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Pencil, Trash2, Users2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useActors,
  useUpsertActor,
  useDeleteActor,
  buildActorLabel,
  type Actor,
  type ActorCategory,
} from "@/hooks/useActors";

const CATEGORIES: ActorCategory[] = ["group", "faction", "splinter", "other"];

interface Draft {
  id?: string;
  name: string;
  category: ActorCategory;
  parent_actor_id: string | null;
  aliases: string;
  active_from: string;
  active_to: string;
  notes: string;
}

const EMPTY: Draft = {
  name: "",
  category: "group",
  parent_actor_id: null,
  aliases: "",
  active_from: "",
  active_to: "",
  notes: "",
};

function toDraft(a: Actor): Draft {
  return {
    id: a.id,
    name: a.name,
    category: a.category,
    parent_actor_id: a.parent_actor_id,
    aliases: (a.aliases || []).join(", "),
    active_from: a.active_from ?? "",
    active_to: a.active_to ?? "",
    notes: a.notes ?? "",
  };
}

export default function AdminActors() {
  const { data: actors = [], isLoading } = useActors();
  const upsert = useUpsertActor();
  const del = useDeleteActor();
  const { toast } = useToast();

  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<Draft | null>(null);

  const byId = useMemo(() => {
    const m = new Map<string, Actor>();
    for (const a of actors) m.set(a.id, a);
    return m;
  }, [actors]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = [...actors].sort((a, b) =>
      buildActorLabel(a, byId).localeCompare(buildActorLabel(b, byId)),
    );
    if (!q) return list;
    return list.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.aliases || []).some((al) => al.toLowerCase().includes(q)),
    );
  }, [actors, filter, byId]);

  const groups = useMemo(() => actors.filter((a) => a.category === "group"), [actors]);

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    try {
      await upsert.mutateAsync({
        id: editing.id,
        name: editing.name.trim(),
        category: editing.category,
        parent_actor_id: editing.parent_actor_id || null,
        aliases: editing.aliases
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        active_from: editing.active_from || null,
        active_to: editing.active_to || null,
        notes: editing.notes || null,
      } as any);
      toast({ title: editing.id ? "Actor updated" : "Actor created" });
      setEditing(null);
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    }
  };

  const remove = async (a: Actor) => {
    if (!confirm(`Delete actor "${a.name}"? Linked incidents will keep their attribution as null.`)) return;
    try {
      await del.mutateAsync(a.id);
      toast({ title: "Deleted" });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-lg tracking-wider flex items-center gap-2">
            <Users2 className="h-5 w-5" /> ACTOR REGISTRY
          </h1>
          <p className="text-xs text-muted-foreground font-mono">
            Militant groups, factions, and splinters. Used for incident attribution (perpetrator / target).
          </p>
        </div>
        <Button
          size="sm"
          className="gap-2 font-mono text-xs"
          onClick={() => setEditing({ ...EMPTY })}
        >
          <Plus className="h-4 w-4" /> New actor
        </Button>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Search by name or alias…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-8 text-xs font-mono bg-secondary border-border"
        />
      </div>

      <Card className="divide-y divide-border/60">
        {isLoading && (
          <div className="p-6 text-center text-xs font-mono text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading actors…
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="p-6 text-center text-xs font-mono text-muted-foreground">
            No actors match.
          </div>
        )}
        {filtered.map((a) => {
          const parent = a.parent_actor_id ? byId.get(a.parent_actor_id) : null;
          return (
            <div key={a.id} className="p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm">{a.name}</span>
                  <Badge variant="outline" className="text-[10px] font-mono uppercase">
                    {a.category}
                  </Badge>
                  {parent && (
                    <span className="text-[10px] font-mono text-muted-foreground">
                      ← {parent.name}
                    </span>
                  )}
                </div>
                {a.aliases?.length > 0 && (
                  <p className="text-[10px] font-mono text-muted-foreground mt-1">
                    aka {a.aliases.join(", ")}
                  </p>
                )}
                {a.notes && (
                  <p className="text-[11px] text-muted-foreground mt-1">{a.notes}</p>
                )}
              </div>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setEditing(toDraft(a))}
                  aria-label="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => remove(a)}
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-mono tracking-wider">
              {editing?.id ? "EDIT ACTOR" : "NEW ACTOR"}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="font-mono text-[10px] uppercase text-muted-foreground">Name</label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="h-8 text-xs font-mono bg-secondary border-border"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-mono text-[10px] uppercase text-muted-foreground">Category</label>
                  <Select
                    value={editing.category}
                    onValueChange={(v) => setEditing({ ...editing, category: v as ActorCategory })}
                  >
                    <SelectTrigger className="h-8 text-xs font-mono bg-secondary border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="font-mono text-[10px] uppercase text-muted-foreground">Parent group</label>
                  <Select
                    value={editing.parent_actor_id ?? "__none__"}
                    onValueChange={(v) =>
                      setEditing({ ...editing, parent_actor_id: v === "__none__" ? null : v })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs font-mono bg-secondary border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— None —</SelectItem>
                      {groups
                        .filter((g) => g.id !== editing.id)
                        .map((g) => (
                          <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="font-mono text-[10px] uppercase text-muted-foreground">
                  Aliases (comma separated)
                </label>
                <Input
                  value={editing.aliases}
                  onChange={(e) => setEditing({ ...editing, aliases: e.target.value })}
                  className="h-8 text-xs font-mono bg-secondary border-border"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-mono text-[10px] uppercase text-muted-foreground">Active from</label>
                  <Input
                    type="date"
                    value={editing.active_from}
                    onChange={(e) => setEditing({ ...editing, active_from: e.target.value })}
                    className="h-8 text-xs font-mono bg-secondary border-border"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-mono text-[10px] uppercase text-muted-foreground">Active to</label>
                  <Input
                    type="date"
                    value={editing.active_to}
                    onChange={(e) => setEditing({ ...editing, active_to: e.target.value })}
                    className="h-8 text-xs font-mono bg-secondary border-border"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="font-mono text-[10px] uppercase text-muted-foreground">Notes</label>
                <Textarea
                  value={editing.notes}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  className="min-h-[80px] text-xs font-mono bg-secondary border-border"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditing(null)} className="font-mono text-xs">
              Cancel
            </Button>
            <Button onClick={save} disabled={upsert.isPending} className="gap-2 font-mono text-xs">
              {upsert.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
