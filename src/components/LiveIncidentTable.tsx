import { memo, Fragment, useMemo, useState } from "react";
import { format } from "date-fns";
import { parseDateLocal } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2, UserX, Undo2, ExternalLink, ChevronLeft, ChevronRight, Link2 } from "lucide-react";
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS } from "@/lib/types";
import type { Incident } from "@/lib/types";
import { useIncidentCounts } from "@/hooks/useIncidentCounts";
import { useIncidentSourcesBulk, getSourceShortName } from "@/hooks/useIncidentSources";
import { economicDamageSummary } from "@/lib/economicDamage";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import IncidentSourcesManager from "@/components/admin/IncidentSourcesManager";

type ViewMode = "compact" | "paged" | "all";

interface Props {
  incidents: Incident[];
  isAdmin?: boolean;
  onEdit?: (inc: Incident) => void;
  onManageKia?: (inc: Incident) => void;
  onRequeue?: (inc: Incident) => void;
  onDelete?: (inc: Incident) => void;
  getKiaCount?: (incidentId: string) => number;
  defaultView?: ViewMode;
  pageSize?: number;
  compactSize?: number;
}

function LiveIncidentTableImpl({
  incidents, isAdmin = false, onEdit, onManageKia, onRequeue, onDelete, getKiaCount,
  defaultView = "paged", pageSize = 25, compactSize = 10,
}: Props) {
  const showActions = !!(onEdit || onManageKia || onRequeue || onDelete);
  const [view, setView] = useState<ViewMode>(defaultView);
  const [page, setPage] = useState(0);
  const [sortMode, setSortMode] = useState<"incident_date" | "created">("incident_date");

  const sortedIncidents = useMemo(() => {
    if (sortMode === "incident_date") return incidents;
    return [...incidents].sort((a, b) => {
      const av = new Date(((a as any).created_at ?? a.date) as string).getTime();
      const bv = new Date(((b as any).created_at ?? b.date) as string).getTime();
      return bv - av;
    });
  }, [incidents, sortMode]);

  const total = sortedIncidents.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  // Hard cap "all" mode — an unvirtualized table over thousands of rows freezes
  // the browser. Above the cap, "all" degrades to a big page so the admin
  // still sees everything they'd realistically scan without locking the tab.
  const ALL_CAP = 500;
  const visible = useMemo(() => {
    if (view === "compact") return sortedIncidents.slice(0, compactSize);
    if (view === "all") return sortedIncidents.slice(0, ALL_CAP);
    return sortedIncidents.slice(safePage * pageSize, (safePage + 1) * pageSize);
  }, [sortedIncidents, view, safePage, pageSize, compactSize]);

  // Fetch casualty counts and sources only for the rows currently visible on screen.
  const visibleIds = useMemo(() => visible.map((i) => i.id), [visible]);
  const { data: counts } = useIncidentCounts(visibleIds);
  const { data: sourcesMap } = useIncidentSourcesBulk(visibleIds);



  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 p-0.5 rounded-md glass">
          {([
            { k: "compact", label: `Compact (${Math.min(compactSize, total)})` },
            { k: "paged", label: `Paged (${pageSize}/page)` },
            { k: "all", label: `All (${total})` },
          ] as const).map((v) => (
            <button
              key={v.k}
              onClick={() => { setView(v.k); setPage(0); }}
              className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-colors ${
                view === v.k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 p-0.5 rounded-md glass">
          {([
            { k: "incident_date" as const, label: "Incident Date" },
            ...(isAdmin ? [{ k: "created" as const, label: "Recently Added" }] : []),
          ]).map((s) => (
            <button
              key={s.k}
              onClick={() => { setSortMode(s.k); setPage(0); }}
              className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-colors ${
                sortMode === s.k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              title={`Sort by ${s.label}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {view === "paged" && totalPages > 1 && (
          <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={safePage === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span>Page {safePage + 1} / {totalPages}</span>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={safePage >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    <div className="rounded-lg border border-border overflow-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="font-mono text-[10px] uppercase tracking-wider">Date</TableHead>
            <TableHead className="font-mono text-[10px] uppercase tracking-wider">Type</TableHead>
            <TableHead className="font-mono text-[10px] uppercase tracking-wider">Location</TableHead>
            <TableHead className="font-mono text-[10px] uppercase tracking-wider text-center">KIA</TableHead>
            <TableHead className="font-mono text-[10px] uppercase tracking-wider text-center">WIA</TableHead>
            {showActions && (
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-right">Actions</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.length === 0 && (
            <TableRow><TableCell colSpan={showActions ? 6 : 5} className="text-center text-muted-foreground font-mono text-xs py-8">No incidents match current filters.</TableCell></TableRow>
          )}
          {visible.map((inc) => {

            const namedMilitants = counts?.militant.get(inc.id) ?? 0;
            const militantKilled = Math.max(namedMilitants, (inc as any).others_killed ?? 0);
            const militantWounded = (inc as any).others_injured ?? 0;
            const irregKilled = counts?.irregular.get(inc.id) ?? 0;
            const sfFromEntries = counts?.sf.get(inc.id) ?? 0;
            const sfKilled = Math.max(sfFromEntries, (inc.soldiers_killed ?? 0) - irregKilled);
            const sfWounded = inc.soldiers_injured ?? 0;
            // The homepage/admin table does not always receive getKiaCount.
            // Fall back to the per-visible-row query so the manage-casualties
            // badge includes linked SF/irregular records, not only militants.
            const linkedForceKia = getKiaCount
              ? getKiaCount(inc.id)
              : sfFromEntries + irregKilled;
            const kiaCount = linkedForceKia + namedMilitants;
            const rowSources = sourcesMap?.get(inc.id) ?? [];
            const primarySource = rowSources.find((s) => s.is_primary) ?? rowSources[0] ?? null;
            const legacyUrl = (inc as any).source_url as string | undefined;
            const displaySources: Array<{ id: string; url: string; kind: string; label: string | null; is_primary: boolean }> =
              rowSources.length > 0
                ? rowSources.map((s) => ({ id: s.id, url: s.url, kind: s.kind, label: s.label, is_primary: s.is_primary }))
                : legacyUrl
                  ? [{ id: "legacy", url: legacyUrl, kind: (inc as any).source_type ?? "other", label: null, is_primary: true }]
                  : [];
            const primaryUrl = primarySource?.url ?? legacyUrl ?? null;
            return (
              <Fragment key={inc.id}>
                <TableRow
                  className="border-border border-b-0 cursor-pointer hover:bg-secondary/40"
                  onClick={() => { if (isAdmin && onEdit) onEdit(inc); }}
                >
                  <TableCell className="font-mono text-xs whitespace-nowrap align-top">
                    {format(parseDateLocal(inc.date), "dd MMM yy")}
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge
                      variant="outline"
                      className="font-mono text-[10px]"
                      style={{ borderColor: EVENT_TYPE_COLORS[inc.event_type], color: EVENT_TYPE_COLORS[inc.event_type] }}
                    >
                      {EVENT_TYPE_LABELS[inc.event_type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs align-top">
                    {[inc.district, inc.province].filter(Boolean).join(", ") || "—"}
                  </TableCell>
                  {inc.event_type === "economic_attack" ? (
                    <TableCell colSpan={2} className="text-center font-mono text-[10px] align-top text-warning">
                      {economicDamageSummary((inc as any).economic_damage) || "—"}
                    </TableCell>
                  ) : (
                    <>
                  <TableCell className="text-center font-mono text-xs align-top whitespace-nowrap">
                    {sfKilled === 0 && irregKilled === 0 && militantKilled === 0 ? (
                      <span className="text-muted-foreground">0</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        {sfKilled > 0 && (
                          <span className="text-danger" title="Security force KIA">{sfKilled}<span className="ml-0.5 text-[9px] opacity-70">SF</span></span>
                        )}
                        {irregKilled > 0 && (
                          <span className="text-orange-400" title="Pro-State Irregulars KIA (spies/informants/militias)">{irregKilled}<span className="ml-0.5 text-[9px] opacity-70">IRR</span></span>
                        )}
                        {(sfKilled > 0 || irregKilled > 0) && militantKilled > 0 && <span className="text-muted-foreground/40">/</span>}
                        {militantKilled > 0 && (
                          <span className="text-success" title="Militant KIA">{militantKilled}<span className="ml-0.5 text-[9px] opacity-70">M</span></span>
                        )}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center font-mono text-xs align-top whitespace-nowrap">
                    {sfWounded === 0 && militantWounded === 0 ? (
                      <span className="text-muted-foreground">0</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        {sfWounded > 0 && (
                          <span className="text-warning" title="Security force WIA">{sfWounded}<span className="ml-0.5 text-[9px] opacity-70">SF</span></span>
                        )}
                        {sfWounded > 0 && militantWounded > 0 && <span className="text-muted-foreground/40">/</span>}
                        {militantWounded > 0 && (
                          <span className="text-success/80" title="Militant WIA">{militantWounded}<span className="ml-0.5 text-[9px] opacity-70">M</span></span>
                        )}
                      </span>
                    )}
                  </TableCell>
                    </>
                  )}

                  {showActions && (
                    <TableCell className="text-right align-top">
                      <div className="flex justify-end gap-1">
                        {primaryUrl && (
                          <a
                            href={primaryUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center justify-center h-8 w-8 rounded-md text-primary hover:bg-primary/10 transition-colors"
                            title={primaryUrl}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {onEdit && (
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onEdit(inc); }} title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {onManageKia && (
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onManageKia(inc); }} className="relative" title="Manage KIA">
                            <UserX className="h-3.5 w-3.5" />
                            {kiaCount > 0 && (
                              <span className="absolute -top-1 -right-1 bg-danger text-danger-foreground text-[9px] font-mono rounded-full h-4 w-4 flex items-center justify-center">
                                {kiaCount}
                              </span>
                            )}
                          </Button>
                        )}
                        {onRequeue && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" title="Send back to review queue" onClick={(e) => e.stopPropagation()}>
                                <Undo2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Send back to queue?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will recreate a pending review with the incident's current data, then delete the incident and its KIA records.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={(e) => { e.stopPropagation(); onRequeue(inc); }}>Requeue</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        {onDelete && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" title="Delete" onClick={(e) => e.stopPropagation()}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete incident?</AlertDialogTitle>
                                <AlertDialogDescription>This action is logged for audit. The incident will be permanently removed.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={(e) => { e.stopPropagation(); onDelete(inc); }} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
                {(inc.summary || displaySources.length > 0 || isAdmin) && (
                  <TableRow className="border-border hover:bg-transparent">
                    <TableCell colSpan={showActions ? 6 : 5} className="pt-0 pb-3 text-xs text-muted-foreground leading-relaxed">
                      {inc.summary && <div>{inc.summary}</div>}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {displaySources.map((s) => {
                          const host = getSourceShortName(s.url);
                          return (
                            <a
                              key={s.id}
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border font-mono text-[10px] transition-colors ${
                                s.is_primary
                                  ? "border-primary/50 bg-primary/10 text-primary hover:bg-primary/20"
                                  : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary"
                              }`}
                              title={s.url}
                            >
                              <ExternalLink className="h-3 w-3" />
                              <span className="normal-case tracking-normal">{host}</span>
                            </a>
                          );
                        })}
                        {isAdmin && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <button
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/40 font-mono text-[10px] uppercase tracking-wider transition-colors"
                                title="Edit sources"
                              >
                                <Link2 className="h-3 w-3" />
                                <span>{displaySources.length === 0 ? "Add source" : "Edit sources"}</span>
                              </button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl" onClick={(e) => e.stopPropagation()}>
                              <DialogHeader>
                                <DialogTitle className="font-mono text-sm">Manage Sources</DialogTitle>
                              </DialogHeader>
                              <IncidentSourcesManager
                                incidentId={inc.id}
                                primaryUrl={(inc as any).source_url ?? null}
                              />
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
      {view === "paged" && (
        <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground px-1">
          <span>Showing {visible.length} of {total}</span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={safePage === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span>Page {safePage + 1} / {totalPages}</span>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={safePage >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


export default memo(LiveIncidentTableImpl);
