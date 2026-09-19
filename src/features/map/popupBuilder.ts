/**
 * Sanitized popup HTML builder for incident markers.
 *
 * Structural HTML is trusted (we author it). Every interpolated value
 * that originates from ingested OSINT data (summary, location_name,
 * district, province, names, etc.) is escaped via `escapeHtmlText` and
 * URLs are validated with `safeUrl`.
 */
import { format } from "date-fns";
import type { IncidentWithCoords } from "@/lib/types";
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS } from "@/lib/types";
import { safeUrl, escapeHtmlText as esc } from "@/lib/sanitize";
import { parseIncidentDate } from "@/lib/date";

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

export function buildIncidentPopupHtml(
  inc: IncidentWithCoords,
  kiaRows: Array<Record<string, any>> | null,
  expanded: boolean,
): string {
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
  const militantRows =
    militantKilled > 0 || militantWounded > 0
      ? `<span style="font-size:10px;color:#94a3b8;">Militant KIA</span><span style="font-size:10px;text-align:right;font-weight:600;color:#84cc16;">${militantKilled}</span>
         ${militantWounded > 0 ? `<span style="font-size:10px;color:#94a3b8;">Militant WIA</span><span style="font-size:10px;text-align:right;font-weight:600;color:#a3e635;">${militantWounded}</span>` : ""}`
      : "";

  const kiaInner =
    kiaRows == null
      ? `<div style="text-align:center;padding:8px;color:#64748b;font-size:10px;">Loading...</div>`
      : kiaRows.length === 0
      ? `<div style="text-align:center;padding:8px;color:#64748b;font-size:10px;">No linked KIA records</div>`
      : kiaRows
          .map((s) => {
            const fc = forceColor(String(s.force_type ?? ""));
            const hometown =
              [s.hometown_district, s.hometown_province].filter(Boolean).join(", ") ||
              "Unknown";
            return `<div style="padding:4px 6px;border-bottom:1px solid #1e293b;display:flex;align-items:center;gap:6px;">
              <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${fc};flex-shrink:0;"></span>
              <div style="flex:1;min-width:0;">
                <div style="font-size:11px;font-weight:600;color:#f8fafc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(String(s.name ?? ""))}</div>
                <div style="font-size:9px;color:#64748b;">${esc(String(s.force_type ?? ""))} · ${esc(hometown)}</div>
              </div></div>`;
          })
          .join("");

  return `
    <div style="min-width:240px;max-width:320px;font-family:monospace;font-size:12px;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
        <span style="display:inline-block;height:10px;width:10px;border-radius:50%;background:${color};box-shadow:0 0 8px ${color};"></span>
        <span style="font-weight:600;color:${color};letter-spacing:0.05em;text-transform:uppercase;font-size:11px;">${esc(label)}</span>
      </div>
      <p style="font-size:10px;color:#94a3b8;margin:0 0 4px;">
        ${dateStr} · ${esc(inc.district || "—")}, ${esc(inc.province)}
      </p>
      ${inc.location_name ? `<p style="font-size:11px;color:#94a3b8;margin:0 0 4px;">${esc(inc.location_name)}</p>` : ""}
      <p style="font-size:11px;margin:0 0 6px;line-height:1.4;color:#e2e8f0;">${esc(inc.summary)}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 16px;padding-top:6px;border-top:1px solid #334155;">
        <span style="font-size:10px;color:#94a3b8;">KIA</span><span style="font-size:10px;text-align:right;font-weight:600;color:#ef4444;">${totalKilled}</span>
        <span style="font-size:10px;color:#94a3b8;">WIA</span><span style="font-size:10px;text-align:right;font-weight:600;color:#f59e0b;">${totalWounded}</span>
        ${militantRows}
      </div>

      ${
        sfKilled > 0
          ? `<div class="kia-toggle" style="margin-top:8px;padding:4px 8px;background:#1e293b;border-radius:4px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;user-select:none;">
              <span style="font-size:10px;font-weight:600;color:#f8fafc;">☠ KIA Details</span>
              <span style="font-size:10px;color:#64748b;">${expanded ? "▲" : "▼"}</span>
            </div>
            <div class="kia-content" style="display:${expanded ? "block" : "none"};margin-top:4px;max-height:200px;overflow-y:auto;">
              ${kiaInner}
            </div>`
          : ""
      }
      ${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" style="font-size:10px;color:#38bdf8;margin-top:6px;display:block;">Source ↗</a>` : ""}
    </div>
  `;
}
