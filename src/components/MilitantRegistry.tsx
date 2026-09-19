import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Loader2, Search, ExternalLink, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { parseDateLocal } from "@/lib/utils";
import {
  useMilitantCasualties,
  useDeleteMilitantCasualty,
  MILITANT_AFFILIATIONS,
  getMilitantAffiliationColor,
  categorizeAffiliation,
} from "@/hooks/useMilitantCasualties";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export default function MilitantRegistry() {
  const { isAdmin, isMilitantAdmin } = useAuth();
  const { toast } = useToast();
  const { data: rows, isLoading } = useMilitantCasualties();
  const del = useDeleteMilitantCasualty();
  const [search, setSearch] = useState("");
  const [affFilter, setAffFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const filtered = useMemo(() => {
    return (rows ?? []).filter((r) => {
      if (affFilter !== "all" && (r.affiliation || "") !== affFilter) return false;
      if (dateFrom && (!r.date_of_death || r.date_of_death < dateFrom)) return false;
      if (dateTo && (!r.date_of_death || r.date_of_death > dateTo)) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return [r.name, r.alias, r.affiliation, r.district, r.province, r.location_name]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [rows, search, affFilter, dateFrom, dateTo]);

  const canEdit = isAdmin || isMilitantAdmin;

  const totals = useMemo(() => {
    const all = rows ?? [];
    const baloch = all.filter((r) => categorizeAffiliation(r.affiliation) === "baloch");
    const islamist = all.filter((r) => categorizeAffiliation(r.affiliation) === "islamist");
    const other = all.filter((r) => categorizeAffiliation(r.affiliation) === "other");
    const byAff = (list: typeof all) => {
      const m = new Map<string, number>();
      for (const r of list) {
        const k = (r.affiliation || "Unknown").trim() || "Unknown";
        m.set(k, (m.get(k) ?? 0) + 1);
      }
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    };
    return {
      total: all.length,
      baloch: { count: baloch.length, breakdown: byAff(baloch) },
      islamist: { count: islamist.length, breakdown: byAff(islamist) },
      other: { count: other.length, breakdown: byAff(other) },
    };
  }, [rows]);

  return (
    <div className="space-y-3">
      {/* Totals header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatCard label="Total Militant KIA" value={totals.total} accent="text-foreground" />
        <StatCard
          label="Baloch Separatists"
          value={totals.baloch.count}
          accent="text-red-400"
          breakdown={totals.baloch.breakdown}
        />
        <StatCard
          label="Islamists"
          value={totals.islamist.count}
          accent="text-amber-400"
          breakdown={totals.islamist.breakdown}
        />
        <StatCard
          label="Other / Unspecified"
          value={totals.other.count}
          accent="text-muted-foreground"
          breakdown={totals.other.breakdown}
        />
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-mono text-base font-semibold tracking-wider">
          MILITANT CASUALTIES <span className="text-xs text-muted-foreground font-normal">({filtered.length} entries)</span>
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name/alias/area..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 w-56 text-xs font-mono bg-card border-border"
            />
          </div>
          <Select value={affFilter} onValueChange={setAffFilter}>
            <SelectTrigger className="h-8 w-44 text-xs font-mono bg-card border-border">
              <SelectValue placeholder="All Affiliations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Affiliations</SelectItem>
              {MILITANT_AFFILIATIONS.map((a) => (
                <SelectItem key={a} value={a} className="text-xs font-mono">{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="space-y-1">
            <Label className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">From Date</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 w-36 text-xs font-mono bg-card border-border"
            />
          </div>
          <div className="space-y-1">
            <Label className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">To Date</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 w-36 text-xs font-mono bg-card border-border"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground font-mono text-sm">No militant casualties recorded.</div>
      ) : (
        <div className="rounded-lg border border-border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="font-mono text-[10px] uppercase tracking-wider">Name</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider">Alias</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider">Affiliation</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider">Rank/Role</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider">Date</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider">Location</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider text-center">Source</TableHead>
                {canEdit && <TableHead className="font-mono text-[10px] uppercase tracking-wider text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id} className="border-border">
                  <TableCell className="font-mono text-xs font-semibold">{r.name || "Unknown"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.alias || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`font-mono text-[10px] ${getMilitantAffiliationColor(r.affiliation)}`}>
                      {r.affiliation || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.rank_role || "—"}</TableCell>
                  <TableCell className="font-mono text-xs whitespace-nowrap">
                    {r.date_of_death ? format(parseDateLocal(r.date_of_death), "dd MMM yy") : "—"}
                  </TableCell>
                  <TableCell className="text-xs">{[r.district, r.province].filter(Boolean).join(", ") || "—"}</TableCell>
                  <TableCell className="text-center">
                    {r.source_url ? (
                      <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        <ExternalLink className="h-3.5 w-3.5 inline" />
                      </a>
                    ) : "—"}
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete militant record?</AlertDialogTitle>
                              <AlertDialogDescription>This will permanently remove the record for {r.name || "Unknown"}.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={async () => {
                                  try { await del.mutateAsync(r.id); toast({ title: "Deleted" }); }
                                  catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
                                }}
                                className="bg-destructive text-destructive-foreground"
                              >Delete</AlertDialogAction>
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
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  breakdown,
}: {
  label: string;
  value: number;
  accent: string;
  breakdown?: [string, number][];
}) {
  return (
    <div className="rounded-lg border border-border bg-card/40 px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground truncate">{label}</span>
        <span className={`font-mono text-lg font-bold tabular-nums ${accent}`}>{value}</span>
      </div>
      {breakdown && breakdown.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-[9px] text-muted-foreground">
          {breakdown.map(([k, v]) => (
            <span key={k}><span className="text-foreground/80">{k}</span> {v}</span>
          ))}
        </div>
      )}
    </div>
  );
}
