import { memo, useState } from "react";
import { Activity, ChevronDown, ChevronUp } from "lucide-react";
import { rgbToCss } from "@/features/map/actorColors";
import type { ActivityGroup } from "@/hooks/useMilitantActivity";

interface Props {
  groups: ActivityGroup[];
  selected: Set<string>;
  loading?: boolean;
  enabled: boolean;
  onToggleEnabled: () => void;
  onToggleActor: (actorId: string) => void;
  onSoloActor: (actorId: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
}

function MapActivityControlImpl({
  groups,
  selected,
  loading,
  enabled,
  onToggleEnabled,
  onToggleActor,
  onSoloActor,
  onSelectAll,
  onClear,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute bottom-3 left-3 z-[1000] max-w-[calc(100%-1.5rem)] w-[220px] sm:w-[240px]">
      <div className="rounded-md glass-strong border border-border/60 overflow-hidden shadow-lg">
        <div className="flex items-stretch">
          <button
            onClick={() => {
              if (!enabled) setOpen(true);
              onToggleEnabled();
            }}
            title="Approximate historical activity footprint derived from attributed incidents."
            className={`flex-1 flex items-center gap-2 px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider transition-colors ${
              enabled ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Activity className="h-3 w-3" />
            Militant Activity
          </button>
          <button
            aria-label={open ? "Collapse activity groups" : "Expand activity groups"}
            onClick={() => setOpen((v) => !v)}
            className="px-2 text-muted-foreground hover:text-foreground border-l border-border/60"
          >
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          </button>
        </div>

        {open && enabled && (
          <div className="border-t border-border/60 px-2 py-2 space-y-1.5 max-h-[240px] overflow-y-auto">
            {loading && (
              <p className="font-mono text-[10px] text-muted-foreground px-0.5">Loading activity data…</p>
            )}
            {!loading && groups.length === 0 && (
              <p className="font-mono text-[10px] text-muted-foreground px-0.5">No attributed incidents.</p>
            )}
            {groups.map((g) => {
              const on = selected.has(g.actorId);
              return (
                <button
                  key={g.actorId}
                  onClick={() => onToggleActor(g.actorId)}
                  onDoubleClick={() => onSoloActor(g.actorId)}
                  title={`${g.name} — click to toggle, double-click to solo`}
                  aria-pressed={on}
                  className="w-full flex items-center gap-2 text-left rounded px-0.5 py-0.5 hover:bg-muted/40 transition-colors"
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full shrink-0 border transition-opacity ${
                      on ? "opacity-100" : "opacity-30"
                    }`}
                    style={{ backgroundColor: rgbToCss(g.color), borderColor: rgbToCss(g.color) }}
                  />
                  <span
                    className={`flex-1 font-mono text-[10px] uppercase tracking-wider truncate transition-colors ${
                      on ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {g.name}
                  </span>
                </button>
              );
            })}

            {groups.length > 0 && (
              <div className="flex gap-1.5 pt-1.5 border-t border-border/60">
                <button
                  onClick={onSelectAll}
                  className="flex-1 font-mono text-[9px] uppercase tracking-wider py-1 rounded border border-border/60 text-muted-foreground hover:text-foreground transition-colors"
                >
                  Select all
                </button>
                <button
                  onClick={onClear}
                  className="flex-1 font-mono text-[9px] uppercase tracking-wider py-1 rounded border border-border/60 text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear
                </button>
              </div>
            )}
            <p className="font-mono text-[9px] leading-snug text-muted-foreground/70 pt-1">
              Approximate historical activity footprint derived from attributed incidents — not territorial control.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export const MapActivityControl = memo(MapActivityControlImpl);
export default MapActivityControl;
