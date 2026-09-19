import { memo, useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ExternalLink, MapPin, Calendar, Skull, AlertTriangle, FileText, Activity, Pencil } from "lucide-react";
import type { IncidentWithCoords } from "@/lib/types";
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS } from "@/lib/types";
import { EVENT_TYPE_ICONS } from "@/lib/eventIcons";
import { parseDateLocal } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useIncidentSources, getSourceShortName } from "@/hooks/useIncidentSources";
import { useMilitantCasualties } from "@/hooks/useMilitantCasualties";

interface Props {
  incident: IncidentWithCoords | null;
  onClose: () => void;
  onEdit?: (id: string) => void;
}

interface LinkedKia {
  id: string;
  name: string;
  rank: string | null;
  force_type: string;
  hometown_district: string | null;
  hometown_province: string | null;
}

function IntelPanelImpl({ incident, onClose, onEdit }: Props) {
  const [linkedKia, setLinkedKia] = useState<LinkedKia[]>([]);
  const [loading, setLoading] = useState(false);
  const { data: sources = [] } = useIncidentSources(incident?.id);
  const { data: allMilitants = [] } = useMilitantCasualties({ enabled: !!incident });
  const linkedMilitants = incident ? allMilitants.filter((m) => m.incident_id === incident.id) : [];
  const militantKilledCount = linkedMilitants.length || (incident?.others_killed ?? 0);
  const militantWoundedCount = incident?.others_injured ?? 0;

  useEffect(() => {
    if (!incident || incident.soldiers_killed === 0) {
      setLinkedKia([]);
      return;
    }
    setLoading(true);
    supabase
      .from("kia_soldiers")
      .select("id, name, rank, force_type, hometown_district, hometown_province")
      .eq("incident_id", incident.id)
      .then(({ data }) => {
        setLinkedKia((data as LinkedKia[]) || []);
        setLoading(false);
      });
  }, [incident]);

  if (!incident) return null;

  const Icon = EVENT_TYPE_ICONS[incident.event_type];
  const color = EVENT_TYPE_COLORS[incident.event_type];

  return (
    <Sheet open={!!incident} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md p-0 glass-strong border-l-border overflow-y-auto scrollbar-tactical">
        {/* Header */}
        <SheetHeader className="p-5 border-b border-border/60 space-y-3">
          <div className="flex items-start gap-3">
            <div
              className="shrink-0 flex h-12 w-12 items-center justify-center rounded-lg border-2"
              style={{ borderColor: color, background: `${color}20`, color, boxShadow: `0 0 24px ${color}50` }}
            >
              <Icon className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle asChild>
                <h2 className="font-display text-lg font-bold uppercase tracking-wider leading-tight" style={{ color }}>
                  {EVENT_TYPE_LABELS[incident.event_type]}
                </h2>
              </SheetTitle>
              <div className="flex items-center gap-2 mt-1 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                <Calendar className="h-3 w-3" />
                {format(parseDateLocal(incident.date), "dd MMM yyyy")}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs min-w-0">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="font-mono truncate">
                {[incident.location_name, incident.district, incident.province].filter(Boolean).join(", ")}
              </span>
            </div>
            {onEdit && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(incident.id)}
                className="h-7 gap-1.5 font-mono text-[10px] uppercase tracking-wider border-warning/40 text-warning hover:bg-warning/10 shrink-0"
              >
                <Pencil className="h-3 w-3" /> Edit
              </Button>
            )}
          </div>
        </SheetHeader>

        {/* Casualty grid */}
        <div className="grid grid-cols-2 gap-3 p-5 border-b border-border/60">
          <div className="glass rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Skull className="h-3.5 w-3.5 text-danger" />
              <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">KIA</p>
            </div>
            <p className="font-display text-3xl font-bold text-danger leading-none">{incident.soldiers_killed}</p>
          </div>
          <div className="glass rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
              <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">WIA</p>
            </div>
            <p className="font-display text-3xl font-bold text-warning leading-none">{incident.soldiers_injured}</p>
          </div>
          {militantKilledCount > 0 && (
            <div className="glass rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Skull className="h-3.5 w-3.5 text-success" />
                <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Militant KIA</p>
              </div>
              <p className="font-display text-3xl font-bold text-success leading-none">{militantKilledCount}</p>
            </div>
          )}
          {militantWoundedCount > 0 && (
            <div className="glass rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-3.5 w-3.5 text-success" />
                <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Militant WIA</p>
              </div>
              <p className="font-display text-3xl font-bold text-success leading-none">{militantWoundedCount}</p>
            </div>
          )}
        </div>


        {/* Summary */}
        <div className="p-5 border-b border-border/60 space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Incident Summary</h3>
          </div>
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{incident.summary}</p>
        </div>

        {/* Metadata */}
        <div className="p-5 border-b border-border/60 space-y-2">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Intelligence Metadata</h3>
          <div className="grid grid-cols-2 gap-y-2 font-mono text-[11px]">
            <span className="text-muted-foreground">Confidence</span>
            <span className="text-right text-foreground uppercase">{incident.confidence}</span>
            <span className="text-muted-foreground">Verification</span>
            <span className="text-right text-foreground uppercase">{incident.verification_status}</span>
            <span className="text-muted-foreground">Source Type</span>
            <span className="text-right text-foreground">{incident.source_type?.replace("_", " ")}</span>
            {incident.latitude && incident.longitude && (
              <>
                <span className="text-muted-foreground">Coordinates</span>
                <span className="text-right text-foreground">{incident.latitude.toFixed(3)}, {incident.longitude.toFixed(3)}</span>
              </>
            )}
          </div>
        </div>

        {/* Linked KIA */}
        {incident.soldiers_killed > 0 && (
          <div className="p-5 border-b border-border/60 space-y-2">
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-2">
              <Activity className="h-3 w-3" /> Linked Personnel ({linkedKia.length})
            </h3>
            {loading && <p className="font-mono text-[10px] text-muted-foreground">Loading...</p>}
            {!loading && linkedKia.length === 0 && (
              <p className="font-mono text-[10px] text-muted-foreground italic">No KIA records linked.</p>
            )}
            <div className="space-y-1.5">
              {linkedKia.map((s) => (
                <div key={s.id} className="flex items-center gap-2 p-2 rounded-md glass">
                  <div className="h-1.5 w-1.5 rounded-full bg-danger shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{s.rank ? `${s.rank} ` : ""}{s.name}</p>
                    <p className="font-mono text-[10px] text-muted-foreground truncate">
                      {s.force_type} · {[s.hometown_district, s.hometown_province].filter(Boolean).join(", ") || "Unknown hometown"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Linked Militants */}
        {linkedMilitants.length > 0 && (
          <div className="p-5 border-b border-border/60 space-y-2">
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-2">
              <Activity className="h-3 w-3" /> Linked Militants ({linkedMilitants.length})
            </h3>
            <div className="space-y-1.5">
              {linkedMilitants.map((m) => (
                <div key={m.id} className="flex items-center gap-2 p-2 rounded-md glass">
                  <div className="h-1.5 w-1.5 rounded-full bg-success shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {m.name || "Unknown"}{m.alias ? ` "${m.alias}"` : ""}
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground truncate">
                      {m.affiliation || "—"} · {[m.hometown_district, m.hometown_province].filter(Boolean).join(", ") || "Unknown hometown"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}


        {/* Sources */}
        {(sources.length > 0 || incident.source_url) && (
          <div className="p-5">
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              Sources ({sources.length || 1})
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              {(sources.length > 0
                ? sources
                : [{
                    id: "primary",
                    url: incident.source_url!,
                    kind: "other" as const,
                    label: null,
                    is_primary: true,
                  }]
              ).map((s: any) => {
                const host = getSourceShortName(s.url);
                return (
                  <a
                    key={s.id}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-xs transition-colors ${
                      s.is_primary
                        ? "border-primary/50 bg-primary/10 text-primary hover:bg-primary/20"
                        : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                    title={s.url}
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    <span>{host}</span>
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

const IntelPanel = memo(IntelPanelImpl);
export default IntelPanel;
