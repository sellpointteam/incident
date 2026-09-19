import { memo, useMemo } from "react";
import type { IncidentWithCoords } from "@/lib/types";
import { Crosshair, Skull, Flame, ShieldAlert, Info } from "lucide-react";
import AnimatedCounter from "@/components/AnimatedCounter";
import { motion } from "framer-motion";
import { IRREGULARS_TOOLTIP } from "@/lib/forces";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePublicStats, type PublicStatsFilters } from "@/hooks/usePublicStats";
import { parseDateLocal } from "@/lib/utils";

interface Props {
  incidents?: IncidentWithCoords[];
  compact?: boolean;
  filters?: PublicStatsFilters;
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(1, ...data);
  const w = 64;
  const h = 24;
  const step = w / Math.max(1, data.length - 1);
  const path = data
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)} ${(h - (v / max) * (h - 2) - 1).toFixed(1)}`)
    .join(" ");
  const areaPath = `${path} L${w} ${h} L0 ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-6 w-16 shrink-0" preserveAspectRatio="none">
      <path d={areaPath} fill={color} opacity={0.12} />
      <path d={path} fill="none" stroke={color} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatsBarImpl({ incidents, filters }: Props) {
  const { data: stats } = usePublicStats(filters ?? {});

  const totals = stats?.totals ?? { incidents: 0, sf_kia: 0, irregular_kia: 0, militant_kia: 0 };
  const series = stats?.series ?? { incidents: [], sf_kia: [], irregular_kia: [], militant_kia: [] };

  // 7-day delta on incidents (only meaningful when filters cover today)
  const weekDelta = useMemo(() => {
    const s = series.incidents ?? [];
    if (s.length < 14) return 0;
    const last7 = s.slice(-7).reduce((a, b) => a + b, 0);
    const prev7 = s.slice(0, 7).reduce((a, b) => a + b, 0);
    if (prev7 === 0) return last7 > 0 ? 100 : 0;
    return Math.round(((last7 - prev7) / prev7) * 100);
  }, [series.incidents]);

  // If the caller supplied an in-memory filtered list, prefer its count for
  // the headline "Incidents" number so filter UI feels instant. The series /
  // KIA / militant totals still come from the RPC.
  const incidentsTotal = incidents ? incidents.length : totals.incidents;

  const cards = [
    { label: "Incidents", value: incidentsTotal, icon: Crosshair, color: "text-primary", stroke: "hsl(38 95% 55%)", series: series.incidents, delta: weekDelta, tooltip: undefined as string | undefined },
    { label: "Security Force KIA", value: totals.sf_kia, icon: Skull, color: "text-danger", stroke: "hsl(0 78% 58%)", series: series.sf_kia, delta: undefined, tooltip: "Official uniformed personnel only: Army, Air Force, ASF, FC, Police/CTD, Rangers, Coast Guards." },
    { label: "Pro-State Irregulars KIA", value: totals.irregular_kia, icon: ShieldAlert, color: "text-orange-400", stroke: "hsl(28 92% 58%)", series: series.irregular_kia, delta: undefined, tooltip: IRREGULARS_TOOLTIP },
    { label: "Militant KIA", value: totals.militant_kia, icon: Flame, color: "text-success", stroke: "hsl(142 70% 45%)", series: series.militant_kia, delta: undefined, tooltip: undefined },
  ];

  // Avoid unused-import warning for parseDateLocal
  void parseDateLocal;

  return (
    <TooltipProvider delayDuration={150}>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {cards.map((c, idx) => (
        <motion.div
          key={c.label}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.04, duration: 0.25 }}
          className="relative group rounded-lg glass px-3 py-2.5 overflow-hidden hover:border-primary/40 transition-all"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-transparent to-primary/[0.04] pointer-events-none" />
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground flex items-center gap-1.5">
                <span className="inline-block h-1 w-1 rounded-full" style={{ background: c.stroke }} />
                {c.label}
                {c.tooltip && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="inline-flex items-center text-muted-foreground/70 hover:text-foreground" aria-label={`About ${c.label}`}>
                        <Info className="h-2.5 w-2.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
                      {c.tooltip}
                    </TooltipContent>
                  </Tooltip>
                )}
                {c.label === "Militant KIA" && (
                  <span className="ml-1 inline-flex items-center rounded-sm bg-success/15 px-1 py-0 font-mono text-[8px] uppercase tracking-wider text-success">
                    since June 2026
                  </span>
                )}
              </p>
              <c.icon className={`h-3 w-3 ${c.color} opacity-70`} />
            </div>
            <div className="flex items-end justify-between gap-2">
              <AnimatedCounter value={c.value} className={`font-mono text-2xl font-bold leading-none tracking-tight ${c.color}`} />
              {c.series && c.series.length > 0 ? <Sparkline data={c.series} color={c.stroke} /> : null}
            </div>
            {c.delta !== undefined && (
              <p className="mt-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                7d{" "}
                <span className={c.delta >= 0 ? "text-danger" : "text-success"}>
                  {c.delta >= 0 ? "▲" : "▼"} {Math.abs(c.delta)}%
                </span>
              </p>
            )}
          </div>
        </motion.div>
      ))}
    </div>
    </TooltipProvider>
  );
}

const StatsBar = memo(StatsBarImpl);
export default StatsBar;
