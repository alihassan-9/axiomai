"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, ArrowRight, ArrowUpRight, Banknote, ChevronRight, FileCheck2,
  Lightbulb, ShieldAlert, Sparkles, TrendingUp,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api } from "@/lib/api";
import type { Audit, Summary, TrendPoint } from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui";

// --- animation helpers -------------------------------------------------------

/** Eased count-up to `target`; re-runs when the target changes. */
function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setValue(target * (1 - Math.pow(1 - p, 3))); // easeOutCubic
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

/** Animated neumorphic progress ring. */
function Gauge({ value, caption }: { value: number; caption: string }) {
  const radius = 76;
  const circ = 2 * Math.PI * radius;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setShown(value), 120);
    return () => clearTimeout(t);
  }, [value]);
  const display = Math.round(useCountUp(value, 1100));
  return (
    <div className="relative flex h-[200px] w-[200px] items-center justify-center">
      <div className="absolute inset-0 rounded-full neu-inset" />
      <svg width="200" height="200" className="relative -rotate-90">
        <circle cx="100" cy="100" r={radius} fill="none" stroke="#e8eaf1" strokeWidth="14" />
        <circle
          cx="100" cy="100" r={radius} fill="none" stroke="#6e7590" strokeWidth="14"
          strokeLinecap="round" strokeDasharray={circ}
          strokeDashoffset={circ - (shown / 100) * circ}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">{caption}</span>
        <span className="text-4xl font-bold tracking-tight text-zinc-800">{display}</span>
        <span className="text-xs font-medium text-zinc-400">%</span>
      </div>
    </div>
  );
}

function DeltaBadge({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null) return null;
  const good = invert ? value <= 0 : value >= 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[11px] font-bold",
      good ? "text-emerald-500" : "text-red-500")}>
      <ArrowUpRight className={cn("h-3 w-3", value < 0 && "rotate-90")} />
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function periodDelta(values: number[]): number | null {
  if (values.length < 4) return null;
  const mid = Math.floor(values.length / 2);
  const prev = values.slice(0, mid).reduce((a, b) => a + b, 0);
  const cur = values.slice(mid).reduce((a, b) => a + b, 0);
  if (prev === 0) return cur > 0 ? 100 : 0;
  return ((cur - prev) / prev) * 100;
}

const fmtTime = (d: string) => new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

// --- page --------------------------------------------------------------------

