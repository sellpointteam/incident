import { memo, useMemo, useRef, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { IncidentWithCoords } from "@/lib/types";
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS } from "@/lib/types";
import { EVENT_TYPE_ICONS } from "@/lib/eventIcons";
import { parseDateLocal } from "@/lib/utils";
import { economicDamageSummary } from "@/lib/economicDamage";
import { useIncidentCounts } from "@/hooks/useIncidentCounts";
import { Activity, ArrowUpRight, Pencil } from "lucide-react";

interface Props {
  incidents: IncidentWithCoords[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
  onShowDetails?: (id: string) => void;
  onHover?: (id: string | null) => void;
  onEdit?: (id: string) => void;
}

const ROW_HEIGHT = 96;

function LiveIncidentFeedImpl({ incidents, activeId, onSelect, onShowDetails, onHover, onEdit }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);

  const sorted = useMemo(
    () => [...incidents].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [incidents]
  );

  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    getItemKey: (i) => sorted[i].id,
  });


  // Auto-scroll to active item
  useEffect(() => {
    if (!activeId) return;
    const idx = sorted.findIndex((i) => i.id === activeId);
    if (idx >= 0) virtualizer.scrollToIndex(idx, { align: "center", behavior: "smooth" });
  }, [activeId, sorted, virtualizer]);

  const items = virtualizer.getVirtualItems();
  const visibleIds = useMemo(
    () => items.map((vi) => sorted[vi.index]?.id).filter(Boolean) as string[],
    [items, sorted],
  );
  const { data: counts } = useIncidentCounts(visibleIds);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
          </span>
          <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground">Live Intel Feed</h3>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">{sorted.length} events</span>
      </div>

      <div ref={parentRef} className="flex-1 overflow-y-auto scrollbar-tactical">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Activity className="h-6 w-6 mb-2 opacity-40" />
            <p className="font-mono text-xs">No events match filters</p>
          </div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
            {items.map((vi) => {
              const inc = sorted[vi.index];
              const Icon = EVENT_TYPE_ICONS[inc.event_type];
              const color = EVENT_TYPE_COLORS[inc.event_type];
              const active = activeId === inc.id;
              const irregKilled = counts?.irregular.get(inc.id) ?? 0;
              const sfFromEntries = counts?.sf.get(inc.id) ?? 0;
              // Total recorded KIA = soldiers_killed; subtract irregulars to get SF (regulars).
              const sfKilled = Math.max(sfFromEntries, (inc.soldiers_killed ?? 0) - irregKilled);
              const militantKilled = counts?.militant.get(inc.id) ?? 0;
              const severity = sfKilled + irregKilled + inc.soldiers_injured;
              return (
                <button
                  key={vi.key}
                  data-index={vi.index}
                  ref={virtualizer.measureElement}
                  onClick={() => onSelect?.(inc.id)}
                  onMouseEnter={() => onHover?.(inc.id)}
                  onMouseLeave={() => onHover?.(null)}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${vi.start}px)`,
                  }}
                  className={`text-left px-3 py-2.5 border-b border-border/40 transition-colors group ${
                    active ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-secondary/40 border-l-2 border-l-transparent"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className="shrink-0 flex h-7 w-7 items-center justify-center rounded-md border"
                      style={{ borderColor: `${color}55`, background: `${color}15`, color }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] uppercase tracking-wider truncate" style={{ color }}>
                          {EVENT_TYPE_LABELS[inc.event_type]}
                        </span>
                        <span className="font-mono text-[9px] text-muted-foreground shrink-0">
                          {formatDistanceToNow(parseDateLocal(inc.date), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-xs text-foreground truncate mt-0.5">
                        {inc.district || "—"}, {inc.province}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 font-mono text-[10px]">
                        {inc.event_type === "economic_attack" ? (
                          <span className="text-warning">
                            {economicDamageSummary(inc.economic_damage) || "No damage reported"}
                          </span>
                        ) : (
                          <>
                            {sfKilled > 0 && (
                              <span className="text-danger">SF KIA <strong className="font-bold">{sfKilled}</strong></span>
                            )}
                            {irregKilled > 0 && (
                              <span className="text-orange-400">Irregulars KIA <strong className="font-bold">{irregKilled}</strong></span>
                            )}
                            {inc.soldiers_injured > 0 && (
                              <span className="text-warning">WIA <strong className="font-bold">{inc.soldiers_injured}</strong></span>
                            )}
                            {militantKilled > 0 && (
                              <span className="text-success">Militant KIA <strong className="font-bold">{militantKilled}</strong></span>
                            )}
                            {severity === 0 && militantKilled === 0 && (
                              <span className="text-muted-foreground">No casualties</span>
                            )}
                          </>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        {onShowDetails && (
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); onShowDetails(inc.id); }}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onShowDetails(inc.id); } }}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider text-primary border border-primary/30 hover:bg-primary/10 cursor-pointer"
                          >
                            Show details <ArrowUpRight className="h-2.5 w-2.5" />
                          </div>
                        )}
                        {onEdit && (
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); onEdit(inc.id); }}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onEdit(inc.id); } }}
                            title="Edit incident"
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider text-warning border border-warning/40 hover:bg-warning/10 cursor-pointer"
                          >
                            <Pencil className="h-2.5 w-2.5" /> Edit
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const LiveIncidentFeed = memo(LiveIncidentFeedImpl);
export default LiveIncidentFeed;
