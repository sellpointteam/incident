import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, FileJson, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type Format = "json" | "xlsx";

const PAGE = 1000;

async function fetchAll(table: string): Promise<any[]> {
  const rows: any[] = [];
  let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from(table as any)
      .select("*")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

function flatten(rows: any[]): any[] {
  return rows.map((r) => {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(r)) {
      out[k] = v && typeof v === "object" ? JSON.stringify(v) : v;
    }
    return out;
  });
}

function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportData(name: string, rows: any[], format: Format) {
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "json") {
    download(`${name}-${stamp}.json`, new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" }));
    return;
  }
  const ws = XLSX.utils.json_to_sheet(flatten(rows));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 30));
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  download(`${name}-${stamp}.xlsx`, new Blob([buf], { type: "application/octet-stream" }));
}

const DATASETS: { key: string; label: string; table: string; description: string }[] = [
  { key: "review-queue", label: "Review Queue", table: "pending_reviews", description: "All ingested posts pending or processed by moderators." },
  { key: "incidents", label: "Incidents", table: "incidents", description: "Confirmed incident records (published & unpublished)." },
  { key: "kia-soldiers", label: "KIA Soldiers", table: "kia_soldiers", description: "All recorded killed-in-action security personnel." },
];

export default function AdminExports() {
  const [busy, setBusy] = useState<string | null>(null);

  async function handle(key: string, table: string, format: Format) {
    const id = `${key}:${format}`;
    setBusy(id);
    try {
      const rows = await fetchAll(table);
      if (rows.length === 0) {
        toast.warning(`No rows found in ${table}`);
        return;
      }
      exportData(key, rows, format);
      toast.success(`Exported ${rows.length} rows`);
    } catch (e: any) {
      toast.error(e.message ?? "Export failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-mono uppercase tracking-wider flex items-center gap-2">
          <Download className="h-5 w-5" /> Data Exports
        </h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono">
          Download raw datasets as JSON or Excel for offline analysis.
        </p>
      </div>

      <div className="grid gap-4">
        {DATASETS.map((d) => (
          <Card key={d.key} className="p-4 flex items-center justify-between gap-4">
            <div>
              <div className="font-mono text-sm font-semibold uppercase tracking-wider">{d.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{d.description}</div>
              <div className="text-[10px] text-muted-foreground mt-1 font-mono">table: {d.table}</div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={() => handle(d.key, d.table, "json")}
                className="gap-1.5 font-mono text-xs"
              >
                {busy === `${d.key}:json` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileJson className="h-3.5 w-3.5" />}
                JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={() => handle(d.key, d.table, "xlsx")}
                className="gap-1.5 font-mono text-xs"
              >
                {busy === `${d.key}:xlsx` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
                Excel
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
