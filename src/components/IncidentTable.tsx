import { memo, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { IncidentWithCoords } from "@/lib/types";
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS } from "@/lib/types";
import { economicDamageSummary } from "@/lib/economicDamage";
import { cn, parseDateLocal } from "@/lib/utils";
import { ArrowUp, ArrowDown, ExternalLink, Pencil } from "lucide-react";

interface Props {
  incidents: IncidentWithCoords[];
  onRowClick?: (id: string) => void;
  activeId?: string | null;
  onEdit?: (id: string) => void;
}

const ROW_HEIGHT = 44;
// grid template: Date | Type | Location | KIA | WIA | Summary | Actions
const COLS = "140px 130px 1fr 60px 60px 2fr 90px";

function IncidentTableImpl({ incidents, onRowClick, activeId, onEdit }: Props) {
  const [dateSort, setDateSort] = useState<"desc" | "asc">("desc");
  const parentRef = useRef<HTMLDivElement>(null);

  const sorted = useMemo(() => {
    const arr = [...incidents];
    arr.sort((a, b) => {
      const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
      return dateSort === "asc" ? diff : -diff;
    });
    return arr;
  }, [incidents, dateSort]);

  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
    getItemKey: (i) => sorted[i].id,
  });

  if (incidents.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground font-mono text-sm">
        No incidents match current filters.
      </div>
    );
  }

  const items = virtualizer.getVirtualItems();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {sorted.length} incidents (virtualized)
        </span>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        {/* Header */}
        <div
          className="grid items-center px-3 py-2 border-b border-border bg-muted/30 font-mono text-[10px] uppercase tracking-wider"
          style={{ gridTemplateColumns: COLS }}
        >
          <button
            onClick={() => setDateSort((d) => (d === "desc" ? "asc" : "desc"))}
            className="inline-flex items-center gap-1 text-left"
          >
            Date {dateSort === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
          </button>
          <span>Type</span>
          <span>Location</span>
          <span className="text-center">KIA</span>
          <span className="text-center">WIA</span>
          <span>Summary</span>
          <span className="text-center">Actions</span>
        </div>

        {/* Virtualized body */}
        <div ref={parentRef} className="overflow-y-auto scrollbar-tactical" style={{ height: 600 }}>
          <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
            {items.map((vi) => {
              const inc = sorted[vi.index];
              const dist = inc.district && !["not specified", "not_specified"].includes(inc.district.trim().toLowerCase())
                ? inc.district
                : inc.district
                  ? "Unknown"
                  : null;
              return (
                <div
                  key={vi.key}
                  onClick={() => onRowClick?.(inc.id)}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${vi.start}px)`,
                    height: ROW_HEIGHT,
                    gridTemplateColumns: COLS,
                  }}
                  className={cn(
                    "grid items-center px-3 border-b border-border cursor-pointer transition-colors hover:bg-secondary/40",
                    activeId === inc.id && "bg-primary/10 ring-1 ring-primary/30"
                  )}
                >
                  <div className="font-mono text-xs whitespace-nowrap truncate">
                    <span>{format(parseDateLocal(inc.date), "dd MMM yy")}</span>
                  </div>
                  <div>
                    <Badge
                      variant="outline"
                      className="font-mono text-[10px] border"
                      style={{
                        borderColor: EVENT_TYPE_COLORS[inc.event_type],
                        color: EVENT_TYPE_COLORS[inc.event_type],
                      }}
                    >
                      {EVENT_TYPE_LABELS[inc.event_type]}
                    </Badge>
                  </div>
                  <div className="text-xs truncate">
                    {dist && <span className="text-foreground">{dist}</span>}
                    {dist && inc.province && <span className="text-muted-foreground">, </span>}
                    {inc.province && <span className="text-muted-foreground">{inc.province}</span>}
                    {!dist && !inc.province && <span className="text-muted-foreground">—</span>}
                  </div>
                  {inc.event_type === "economic_attack" ? (
                    <div className="col-span-2 text-center font-mono text-[10px] text-warning truncate" title={economicDamageSummary((inc as any).economic_damage)}>
                      {economicDamageSummary((inc as any).economic_damage) || "—"}
                    </div>
                  ) : (
                    <>
                      <div className="text-center font-mono text-xs text-danger">{inc.soldiers_killed}</div>
                      <div className="text-center font-mono text-xs text-warning">{inc.soldiers_injured}</div>
                    </>
                  )}
                  <div className="text-xs truncate text-muted-foreground">{inc.summary}</div>
                  <div className="flex items-center justify-center gap-1">
                    {(inc as any).source_url && (
                      <a
                        href={(inc as any).source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center justify-center h-7 w-7 rounded-md text-primary hover:bg-primary/10 transition-colors"
                        title="Open primary source"
                        aria-label="Open primary source"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {onEdit && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onEdit(inc.id); }}
                        className="inline-flex items-center justify-center h-7 w-7 rounded-md text-warning hover:bg-warning/10 transition-colors"
                        title="Edit incident"
                        aria-label="Edit incident"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {!(inc as any).source_url && !onEdit && (
                      <span className="text-muted-foreground/40 font-mono text-xs">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const IncidentTable = memo(IncidentTableImpl);
export default IncidentTable;
