/**
 * React-rendered Leaflet popup for incident markers (Phase 3 hardening).
 *
 * Why React instead of an HTML string:
 * - Eliminates the manual escape-every-field discipline that the old popup
 *   string required. JSX auto-escapes interpolated strings, so XSS via
 *   summary/location_name/etc. is structurally impossible.
 * - Lets the KIA section subscribe to React Query and render skeleton →
 *   data → empty states declaratively.
 * - Keeps the popup interactive without manual `addEventListener` /
 *   `removeEventListener` dance.
 *
 * The popup is mounted into a detached DOM node by `useMapMarkers`, then
 * handed to `L.popup().setContent(node)`.
 */
import { useState } from "react";
import { format } from "date-fns";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import type { IncidentWithCoords } from "@/lib/types";
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS } from "@/lib/types";
import { parseIncidentDate } from "@/lib/date";
import { safeUrl } from "@/lib/sanitize";
import { useKiaForIncident } from "@/hooks/queries/useKiaForIncident";
import { useActors } from "@/hooks/useActors";
import { economicDamageLines } from "@/lib/economicDamage";

function forceColor(ft: string): string {
  if (ft === "Army") return "#22c55e";
  if (ft === "Air Force") return "#0ea5e9";
  if (ft === "ASF") return "#f59e0b";
  if (ft === "Police/CTD") return "#3b82f6";
  if (ft === "FC") return "#ef4444";
  if (ft === "Rangers") return "#eab308";
  if (ft === "Coast Guards") return "#06b6d4";
  if (ft === "Pro-State Militia") return "#f97316";
  return "#94a3b8";
}

interface Props {
  incident: IncidentWithCoords;
}

