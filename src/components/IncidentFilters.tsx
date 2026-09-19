import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EVENT_TYPE_LABELS, type EventType } from "@/lib/types";
import { Constants } from "@/integrations/supabase/types";

interface Filters {
  province: string;
  eventType: string;
  district: string;
  dateFrom: string;
  dateTo: string;
}

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
  provinces: string[];
  districts: string[];
  hideDateRange?: boolean;
}

export default function IncidentFilters({ filters, onChange, provinces, districts, hideDateRange }: Props) {
  const update = (key: keyof Filters, value: string) => onChange({ ...filters, [key]: value });

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <div className="space-y-1">
        <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Province</Label>
        <Select value={filters.province} onValueChange={(v) => { update("province", v); if (v !== filters.province) onChange({ ...filters, province: v, district: "all" }); }}>
          <SelectTrigger className="h-8 text-xs font-mono bg-secondary border-border">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Provinces</SelectItem>
            {provinces.filter(p => p && p.trim() !== "").map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">District</Label>
        <Select value={filters.district} onValueChange={(v) => update("district", v)}>
          <SelectTrigger className="h-8 text-xs font-mono bg-secondary border-border">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Districts</SelectItem>
            {districts.filter(d => d && d.trim() !== "").map((d) => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Event Type</Label>
        <Select value={filters.eventType} onValueChange={(v) => update("eventType", v)}>
          <SelectTrigger className="h-8 text-xs font-mono bg-secondary border-border">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Constants.public.Enums.event_type.filter((et) => et !== "raid").map((et) => (
              <SelectItem key={et} value={et}>{EVENT_TYPE_LABELS[et as EventType]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>


      {!hideDateRange && (
        <>
          <div className="space-y-1">
            <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">From Date</Label>
            <Input type="date" value={filters.dateFrom} onChange={(e) => update("dateFrom", e.target.value)} className="h-8 text-xs font-mono bg-secondary border-border" />
          </div>
          <div className="space-y-1">
            <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">To Date</Label>
            <Input type="date" value={filters.dateTo} onChange={(e) => update("dateTo", e.target.value)} className="h-8 text-xs font-mono bg-secondary border-border" />
          </div>
        </>
      )}
    </div>
  );
}
