"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import {
  MonthlyStats, CategoryStat, CounterpartyStat,
  getMonthlyStats, getCategoryStats, getTopCounterparties,
} from "@/lib/api";
import { cn } from "@/lib/utils";

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}
function fmtShort(n: number) {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toFixed(0);
}
function monthLabel(m: string) {
  const [year, mon] = m.split("-");
  const d = new Date(parseInt(year), parseInt(mon) - 1, 1);
  return d.toLocaleDateString("de-DE", { month: "short", year: "2-digit" });
}

function buildMonthOptions(count = 24) {
  const opts = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
    opts.push({ value, label });
  }
  return opts;
}

// ── Custom Tooltips ───────────────────────────────────────────────────────────

function MonthTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-sm shadow-lg">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</p>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-sm shadow-lg">
      <p>{d.payload.icon} {d.name}</p>
      <p className="font-semibold">{fmt(d.value)}</p>
      <p className="text-muted-foreground">{d.payload.pct}%</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const monthOptions = buildMonthOptions(24);
  const currentMonth = monthOptions[0].value;

  const [rangeMonths, setRangeMonths] = useState(12);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [monthly, setMonthly] = useState<MonthlyStats[]>([]);
  const [expCats, setExpCats] = useState<CategoryStat[]>([]);
  const [topCp, setTopCp] = useState<CounterpartyStat[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, ec, cp] = await Promise.all([
        getMonthlyStats(rangeMonths),
        getCategoryStats(selectedMonth, "expense"),
        getTopCounterparties(selectedMonth, 8),
      ]);
      setMonthly(m);
      setExpCats(ec);
      setTopCp(cp);
    } finally {
      setLoading(false);
    }
  }, [rangeMonths, selectedMonth]);

  useEffect(() => { load(); }, [load]);

  const monthlyChartData = monthly.map(m => ({ ...m, name: monthLabel(m.month) }));
  const totalExp = expCats.reduce((s, c) => s + c.amount, 0);
  const expPieData = expCats.map(c => ({
    ...c,
    pct: totalExp > 0 ? ((c.amount / totalExp) * 100).toFixed(1) : "0",
  }));
  const selectedStats = monthly.find(m => m.month === selectedMonth);

  return (
    <div className="space-y-6">

      {/* Header + Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Auswertungen</h1>
        <div className="flex gap-3 items-center flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Monat:</span>
            <Select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-44 text-sm">
              {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Zeitraum:</span>
            <Select value={String(rangeMonths)} onChange={e => setRangeMonths(Number(e.target.value))} className="w-32 text-sm">
              <option value="6">6 Monate</option>
              <option value="12">12 Monate</option>
              <option value="24">24 Monate</option>
            </Select>
          </div>
        </div>
      </div>

      {/* KPI cards for selected month */}
      {selectedStats && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-5 text-center">
              <p className="text-xs text-muted-foreground mb-1">Einnahmen</p>
              <p className="text-2xl font-bold text-green-400">{fmt(selectedStats.income)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 text-center">
              <p className="text-xs text-muted-foreground mb-1">Ausgaben</p>
              <p className="text-2xl font-bold text-red-400">{fmt(selectedStats.expenses)}</p>
            </CardContent>
          </Card>
          <Card className={selectedStats.net >= 0 ? "border-green-500/30" : "border-red-500/30"}>
            <CardContent className="pt-5 text-center">
              <p className="text-xs text-muted-foreground mb-1">Netto</p>
              <p className={cn("text-2xl font-bold", selectedStats.net >= 0 ? "text-green-400" : "text-red-400")}>
                {fmt(selectedStats.net)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bar chart: Einnahmen vs Ausgaben */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Einnahmen vs. Ausgaben — letzte {rangeMonths} Monate</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Lade…</div>
          ) : monthly.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              Keine Daten — bitte zuerst Buchungen importieren.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyChartData} barGap={2} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={48} />
                <Tooltip content={<MonthTooltip />} cursor={{ fill: "hsl(var(--muted)/0.4)" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="income" name="Einnahmen" fill="#22c55e" radius={[3, 3, 0, 0]} />
                <Bar dataKey="expenses" name="Ausgaben" fill="#ef4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Line chart: Netto-Verlauf */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Netto-Verlauf</CardTitle>
        </CardHeader>
        <CardContent>
          {!loading && monthly.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthlyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={48} />
                <Tooltip content={<MonthTooltip />} />
                <Line type="monotone" dataKey="net" name="Netto" stroke="#3b82f6" strokeWidth={2}
                  dot={{ fill: "#3b82f6", r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
              {loading ? "Lade…" : "Keine Daten"}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bottom row: Donut + Top Empfänger */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Donut: Ausgaben nach Kategorie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ausgaben nach Kategorie</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Lade…</div>
            ) : expPieData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                Keine kategorisierten Ausgaben in diesem Monat
              </div>
            ) : (
              <div className="flex gap-4 items-center">
                <ResponsiveContainer width="55%" height={220}>
                  <PieChart>
                    <Pie data={expPieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                      paddingAngle={2} dataKey="amount" nameKey="name">
                      {expPieData.map((c, i) => <Cell key={i} fill={c.color} />)}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5 min-w-0">
                  {expPieData.slice(0, 8).map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
                      <span className="truncate text-muted-foreground flex-1">{c.icon} {c.name}</span>
                      <span className="font-medium tabular-nums flex-shrink-0">{fmt(c.amount)}</span>
                    </div>
                  ))}
                  {totalExp > 0 && (
                    <div className="flex items-center gap-2 text-sm pt-1.5 border-t border-border">
                      <span className="w-2.5 h-2.5 flex-shrink-0" />
                      <span className="flex-1 font-medium">Gesamt</span>
                      <span className="font-bold tabular-nums text-red-400">{fmt(totalExp)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Empfänger */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Empfänger (Ausgaben)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Lade…</div>
            ) : topCp.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                Keine Ausgaben in diesem Monat
              </div>
            ) : (
              <div className="space-y-3">
                {topCp.map((cp, i) => {
                  const maxAmt = topCp[0].amount;
                  const pct = (cp.amount / maxAmt) * 100;
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="truncate text-muted-foreground max-w-[200px]">{cp.counterparty}</span>
                        <span className="font-medium tabular-nums ml-2 flex-shrink-0">{fmt(cp.amount)}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-red-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