function KiaSection({ incidentId }: { incidentId: string }) {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useKiaForIncident(incidentId, expanded);

  return (
    <>
      <div
        className="kia-toggle"
        style={{
          marginTop: 8,
          padding: "4px 8px",
          background: "#1e293b",
          borderRadius: 4,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          userSelect: "none",
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        <span style={{ fontSize: 10, fontWeight: 600, color: "#f8fafc" }}>
          ☠ KIA Details
        </span>
        <span style={{ fontSize: 10, color: "#64748b" }}>
          {expanded ? "▲" : "▼"}
        </span>
      </div>
      {expanded && (
        <div
          style={{
            marginTop: 4,
            maxHeight: 200,
            overflowY: "auto",
          }}
        >
          {isLoading || !data ? (
            <div
              style={{
                textAlign: "center",
                padding: 8,
                color: "#64748b",
                fontSize: 10,
              }}
            >
              Loading...
            </div>
          ) : data.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: 8,
                color: "#64748b",
                fontSize: 10,
              }}
            >
              No linked KIA records
            </div>
          ) : (
            data.map((s: any) => {
              const fc = forceColor(String(s.force_type ?? ""));
              const hometown =
                [s.hometown_district, s.hometown_province]
                  .filter(Boolean)
                  .join(", ") || "Unknown";
              return (
                <div
                  key={String(s.id ?? s.name)}
                  style={{
                    padding: "4px 6px",
                    borderBottom: "1px solid #1e293b",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: fc,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#f8fafc",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {String(s.name ?? "")}
                    </div>
                    <div style={{ fontSize: 9, color: "#64748b" }}>
                      {String(s.force_type ?? "")} · {hometown}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </>
  );
}

function AttributionRow({ incident }: { incident: IncidentWithCoords }) {
  const { data: actors = [] } = useActors();
  const perp = (incident as any).perpetrator_actor_id
    ? actors.find((a) => a.id === (incident as any).perpetrator_actor_id)
    : null;
  const target = (incident as any).target_actor_id
    ? actors.find((a) => a.id === (incident as any).target_actor_id)
    : null;
  if (!perp && !target) return null;
  return (
    <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid #334155", fontSize: 10, color: "#94a3b8", lineHeight: 1.5 }}>
      {perp && (
        <div>
          <span style={{ color: "#94a3b8" }}>Perpetrator / Target: </span>
          <span style={{ color: "#f59e0b", fontWeight: 600 }}>{perp.name}</span>
        </div>
      )}
      {target && (
        <div>
          <span style={{ color: "#94a3b8" }}>Target: </span>
          <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{target.name}</span>
        </div>
      )}
    </div>
  );
}


export function IncidentPopup({ incident: inc }: Props) {
  const color = EVENT_TYPE_COLORS[inc.event_type] || "#f59e0b";
  const label = EVENT_TYPE_LABELS[inc.event_type] || inc.event_type;
  const dateStr = format(parseIncidentDate(inc.date), "dd MMM yyyy");
  const url = inc.source_url ? safeUrl(inc.source_url) : null;
  const sfKilled = inc.soldiers_killed ?? 0;
  const sfWounded = inc.soldiers_injured ?? 0;
  const militantKilled = inc.others_killed ?? 0;
  const militantWounded = inc.others_injured ?? 0;
  const totalKilled = sfKilled + militantKilled;
  const totalWounded = sfWounded + militantWounded;
  const hasMilitantCasualties = militantKilled > 0 || militantWounded > 0;
  const damage = economicDamageLines((inc as any).economic_damage);

  return (
    <div
      style={{
        minWidth: 240,
        maxWidth: 320,
        fontFamily: "monospace",
        fontSize: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 6,
        }}
      >
        <span
          style={{
            display: "inline-block",
            height: 10,
            width: 10,
            borderRadius: "50%",
            background: color,
            boxShadow: `0 0 8px ${color}`,
          }}
        />
        <span
          style={{
            fontWeight: 600,
            color,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            fontSize: 11,
          }}
        >
          {label}
        </span>
      </div>
      <p style={{ fontSize: 10, color: "#94a3b8", margin: "0 0 4px" }}>
        {dateStr} · {inc.district || "—"}, {inc.province}
      </p>
      {inc.location_name && (
        <p style={{ fontSize: 11, color: "#94a3b8", margin: "0 0 4px" }}>
          {inc.location_name}
        </p>
      )}
      <p
        style={{
          fontSize: 11,
          margin: "0 0 6px",
          lineHeight: 1.4,
          color: "#e2e8f0",
        }}
      >
        {inc.summary}
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "2px 16px",
          paddingTop: 6,
          borderTop: "1px solid #334155",
        }}
      >
        <span style={{ fontSize: 10, color: "#94a3b8" }}>KIA</span>
        <span
          style={{
            fontSize: 10,
            textAlign: "right",
            fontWeight: 600,
            color: "#ef4444",
          }}
        >
          {totalKilled}
        </span>
        <span style={{ fontSize: 10, color: "#94a3b8" }}>WIA</span>
        <span
          style={{
            fontSize: 10,
            textAlign: "right",
            fontWeight: 600,
            color: "#f59e0b",
          }}
        >
          {totalWounded}
        </span>
        {hasMilitantCasualties && (
          <>
            <span style={{ fontSize: 10, color: "#94a3b8" }}>Militant KIA</span>
            <span style={{ fontSize: 10, textAlign: "right", fontWeight: 600, color: "#84cc16" }}>
              {militantKilled}
            </span>
            {militantWounded > 0 && (
              <>
                <span style={{ fontSize: 10, color: "#94a3b8" }}>Militant WIA</span>
                <span style={{ fontSize: 10, textAlign: "right", fontWeight: 600, color: "#a3e635" }}>
                  {militantWounded}
                </span>
              </>
            )}
          </>
        )}
      </div>
      {damage.length > 0 && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid #334155" }}>
          <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 2 }}>Damage</div>
          {damage.map((d) => (
            <div key={d.label} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span style={{ fontSize: 10, color: "#94a3b8" }}>{d.label}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: "#eab308" }}>{d.count}</span>
            </div>
          ))}
        </div>
      )}
      <AttributionRow incident={inc} />
      {sfKilled > 0 && <KiaSection incidentId={inc.id} />}
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 10,
            color: "#38bdf8",
            marginTop: 6,
            display: "block",
          }}
        >
          Source ↗
        </a>
      )}
    </div>
  );
}

/** Wrap the popup in a QueryClientProvider so it can use React Query. */
export function IncidentPopupRoot(props: Props & { queryClient: QueryClient }) {
  const { queryClient, ...rest } = props;
  return (
    <QueryClientProvider client={queryClient}>
      <IncidentPopup {...rest} />
    </QueryClientProvider>
  );
}
