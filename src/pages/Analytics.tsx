import { useMemo } from "react";
import { motion } from "framer-motion";
import { useIncidents } from "@/hooks/useIncidents";
import { useKiaSoldiers } from "@/hooks/useKiaSoldiers";
import { useMilitantCasualties, categorizeAffiliation } from "@/hooks/useMilitantCasualties";
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS } from "@/lib/types";
import { isIrregularForce } from "@/lib/forces";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend, Label,
} from "recharts";
import { format, parseISO, startOfMonth, addDays } from "date-fns";
import { normalizeProvince, normalizeDistrict } from "@/lib/normalize";
import { TrendingUp, MapPin, Crosshair, Users, AlertTriangle, Activity, ShieldAlert, Flame, Swords } from "lucide-react";
import AnimatedCounter from "@/components/AnimatedCounter";
import { Loader2 } from "lucide-react";
import SEO from "@/components/SEO";


export default function Analytics() {
  const { data: incidents, isLoading } = useIncidents();
  const { data: kia } = useKiaSoldiers();
  const { data: militants } = useMilitantCasualties();



  const data = useMemo(() => {
    if (!incidents) return null;

    // Daily timeline — continuous from project start (2026-01-01) to today.
    // New days are added automatically as the date rolls over.
    const START = new Date(2026, 0, 1);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const bucketKey = (d: Date): string => format(d, "yyyy-MM-dd");
    const labelFor = (key: string): string => format(parseISO(key), "dd MMM");

    // Seed every day from START → today with zeros
    const byBucket = new Map<string, { date: string; kia: number; wia: number; events: number }>();
    let cursor = new Date(START);
    while (cursor.getTime() <= today.getTime()) {
      const k = bucketKey(cursor);
      if (!byBucket.has(k)) byBucket.set(k, { date: k, kia: 0, wia: 0, events: 0 });
      cursor = addDays(cursor, 1);
    }
    incidents.forEach((i) => {
      const d = parseISO(i.date);
      if (d < START || d > today) return;
      const k = bucketKey(d);
      const cur = byBucket.get(k) || { date: k, kia: 0, wia: 0, events: 0 };
      cur.kia += i.soldiers_killed;
      cur.wia += i.soldiers_injured;
      cur.events += 1;
      byBucket.set(k, cur);
    });
    const timeline = [...byBucket.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({ ...d, label: labelFor(d.date) }));

    // By province
    const byProvince = new Map<string, { province: string; kia: number; wia: number; events: number }>();
    incidents.forEach((i) => {
      const p = normalizeProvince(i.province);
      const cur = byProvince.get(p) || { province: p, kia: 0, wia: 0, events: 0 };
      cur.kia += i.soldiers_killed;
      cur.wia += i.soldiers_injured;
      cur.events += 1;
      byProvince.set(p, cur);
    });
    const provinces = [...byProvince.values()].sort((a, b) => b.kia - a.kia);

    // Event type distribution (incident counts)
    const byType = new Map<string, number>();
    // Casualties (KIA) by event type
    const kiaByType = new Map<string, number>();
    incidents.forEach((i) => {
      byType.set(i.event_type, (byType.get(i.event_type) || 0) + 1);
      kiaByType.set(i.event_type, (kiaByType.get(i.event_type) || 0) + i.soldiers_killed);
    });
    const eventTypes = [...byType.entries()].map(([type, count]) => ({
      name: EVENT_TYPE_LABELS[type as keyof typeof EVENT_TYPE_LABELS],
      value: count,
      color: EVENT_TYPE_COLORS[type as keyof typeof EVENT_TYPE_COLORS],
    })).sort((a, b) => b.value - a.value);
    const casualtiesByType = [...kiaByType.entries()]
      .map(([type, value]) => ({
        name: EVENT_TYPE_LABELS[type as keyof typeof EVENT_TYPE_LABELS],
        value,
        color: EVENT_TYPE_COLORS[type as keyof typeof EVENT_TYPE_COLORS],
      }))
      .filter((e) => e.value > 0)
      .sort((a, b) => b.value - a.value);

    // Deadliest districts (top 10 by KIA)
    const byDistrict = new Map<string, number>();
    incidents.forEach((i) => {
      const d = normalizeDistrict(i.district) || "Unknown";
      byDistrict.set(d, (byDistrict.get(d) || 0) + i.soldiers_killed);
    });
    const topDistricts = [...byDistrict.entries()]
      .map(([district, kia]) => ({ district, kia }))
      .filter((d) => d.kia > 0)
      .sort((a, b) => b.kia - a.kia)
      .slice(0, 10);

    // Force ratios from KIA registry
    const forceMap = new Map<string, number>();
    kia?.forEach((s) => forceMap.set(s.force_type, (forceMap.get(s.force_type) || 0) + 1));
    const FORCE_COLORS: Record<string, string> = {
      "Army": "hsl(142 65% 48%)",
      "Air Force": "hsl(199 89% 48%)",
      "ASF": "hsl(38 92% 50%)",
      "Police/CTD": "hsl(195 85% 55%)",
      "FC": "hsl(0 78% 58%)",
      "Coast Guards": "hsl(38 95% 55%)",
      "Pro-State Militia": "hsl(22 90% 55%)",
    };
    const forces = [...forceMap.entries()]
      .map(([name, value]) => ({ name, value, fill: FORCE_COLORS[name] || "hsl(220 14% 50%)" }))
      .sort((a, b) => b.value - a.value);

    // KIA by hometown province
    const kiaProvMap = new Map<string, number>();
    kia?.forEach((s) => {
      const p = normalizeProvince(s.hometown_province);
      kiaProvMap.set(p, (kiaProvMap.get(p) || 0) + 1);
    });
    const kiaProvinces = [...kiaProvMap.entries()]
      .map(([province, count]) => ({ province, count }))
      .sort((a, b) => b.count - a.count);

    // KIA by hometown district (top 12)
    const kiaDistMap = new Map<string, number>();
    kia?.forEach((s) => {
      const d = normalizeDistrict(s.hometown_district);
      if (!d) return;
      kiaDistMap.set(d, (kiaDistMap.get(d) || 0) + 1);
    });
    const kiaDistricts = [...kiaDistMap.entries()]
      .map(([district, count]) => ({ district, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    // Monthly KIA & WIA — always monthly buckets, Jan 2026 → current month, auto-extends
    const monthlyMap = new Map<string, { key: string; kia: number; wia: number; militant_kia: number }>();
    let mCursor = new Date(2026, 0, 1);
    const endMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    while (mCursor.getTime() <= endMonth.getTime()) {
      const k = format(mCursor, "yyyy-MM");
      monthlyMap.set(k, { key: k, kia: 0, wia: 0, militant_kia: 0 });
      mCursor = new Date(mCursor.getFullYear(), mCursor.getMonth() + 1, 1);
    }
    incidents.forEach((i) => {
      const d = parseISO(i.date);
      if (d < START || d > today) return;
      const k = format(startOfMonth(d), "yyyy-MM");
      const cur = monthlyMap.get(k);
      if (!cur) return;
      cur.kia += i.soldiers_killed;
      cur.wia += i.soldiers_injured;
    });
    militants?.forEach((m) => {
      if (!m.date_of_death) return;
      const d = parseISO(m.date_of_death);
      if (d < START || d > today) return;
      const k = format(startOfMonth(d), "yyyy-MM");
      const cur = monthlyMap.get(k);
      if (!cur) return;
      cur.militant_kia += 1;
    });
    const monthlyKiaWia = [...monthlyMap.values()]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((m) => ({ ...m, label: format(parseISO(m.key + "-01"), "MMM yy") }));

    // Militants by ideology — Baloch separatists vs Islamist insurgents
    let balochTotal = 0;
    let islamistTotal = 0;
    let otherTotal = 0;
    const affilMap = new Map<string, number>();
    militants?.forEach((m) => {
      const cat = categorizeAffiliation(m.affiliation);
      if (cat === "baloch") balochTotal += 1;
      else if (cat === "islamist") islamistTotal += 1;
      else otherTotal += 1;
      const a = (m.affiliation || "Unknown").trim() || "Unknown";
      affilMap.set(a, (affilMap.get(a) || 0) + 1);
    });
    const ideologySplit = [
      { name: "Baloch Separatists", value: balochTotal, color: "hsl(0 78% 58%)" },
      { name: "Islamist Insurgents", value: islamistTotal, color: "hsl(142 65% 48%)" },
      ...(otherTotal > 0 ? [{ name: "Other / Unknown", value: otherTotal, color: "hsl(220 14% 50%)" }] : []),
    ].filter((s) => s.value > 0);
    const AFFIL_COLORS: Record<string, string> = {
      TTP: "hsl(0 0% 100%)",
      ISKP: "hsl(190 80% 50%)",
      BLA: "hsl(0 78% 58%)",
      BLF: "hsl(38 95% 55%)",
      BRG: "hsl(217 80% 55%)",
      UBA: "hsl(142 65% 48%)",
      BRAS: "hsl(200 70% 60%)",
      IMP: "hsl(271 80% 56%)",
      "Hafiz Gul Bahadur Group": "hsl(84 80% 45%)",
      "Lashkar-e-Islam": "hsl(330 80% 55%)",
    };
    const militantByAffiliation = [...affilMap.entries()]
      .map(([name, value]) => ({
        name,
        value,
        category: categorizeAffiliation(name),
        fill: AFFIL_COLORS[name] || "hsl(220 14% 50%)",
      }))
      .sort((a, b) => b.value - a.value);

    return { timeline, provinces, eventTypes, casualtiesByType, topDistricts, forces, kiaProvinces, kiaDistricts, monthlyKiaWia, ideologySplit, militantByAffiliation };
  }, [incidents, kia, militants]);



  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const totalIncidents = incidents?.length || 0;
  const totalRegularKia = kia?.filter((s) => !isIrregularForce(s.force_type)).length || 0;
  const totalIrregularKia = kia?.filter((s) => isIrregularForce(s.force_type)).length || 0;
  const totalMilitantKia = militants?.length || 0;
  const totalWia = data.timeline.reduce((s, t) => s + t.wia, 0);
  const bucketLabel = "Daily";


  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-7xl mx-auto">
      <SEO
        title="Analytics — Pakistani Casualty Tracker"
        description="Charts of Pakistani security force casualties by force branch, province, hometown, and event type."
        path="/analytics"
      />
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-1">
          <Activity className="h-5 w-5 text-primary" />
          <h1 className="font-display text-2xl font-bold tracking-wider uppercase">Intelligence Analytics</h1>
        </div>
        <p className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
          Aggregate metrics · {totalIncidents} incidents indexed · since 01 Jan 2026
        </p>
      </motion.div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard icon={Crosshair} label="Total Incidents" value={totalIncidents} color="text-primary" />
        <KpiCard icon={Users} label="Security Force KIA" value={totalRegularKia} color="text-danger" />
        <KpiCard icon={ShieldAlert} label="Pro-State Irregulars KIA" value={totalIrregularKia} color="text-orange-400" />
        <KpiCard icon={Flame} label="Militant KIA" value={totalMilitantKia} color="text-success" />
        <KpiCard icon={AlertTriangle} label="Wounded (WIA)" value={totalWia} color="text-warning" />
      </div>



      {/* Timeline */}
      <Panel title={`Incidents & Casualties Over Time · ${bucketLabel} · 01 Jan 2026 → today`} icon={TrendingUp}>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data.timeline} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="kiaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(0 78% 58%)" stopOpacity={0.5} />
                <stop offset="100%" stopColor="hsl(0 78% 58%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="evGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(38 95% 55%)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="hsl(38 95% 55%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 22%)" />
            <XAxis dataKey="label" stroke="hsl(215 16% 60%)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} interval="preserveStartEnd" minTickGap={32} />
            <YAxis stroke="hsl(215 16% 60%)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
            <Tooltip
              contentStyle={{
                background: "hsl(222 35% 8%)",
                border: "1px solid hsl(220 20% 22%)",
                borderRadius: 8,
                fontFamily: "JetBrains Mono",
                fontSize: 11,
                color: "hsl(210 30% 92%)",
              }}
              itemStyle={{ color: "hsl(210 30% 92%)" }}
            />
            <Area type="monotone" dataKey="events" stroke="hsl(38 95% 55%)" fill="url(#evGrad)" name="Incidents" />
            <Area type="monotone" dataKey="kia" stroke="hsl(0 78% 58%)" fill="url(#kiaGrad)" name="KIA" />
          </AreaChart>
        </ResponsiveContainer>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Province */}
        <Panel title="Casualties by Province">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.provinces} layout="vertical" margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 22%)" horizontal={false} />
              <XAxis type="number" stroke="hsl(215 16% 60%)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
              <YAxis dataKey="province" type="category" stroke="hsl(215 16% 60%)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} width={100} />
              <Tooltip
                contentStyle={{ background: "hsl(222 35% 8%)", border: "1px solid hsl(220 20% 22%)", borderRadius: 8, fontFamily: "JetBrains Mono", fontSize: 11, color: "hsl(210 30% 92%)" }}
                itemStyle={{ color: "hsl(210 30% 92%)" }}
              />
              <Bar dataKey="kia" fill="hsl(0 78% 58%)" name="KIA" radius={[0, 4, 4, 0]} />
              <Bar dataKey="wia" fill="hsl(38 95% 55%)" name="WIA" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        {/* Attack types */}
        <Panel title="Attack Type Distribution">
          {(() => {
            const total = data.eventTypes.reduce((s, e) => s + e.value, 0);
            const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
              if (percent < 0.04) return null;
              const RADIAN = Math.PI / 180;
              const r = innerRadius + (outerRadius - innerRadius) * 0.55;
              const x = cx + r * Math.cos(-midAngle * RADIAN);
              const y = cy + r * Math.sin(-midAngle * RADIAN);
              return (
                <text x={x} y={y} fill="hsl(222 35% 7%)" textAnchor="middle" dominantBaseline="central"
                  style={{ fontFamily: "JetBrains Mono", fontSize: 11, fontWeight: 700 }}>
                  {(percent * 100).toFixed(0)}%
                </text>
              );
            };
            return (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data.eventTypes}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    innerRadius={62}
                    outerRadius={105}
                    paddingAngle={2}
                    stroke="hsl(222 35% 7%)"
                    strokeWidth={2}
                    labelLine={false}
                    label={renderLabel}
                  >
                    {data.eventTypes.map((e, i) => <Cell key={i} fill={e.color} />)}
                    <Label
                      position="center"
                      content={({ viewBox }: any) => {
                        const { cx, cy } = viewBox;
                        return (
                          <g>
                            <text x={cx} y={cy - 8} textAnchor="middle" fill="hsl(215 16% 75%)"
                              style={{ fontFamily: "JetBrains Mono", fontSize: 10, letterSpacing: 1 }}>
                              TOTAL
                            </text>
                            <text x={cx} y={cy + 14} textAnchor="middle" fill="hsl(0 0% 98%)"
                              style={{ fontFamily: "JetBrains Mono", fontSize: 22, fontWeight: 700 }}>
                              {total}
                            </text>
                          </g>
                        );
                      }}
                    />
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "hsl(222 35% 8%)", border: "1px solid hsl(220 20% 22%)", borderRadius: 8, fontFamily: "JetBrains Mono", fontSize: 11, color: "hsl(210 30% 92%)" }}
                    itemStyle={{ color: "hsl(210 30% 92%)" }}
                    formatter={(value: number, name: string) => [`${value} (${((value / total) * 100).toFixed(1)}%)`, name]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    wrapperStyle={{ fontFamily: "JetBrains Mono", fontSize: 10, paddingTop: 8 }}
                    formatter={(value: string, entry: any) => (
                      <span style={{ color: "hsl(215 16% 75%)" }}>
                        {value} <span style={{ color: "hsl(215 16% 50%)" }}>· {((entry.payload.value / total) * 100).toFixed(0)}%</span>
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            );
          })()}
        </Panel>

        {/* Casualties by attack type */}
        <Panel title="Casualties (KIA) by Attack Type">
          {data.casualtiesByType.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={data.casualtiesByType} layout="vertical" margin={{ top: 5, right: 36, left: 30, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 22%)" horizontal={false} />
                <XAxis type="number" stroke="hsl(215 16% 60%)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
                <YAxis dataKey="name" type="category" stroke="hsl(215 16% 60%)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} width={120} />
                <Tooltip
                  cursor={{ fill: "hsl(220 20% 18% / 0.4)" }}
                  contentStyle={{ background: "hsl(222 35% 8%)", border: "1px solid hsl(220 20% 22%)", borderRadius: 8, fontFamily: "JetBrains Mono", fontSize: 11, color: "hsl(210 30% 92%)" }}
                  itemStyle={{ color: "hsl(210 30% 92%)" }}
                />
                <Bar dataKey="value" name="KIA" radius={[0, 4, 4, 0]} label={{ position: "right", fill: "hsl(215 16% 85%)", fontSize: 11, fontFamily: "JetBrains Mono", fontWeight: 700 }}>
                  {data.casualtiesByType.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[320px] text-muted-foreground font-mono text-xs">No data</div>
          )}
        </Panel>

        {/* Deadliest districts */}
        <Panel title="Deadliest Districts (KIA — Top 10)">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data.topDistricts} layout="vertical" margin={{ top: 5, right: 36, left: 50, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 22%)" horizontal={false} />
              <XAxis type="number" stroke="hsl(215 16% 60%)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
              <YAxis dataKey="district" type="category" stroke="hsl(215 16% 60%)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} width={110} />
              <Tooltip
                cursor={{ fill: "hsl(220 20% 18% / 0.4)" }}
                contentStyle={{ background: "hsl(222 35% 8%)", border: "1px solid hsl(220 20% 22%)", borderRadius: 8, fontFamily: "JetBrains Mono", fontSize: 11, color: "hsl(210 30% 92%)" }}
                itemStyle={{ color: "hsl(210 30% 92%)" }}
              />
              <Bar dataKey="kia" name="KIA" fill="hsl(0 78% 58%)" radius={[0, 4, 4, 0]} label={{ position: "right", fill: "hsl(215 16% 85%)", fontSize: 11, fontFamily: "JetBrains Mono", fontWeight: 700 }} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        {/* Force branch — horizontal bar */}
        <Panel title="Force Branch Casualty Distribution" icon={Users}>
          {data.forces.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={data.forces} layout="vertical" margin={{ top: 5, right: 30, left: 30, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 22%)" horizontal={false} />
                <XAxis type="number" stroke="hsl(215 16% 60%)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
                <YAxis dataKey="name" type="category" stroke="hsl(215 16% 60%)" tick={{ fontSize: 11, fontFamily: "JetBrains Mono" }} width={90} />
                <Tooltip
                  cursor={{ fill: "hsl(220 20% 18% / 0.4)" }}
                  contentStyle={{ background: "hsl(222 35% 8%)", border: "1px solid hsl(220 20% 22%)", borderRadius: 8, fontFamily: "JetBrains Mono", fontSize: 11, color: "hsl(210 30% 92%)" }}
                  itemStyle={{ color: "hsl(210 30% 92%)" }}
                />
                <Bar dataKey="value" name="KIA" radius={[0, 4, 4, 0]} label={{ position: "right", fill: "hsl(215 16% 75%)", fontSize: 10, fontFamily: "JetBrains Mono" }}>
                  {data.forces.map((f, i) => <Cell key={i} fill={f.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[320px] text-muted-foreground font-mono text-xs">No KIA registry data</div>
          )}
        </Panel>
      </div>

      {/* KIA Hometown Origins */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="KIA by Hometown Province" icon={MapPin}>
          {data.kiaProvinces.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={data.kiaProvinces} layout="vertical" margin={{ top: 5, right: 30, left: 30, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 22%)" horizontal={false} />
                <XAxis type="number" stroke="hsl(215 16% 60%)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
                <YAxis dataKey="province" type="category" stroke="hsl(215 16% 60%)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} width={110} />
                <Tooltip
                  cursor={{ fill: "hsl(220 20% 18% / 0.4)" }}
                  contentStyle={{ background: "hsl(222 35% 8%)", border: "1px solid hsl(220 20% 22%)", borderRadius: 8, fontFamily: "JetBrains Mono", fontSize: 11, color: "hsl(210 30% 92%)" }}
                  itemStyle={{ color: "hsl(210 30% 92%)" }}
                />
                <Bar dataKey="count" name="Soldiers" fill="hsl(195 85% 55%)" radius={[0, 4, 4, 0]} label={{ position: "right", fill: "hsl(215 16% 75%)", fontSize: 10, fontFamily: "JetBrains Mono" }} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[320px] text-muted-foreground font-mono text-xs">No KIA registry data</div>
          )}
        </Panel>

        <Panel title="KIA by Hometown District (Top 12)" icon={MapPin}>
          {data.kiaDistricts.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={data.kiaDistricts} layout="vertical" margin={{ top: 5, right: 30, left: 30, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 22%)" horizontal={false} />
                <XAxis type="number" stroke="hsl(215 16% 60%)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
                <YAxis dataKey="district" type="category" stroke="hsl(215 16% 60%)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} width={120} />
                <Tooltip
                  cursor={{ fill: "hsl(220 20% 18% / 0.4)" }}
                  contentStyle={{ background: "hsl(222 35% 8%)", border: "1px solid hsl(220 20% 22%)", borderRadius: 8, fontFamily: "JetBrains Mono", fontSize: 11, color: "hsl(210 30% 92%)" }}
                  itemStyle={{ color: "hsl(210 30% 92%)" }}
                />
                <Bar dataKey="count" name="Soldiers" fill="hsl(142 65% 48%)" radius={[0, 4, 4, 0]} label={{ position: "right", fill: "hsl(215 16% 75%)", fontSize: 10, fontFamily: "JetBrains Mono" }} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[320px] text-muted-foreground font-mono text-xs">No hometown data recorded</div>
          )}
        </Panel>
      </div>


      {/* Militants by ideology — Baloch separatists vs Islamist insurgents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Militant KIA · Baloch Separatists vs Islamist Insurgents" icon={Swords}>
          {data.ideologySplit.length > 0 ? (() => {
            const total = data.ideologySplit.reduce((s, e) => s + e.value, 0);
            return (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data.ideologySplit}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    innerRadius={62}
                    outerRadius={105}
                    paddingAngle={2}
                    stroke="hsl(222 35% 7%)"
                    strokeWidth={2}
                    labelLine={false}
                    label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
                      if (percent < 0.04) return null;
                      const RADIAN = Math.PI / 180;
                      const r = innerRadius + (outerRadius - innerRadius) * 0.55;
                      const x = cx + r * Math.cos(-midAngle * RADIAN);
                      const y = cy + r * Math.sin(-midAngle * RADIAN);
                      return (
                        <text x={x} y={y} fill="hsl(222 35% 7%)" textAnchor="middle" dominantBaseline="central"
                          style={{ fontFamily: "JetBrains Mono", fontSize: 11, fontWeight: 700 }}>
                          {(percent * 100).toFixed(0)}%
                        </text>
                      );
                    }}
                  >
                    {data.ideologySplit.map((e, i) => <Cell key={i} fill={e.color} />)}
                    <Label
                      position="center"
                      content={({ viewBox }: any) => {
                        const { cx, cy } = viewBox;
                        return (
                          <g>
                            <text x={cx} y={cy - 8} textAnchor="middle" fill="hsl(215 16% 75%)"
                              style={{ fontFamily: "JetBrains Mono", fontSize: 10, letterSpacing: 1 }}>
                              TOTAL
                            </text>
                            <text x={cx} y={cy + 14} textAnchor="middle" fill="hsl(0 0% 98%)"
                              style={{ fontFamily: "JetBrains Mono", fontSize: 22, fontWeight: 700 }}>
                              {total}
                            </text>
                          </g>
                        );
                      }}
                    />
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "hsl(222 35% 8%)", border: "1px solid hsl(220 20% 22%)", borderRadius: 8, fontFamily: "JetBrains Mono", fontSize: 11, color: "hsl(210 30% 92%)" }}
                    itemStyle={{ color: "hsl(210 30% 92%)" }}
                    formatter={(value: number, name: string) => [`${value} (${((value / total) * 100).toFixed(1)}%)`, name]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    wrapperStyle={{ fontFamily: "JetBrains Mono", fontSize: 10, paddingTop: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            );
          })() : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground font-mono text-xs">No militant casualty data</div>
          )}
        </Panel>

        <Panel title="Militant KIA by Group" icon={Flame}>
          {data.militantByAffiliation.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.militantByAffiliation} layout="vertical" margin={{ top: 5, right: 36, left: 30, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 22%)" horizontal={false} />
                <XAxis type="number" stroke="hsl(215 16% 60%)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} allowDecimals={false} />
                <YAxis dataKey="name" type="category" stroke="hsl(215 16% 60%)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} width={130} />
                <Tooltip
                  cursor={{ fill: "hsl(220 20% 18% / 0.4)" }}
                  contentStyle={{ background: "hsl(222 35% 8%)", border: "1px solid hsl(220 20% 22%)", borderRadius: 8, fontFamily: "JetBrains Mono", fontSize: 11, color: "hsl(210 30% 92%)" }}
                  itemStyle={{ color: "hsl(210 30% 92%)" }}
                  formatter={(value: number, _name: string, item: any) => {
                    const cat = item?.payload?.category;
                    const label = cat === "baloch" ? "Baloch Separatist" : cat === "islamist" ? "Islamist" : "Other";
                    return [`${value} · ${label}`, "KIA"];
                  }}
                />
                <Bar dataKey="value" name="KIA" radius={[0, 4, 4, 0]} label={{ position: "right", fill: "hsl(215 16% 85%)", fontSize: 11, fontFamily: "JetBrains Mono", fontWeight: 700 }}>
                  {data.militantByAffiliation.map((e, i) => <Cell key={i} fill={e.fill} stroke="hsl(220 20% 30%)" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground font-mono text-xs">No militant casualty data</div>
          )}
        </Panel>
      </div>


      {/* Monthly KIA, WIA & Militant KIA */}
      <Panel title="Monthly KIA, WIA & Militant KIA · Jan 2026 → current month" icon={TrendingUp}>

        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.monthlyKiaWia} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 22%)" />
            <XAxis dataKey="label" stroke="hsl(215 16% 60%)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
            <YAxis stroke="hsl(215 16% 60%)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "hsl(220 20% 18% / 0.4)" }}
              contentStyle={{ background: "hsl(222 35% 8%)", border: "1px solid hsl(220 20% 22%)", borderRadius: 8, fontFamily: "JetBrains Mono", fontSize: 11, color: "hsl(210 30% 92%)" }}
              itemStyle={{ color: "hsl(210 30% 92%)" }}
            />
            <Legend wrapperStyle={{ fontFamily: "JetBrains Mono", fontSize: 10, paddingTop: 8 }} />
            <Bar dataKey="kia" name="KIA" fill="hsl(0 78% 58%)" radius={[4, 4, 0, 0]} label={{ position: "top", fill: "hsl(215 16% 85%)", fontSize: 10, fontFamily: "JetBrains Mono", fontWeight: 700 }} />
            <Bar dataKey="wia" name="WIA" fill="hsl(38 95% 55%)" radius={[4, 4, 0, 0]} label={{ position: "top", fill: "hsl(215 16% 85%)", fontSize: 10, fontFamily: "JetBrains Mono", fontWeight: 700 }} />
            <Bar dataKey="militant_kia" name="Militant KIA" fill="hsl(142 70% 45%)" radius={[4, 4, 0, 0]} label={{ position: "top", fill: "hsl(215 16% 85%)", fontSize: 10, fontFamily: "JetBrains Mono", fontWeight: 700 }} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl glass p-4 hover:border-primary/40 transition-all"
    >
      <div className="flex items-center justify-between mb-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <AnimatedCounter value={value} className={`font-display text-3xl font-bold ${color}`} />
    </motion.div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon?: any; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl glass p-4 lg:p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon className="h-3.5 w-3.5 text-primary" />}
        <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground">{title}</h3>
      </div>
      {children}
    </motion.div>
  );
}
