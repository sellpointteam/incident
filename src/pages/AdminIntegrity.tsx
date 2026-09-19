import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { invalidateAllCasualtyData } from "@/lib/casualtyInvalidation";
import { useToast } from "@/hooks/use-toast";

type Row = {
  id: string;
  date: string;
  district: string | null;
  province: string;
  soldiers_killed: number;
  linked: number;
};

const IRREGULAR_TYPES = new Set(["Pro-State Militia"]);

export default function AdminIntegrity() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "integrity"],
    staleTime: 30_000,
    queryFn: async () => {
      const [{ data: incidents, error: e1 }, { data: kia, error: e2 }] = await Promise.all([
        supabase.from("incidents").select("id,date,district,province,soldiers_killed,irregulars_killed"),
        supabase.from("kia_soldiers").select("id,name,incident_id,date_of_death,force_type"),
      ]);
      if (e1) throw e1; if (e2) throw e2;

      const uniformed = new Map<string, number>();
      const irregular = new Map<string, number>();
      const orphans: { id: string; name: string; date_of_death: string }[] = [];
      const dateMismatches: { id: string; name: string; date_of_death: string; incident_date: string }[] = [];
      const incMap = new Map((incidents || []).map((i: any) => [i.id, i]));

      (kia || []).forEach((k: any) => {
        if (!k.incident_id || !incMap.has(k.incident_id)) {
          orphans.push({ id: k.id, name: k.name, date_of_death: k.date_of_death });
          return;
        }
        const isIrr = k.force_type && IRREGULAR_TYPES.has(k.force_type);
        const target = isIrr ? irregular : uniformed;
        target.set(k.incident_id, (target.get(k.incident_id) || 0) + 1);
        const inc = incMap.get(k.incident_id) as any;
        if (inc && k.date_of_death && inc.date && k.date_of_death.slice(0, 7) !== inc.date.slice(0, 7)) {
          dateMismatches.push({ id: k.id, name: k.name, date_of_death: k.date_of_death, incident_date: inc.date });
        }
      });

      const mismatches: (Row & { irregulars_killed: number; linked_irr: number })[] = [];
      (incidents || []).forEach((i: any) => {
        const linked = uniformed.get(i.id) || 0;
        const linkedIrr = irregular.get(i.id) || 0;
        if (i.soldiers_killed !== linked || (i.irregulars_killed ?? 0) !== linkedIrr) {
          mismatches.push({
            id: i.id, date: i.date, district: i.district, province: i.province,
            soldiers_killed: i.soldiers_killed, linked,
            irregulars_killed: i.irregulars_killed ?? 0, linked_irr: linkedIrr,
          });
        }
      });

      return { mismatches, orphans, dateMismatches, totalIncidents: incidents?.length || 0, totalKia: kia?.length || 0 };
    },
  });

  const recalc = useMutation({
    mutationFn: async (incidentId: string) => {
      const { error } = await supabase.rpc("recalc_incident_counts", { _incident_id: incidentId });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAllCasualtyData(qc);
      toast({ title: "Recalculated", description: "Incident counts synced from KIA records." });
    },
    onError: (err: any) => toast({ title: "Recalc failed", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="container max-w-6xl mx-auto px-4 py-6 space-y-6">
      <SEO title="Data Integrity · SITREP.PK" description="Admin data integrity dashboard" path="/admin/integrity" />
      <div>
        <h1 className="font-mono text-xl tracking-wider">DATA INTEGRITY</h1>
        <p className="text-xs text-muted-foreground font-mono mt-1">
          Incident KIA count is auto-synced via DB trigger. This panel surfaces any residual drift.
        </p>
      </div>

      {isLoading ? (
        <p className="font-mono text-xs text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Incidents" value={data?.totalIncidents ?? 0} />
            <Stat label="KIA records" value={data?.totalKia ?? 0} />
            <Stat label="Count mismatches" value={data?.mismatches.length ?? 0} bad={(data?.mismatches.length ?? 0) > 0} />
            <Stat label="Orphan KIA" value={data?.orphans.length ?? 0} bad={(data?.orphans.length ?? 0) > 0} />
          </div>

          <Section title="Incidents where stored counts ≠ linked KIA counts">
            {data && data.mismatches.length === 0 ? (
              <Empty msg="All incidents match." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono text-[10px] uppercase">Date</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase">Location</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase text-right">SF (stored/linked)</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase text-right">Irr (stored/linked)</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.mismatches.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.date}</TableCell>
                      <TableCell className="font-mono text-xs">{[r.district, r.province].filter(Boolean).join(", ")}</TableCell>
                      <TableCell className="font-mono text-xs text-right">
                        <span className={r.soldiers_killed !== r.linked ? "text-destructive" : ""}>
                          {r.soldiers_killed} / {r.linked}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-right">
                        <span className={r.irregulars_killed !== r.linked_irr ? "text-destructive" : ""}>
                          {r.irregulars_killed} / {r.linked_irr}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-6 px-2 font-mono text-[10px] gap-1"
                          disabled={recalc.isPending}
                          onClick={() => recalc.mutate(r.id)}
                        >
                          <RefreshCw className="h-3 w-3" /> Recalc
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Section>


          <Section title="Orphan KIA (no linked incident)">
            {data && data.orphans.length === 0 ? (
              <Empty msg="No orphan KIA records." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono text-[10px] uppercase">Name</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase">Date of death</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.orphans.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs">{o.name}</TableCell>
                      <TableCell className="font-mono text-xs">{o.date_of_death}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Section>

          <Section title="KIA where date_of_death is in a different month than incident.date">
            {data && data.dateMismatches.length === 0 ? (
              <Empty msg="No date drift." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono text-[10px] uppercase">Name</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase">Date of death</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase">Incident date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.dateMismatches.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-xs">{d.name}</TableCell>
                      <TableCell className="font-mono text-xs">{d.date_of_death}</TableCell>
                      <TableCell className="font-mono text-xs">{d.incident_date}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Section>
        </>
      )}

      <p className="font-mono text-[10px] text-muted-foreground">
        <Link to="/admin" className="underline">← back to console</Link>
      </p>
    </div>
  );
}

function Stat({ label, value, bad }: { label: string; value: number; bad?: boolean }) {
  return (
    <Card className="p-3">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`font-mono text-2xl mt-1 ${bad ? "text-destructive" : ""}`}>{value}</p>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-4 space-y-3">
      <h2 className="font-mono text-sm tracking-wider flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
        {title}
      </h2>
      {children}
    </Card>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <p className="font-mono text-xs text-muted-foreground flex items-center gap-2">
      <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> {msg}
    </p>
  );
}