export default function DashboardPage() {
  const summary = useQuery({
    queryKey: ["summary"],
    queryFn: async () => (await api.get<Summary>("/reports/summary")).data,
    refetchInterval: 20000, // near real-time
  });
  const trends = useQuery({
    queryKey: ["trends"],
    queryFn: async () => (await api.get<TrendPoint[]>("/reports/trends?days=30")).data,
    refetchInterval: 20000,
  });
  const audits = useQuery({
    queryKey: ["audits", "recent"],
    queryFn: async () => (await api.get<{ items: Audit[] }>("/audit?page=1&page_size=8")).data.items,
    refetchInterval: 20000,
  });

  const s = summary.data;
  const t = useMemo(() => trends.data ?? [], [trends.data]);
  const recent = useMemo(() => audits.data ?? [], [audits.data]);

  const auditSeries = t.map((p) => p.audits);
  const savingsSeries = t.map((p) => p.savings);
  // Always render a full last-7-days axis so the chart keeps its shape when
  // only a day or two has activity (merge real counts onto the calendar).
  const last7 = useMemo(() => {
    const byDate = new Map(t.map((p) => [p.date.slice(0, 10), p]));
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const pt = byDate.get(d.toISOString().slice(0, 10));
      return {
        day: d.toLocaleDateString("en-US", { weekday: "short" }),
        audits: pt?.audits ?? 0,
        violations: pt?.violations ?? 0,
      };
    });
  }, [t]);
  // Cumulative savings across every day of the window so the line spans the
  // axis (a single active day would otherwise render as one lonely dot).
  const savingsCurve = useMemo(() => {
    const byDate = new Map(t.map((p) => [p.date.slice(0, 10), p.savings]));
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      return d.toISOString().slice(0, 10);
    });
    return days.reduce<{ date: string; cumulative: number }[]>((acc, key) => {
      const prev = acc.length ? acc[acc.length - 1].cumulative : 0;
      acc.push({ date: key, cumulative: prev + (byDate.get(key) ?? 0) });
      return acc;
    }, []);
  }, [t]);

  const savingsCount = useCountUp(s?.total_savings ?? 0, 1000);
  const ordersCount = Math.round(useCountUp(s?.total_audits ?? 0, 1000));
  const violationsCount = Math.round(useCountUp(s?.total_violations ?? 0, 1000));
  const completionPct = s && s.total_audits ? Math.round((s.completed_audits / s.total_audits) * 100) : 0;

  // Derive AI-style insights from real audit data.
  const insights = useMemo(() => {
    if (!s) return [];
    const out: { icon: typeof Lightbulb; tone: string; title: string; body: string }[] = [];
    const topSaving = [...recent].sort((a, b) => b.savings_amount - a.savings_amount)[0];
    if (topSaving && topSaving.savings_amount > 0) {
      out.push({
        icon: Banknote, tone: "text-emerald-500",
        title: "Overcharge recovered",
        body: `${formatMoney(topSaving.savings_amount)} flagged on audit ${topSaving.id.slice(0, 8)} — verify before paying.`,
      });
    }
    if (s.compliance_score < 90) {
      out.push({
        icon: ShieldAlert, tone: "text-amber-500",
        title: "Compliance below target",
        body: `Score at ${s.compliance_score}% across ${s.total_violations} violation(s). Review flagged invoices.`,
      });
    }
    out.push({
      icon: Sparkles, tone: "text-brand-500",
      title: "AI suggestion",
      body: s.failed_audits > 0
        ? `${s.failed_audits} audit(s) failed verification — re-run after re-uploading clearer PDFs.`
        : `All ${s.completed_audits} completed audits passed clean. Upload more invoices to expand coverage.`,
    });
    return out.slice(0, 3);
  }, [s, recent]);

  return (
    <AppShell>
      {/* Header strip */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-5">
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 shadow-[0_8px_24px_rgba(90,97,120,0.35)]" />
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
              This month
              <span className="flex items-center gap-1 text-emerald-500">
                <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live
              </span>
            </div>
            <div className="flex items-end gap-1.5">
              <span className="text-4xl font-extrabold tracking-tight text-brand-900">
                {formatMoney(savingsCount)}
              </span>
              <span className="mb-1 font-serif text-xl font-normal italic text-brand-400">recovered</span>
            </div>
            <p className="text-xs text-zinc-500">
              {s ? `${s.completed_audits} completed audits · ${s.documents_processed} documents processed` : "Loading…"}
            </p>
          </div>
        </div>
        <div className="flex gap-4">
          <StatTile icon={FileCheck2} label="Total audits" value={String(ordersCount)}
            delta={periodDelta(auditSeries)} sub="vs prior 15 days" />
          <StatTile icon={ShieldAlert} label="Violations" value={String(violationsCount)}
            delta={periodDelta(t.map((p) => p.violations))} invert sub="lower is better" />
        </div>
      </div>

      {/* Primary card row */}
      <div className="grid auto-rows-fr gap-4 xl:grid-cols-4">
        {/* Featured: latest audit */}
        <div className="rise neu relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 p-6 text-white"
          style={{ animationDelay: "0ms" }}>
          {recent[0] && (
            <span className="absolute right-5 top-5 rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-800">
              {recent[0].status}
            </span>
          )}
          <div className="mb-10 flex h-32 items-center justify-center rounded-2xl bg-white/10">
            <FileCheck2 className="h-14 w-14 text-white/40" />
          </div>
          {recent[0] ? (
            <>
              <div className="text-lg font-bold">
                {recent[0].findings_json?.invoice?.vendor || "Latest audit"}
              </div>
              <div className="text-xs text-white/50">
                {recent[0].findings_json?.invoice?.invoice_number || recent[0].id.slice(0, 12)}
              </div>
              <div className="mt-4 text-2xl font-extrabold text-white">
                {formatMoney(recent[0].savings_amount)}
              </div>
              <div className="text-xs text-white/40">detected savings</div>
              <Link href={`/audit/${recent[0].id}`}
                className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-white/80 hover:text-white">
                Open audit <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </>
          ) : (
            <div className="text-sm text-white/60">No audits yet — upload an invoice to begin.</div>
          )}
        </div>

        {/* Audit volume */}
        <div className="rise neu rounded-3xl p-6" style={{ animationDelay: "60ms" }}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Audit volume</h3>
          <div className="mt-1 text-3xl font-extrabold tracking-tight text-zinc-900">
            {auditSeries.reduce((a, b) => a + b, 0)}
          </div>
          <div className="text-[11px] text-zinc-400">{completionPct}% completion rate</div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full neu-inset">
            <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-1000"
              style={{ width: `${completionPct}%` }} />
          </div>
          <div className="mt-4 h-36">
            {last7.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last7} barCategoryGap="28%">
                  <CartesianGrid vertical={false} stroke="#f1f1f5" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
                  <YAxis hide allowDecimals={false} />
                  <Tooltip cursor={{ fill: "rgba(90,97,120,0.07)" }}
                    contentStyle={{ borderRadius: 12, border: "1px solid #eee", fontSize: 12, boxShadow: "0 8px 24px rgba(20,18,45,0.12)" }} />
                  <Bar dataKey="audits" radius={[5, 5, 2, 2]} maxBarSize={34}>
                    {last7.map((_, i) => (
                      <Cell key={i} fill={i === last7.length - 1 ? "#5a6178" : "#d8dbe4"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState title="No data yet" />}
          </div>
        </div>

        {/* Compliance gauge */}
        <div className="rise neu flex flex-col items-center rounded-3xl p-6" style={{ animationDelay: "120ms" }}>
          <h3 className="self-start text-xs font-bold uppercase tracking-wider text-zinc-500">Compliance tracker</h3>
          <div className="my-2 flex flex-1 items-center">
            <Gauge value={s?.compliance_score ?? 0} caption="On track" />
          </div>
          <div className="flex w-full justify-between border-t border-zinc-100 pt-3 text-center">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-zinc-400">Passed</div>
              <div className="text-sm font-bold text-zinc-800">{s?.completed_audits ?? "—"}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-zinc-400">Status</div>
              <div className="text-sm font-bold text-emerald-500">
                {s && s.compliance_score >= 80 ? "On track" : "Review"}
              </div>
            </div>
          </div>
        </div>

        {/* Audit outcomes (Inventory Overview analog) */}
        <div className="rise neu rounded-3xl p-6" style={{ animationDelay: "180ms" }}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Audit outcomes</h3>
          <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl neu-inset p-3 text-center">
            <Mini label="Total" value={s?.total_audits ?? 0} />
            <Mini label="Failed" value={s?.failed_audits ?? 0} tone="text-amber-500" />
            <Mini label="Flags" value={s?.total_violations ?? 0} tone="text-red-500" />
          </div>
          <div className="mt-3 space-y-2">
            {recent.slice(0, 4).map((a) => (
              <Link key={a.id} href={`/audit/${a.id}`}
                className="flex items-center justify-between rounded-xl px-2 py-2 transition-colors hover:bg-zinc-50">
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-zinc-700">
                    {a.findings_json?.invoice?.vendor || `Audit ${a.id.slice(0, 6)}`}
                  </div>
                  <div className="text-[10px] text-zinc-400">{formatMoney(a.savings_amount)}</div>
                </div>
                <StockBadge status={a.status} />
              </Link>
            ))}
            {!recent.length && <p className="py-4 text-center text-xs text-zinc-400">No audits yet</p>}
          </div>
          <Link href="/audits"
            className="mt-2 flex items-center justify-center gap-1 rounded-xl neu-sm py-2 text-xs font-bold text-zinc-600 hover:text-brand-600">
            View all audits <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Secondary row */}
      <div className="mt-4 grid auto-rows-fr gap-4 xl:grid-cols-3">
        {/* Sales activity → recent audit timeline */}
        <div className="rise neu rounded-3xl p-6" style={{ animationDelay: "0ms" }}>
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
            <Activity className="h-4 w-4" /> Audit activity
          </h3>
          <div className="mt-4 space-y-1">
            {recent.slice(0, 5).map((a, i) => (
              <div key={a.id} className="flex items-center gap-3">
                <div className="w-14 shrink-0 text-[10px] font-medium text-zinc-400">{fmtTime(a.created_at)}</div>
                <div className="relative flex flex-col items-center self-stretch">
                  <span className="h-2.5 w-2.5 rounded-full bg-brand-400 ring-4 ring-brand-100" />
                  {i < Math.min(4, recent.length - 1) && <span className="w-px flex-1 bg-zinc-200" />}
                </div>
                <div className="flex flex-1 items-center justify-between py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-zinc-800">
                      {a.findings_json?.invoice?.vendor || "Invoice audit"}
                    </div>
                    <div className="text-[10px] uppercase text-zinc-400">{a.id.slice(0, 10)}</div>
                  </div>
                  <div className="text-sm font-bold text-zinc-700">{formatMoney(a.savings_amount)}</div>
                </div>
              </div>
            ))}
            {!recent.length && <EmptyState title="No activity yet" hint="Run an audit to see it here" />}
          </div>
        </div>

        {/* Savings performance area */}
        <div className="rise neu rounded-3xl p-6" style={{ animationDelay: "80ms" }}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Savings performance</h3>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-zinc-400">Recovered</div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold text-zinc-900">{formatMoney(s?.total_savings ?? 0)}</span>
                <DeltaBadge value={periodDelta(savingsSeries)} />
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-zinc-400">Avg / audit</div>
              <div className="text-xl font-extrabold text-zinc-900">
                {s && s.completed_audits ? formatMoney(s.total_savings / s.completed_audits) : "—"}
              </div>
            </div>
          </div>
          <div className="mt-4 h-40">
            {t.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={savingsCurve} margin={{ top: 8, right: 6, left: 6, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#f3f5f3" />
                  <XAxis dataKey="date" tickFormatter={(d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} minTickGap={28} />
                  <YAxis hide />
                  <Tooltip cursor={false} formatter={(v) => formatMoney(Number(v))}
                    contentStyle={{ borderRadius: 12, border: "1px solid #eee", fontSize: 12, boxShadow: "0 8px 24px rgba(20,18,45,0.12)" }} />
                  <Line type="natural" dataKey="cumulative" stroke="#6e7590" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <EmptyState title="No savings yet" />}
          </div>
        </div>

        {/* AI Insights */}
        <div className="rise neu rounded-3xl p-6" style={{ animationDelay: "160ms" }}>
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
            <Lightbulb className="h-4 w-4" /> AI insights
          </h3>
          <div className="mt-4 space-y-3">
            {insights.map((ins) => (
              <div key={ins.title} className="flex gap-3 rounded-2xl border border-zinc-100 bg-zinc-50/60 p-3">
                <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm", ins.tone)}>
                  <ins.icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-zinc-800">{ins.title}</div>
                  <div className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">{ins.body}</div>
                </div>
              </div>
            ))}
            {!insights.length && <EmptyState title="Insights appear after your first audit" />}
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[10px] text-zinc-400">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-400" /> Updated live
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="rise mt-4 flex flex-wrap items-center justify-between gap-6 rounded-3xl neu px-8 py-5"
        style={{ animationDelay: "0ms" }}>
        <div>
          <h2 className="text-2xl font-extrabold leading-tight tracking-tight text-brand-900">
            Run a new <span className="font-serif text-3xl font-normal italic text-brand-500">audit</span>
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400">
            <TrendingUp className="h-3.5 w-3.5" /> Upload an invoice and catch errors before you pay
          </p>
        </div>
        <Link href="/upload"
          className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-800 px-8 py-4 text-sm font-bold text-white shadow-[0_10px_30px_rgba(49,53,72,0.35)] transition-transform hover:scale-[1.03]">
          Upload &amp; audit <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </AppShell>
  );
}

// --- small components --------------------------------------------------------

function StatTile({ icon: Icon, label, value, delta, sub, invert }: {
  icon: React.ElementType; label: string; value: string;
  delta: number | null; sub: string; invert?: boolean;
}) {
  return (
    <div className="rise neu min-w-[170px] rounded-3xl p-5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{label}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl neu-sm text-brand-500">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-2 text-3xl font-extrabold tracking-tight text-zinc-900">{value}</div>
      <div className="mt-1 flex items-center gap-1.5">
        <DeltaBadge value={delta} invert={invert} />
        <span className="text-[10px] text-zinc-400">{sub}</span>
      </div>
    </div>
  );
}

function Mini({ label, value, tone = "text-zinc-800" }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <div className={cn("text-lg font-extrabold", tone)}>{value}</div>
      <div className="text-[9px] font-semibold uppercase tracking-wide text-zinc-400">{label}</div>
    </div>
  );
}

function StockBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "bg-brand-100 text-brand-800",
    running: "bg-brand-200 text-brand-800",
    pending: "bg-zinc-200 text-zinc-600",
    failed: "bg-red-200 text-red-700",
  };
  return (
    <span className={cn("rounded-md px-2 py-0.5 text-[9px] font-bold uppercase", map[status] ?? "bg-zinc-200 text-zinc-600")}>
      {status}
    </span>
  );
}
