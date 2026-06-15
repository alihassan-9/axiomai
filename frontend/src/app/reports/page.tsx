"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Banknote, Download, FileCheck2, ShieldCheck } from "lucide-react";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api } from "@/lib/api";
import type { Summary, TrendPoint } from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button, Card, CardHeader, EmptyState, Spinner, Table } from "@/components/ui";

interface SavingsItem {
  audit_id: string;
  doc_id: string;
  savings: number;
  completed_at: string | null;
}

export default function ReportsPage() {
  const summary = useQuery({
    queryKey: ["summary"],
    queryFn: async () => (await api.get<Summary>("/reports/summary")).data,
  });
  const trends = useQuery({
    queryKey: ["trends", 90],
    queryFn: async () => (await api.get<TrendPoint[]>("/reports/trends?days=90")).data,
  });
  const savings = useQuery({
    queryKey: ["savings"],
    queryFn: async () =>
      (await api.get<{ total_savings: number; items: SavingsItem[] }>("/reports/savings")).data,
  });

  // Cumulative savings across every day of the 90-day window, so the chart
  // draws a continuous line instead of a single dot when data is sparse.
  const savingsCurve = useMemo(() => {
    const byDate = new Map((trends.data ?? []).map((p) => [p.date.slice(0, 10), p.savings]));
    const days = Array.from({ length: 90 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (89 - i));
      return d.toISOString().slice(0, 10);
    });
    return days.reduce<{ date: string; savings: number }[]>((acc, key) => {
      const prev = acc.length ? acc[acc.length - 1].savings : 0;
      acc.push({ date: key, savings: prev + (byDate.get(key) ?? 0) });
      return acc;
    }, []);
  }, [trends.data]);

  async function downloadCsv() {
    const response = await api.post("/reports/export?days=90", null, { responseType: "blob" });
    const url = URL.createObjectURL(response.data as Blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "audits-export.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell>
      <PageHeader title="Reports &" accent="insights" subtitle="Analytics across audits, violations, and recovered value"
        action={<Button variant="secondary" onClick={() => void downloadCsv()}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>} />

      <div className="grid gap-4 md:grid-cols-3">
        <StatTile icon={FileCheck2} label="Completed audits"
          value={summary.data?.completed_audits ?? "…"} />
        <StatTile icon={ShieldCheck} label="Compliance score"
          value={summary.data ? `${summary.data.compliance_score}%` : "…"} />
        <StatTile icon={Banknote} label="Total recovered" accent
          value={summary.data ? formatMoney(summary.data.total_savings) : "…"} />
      </div>

      <Card className="mt-6">
        <CardHeader title="Savings over time" subtitle="Cumulative recovered · last 90 days" />
        <div className="h-72 p-4">
          {trends.data?.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={savingsCurve} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0ee" />
                <XAxis dataKey="date" tickFormatter={(d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  tick={{ fontSize: 11, fill: "#a1a1aa" }} axisLine={false} tickLine={false} minTickGap={40} />
                <YAxis tick={{ fontSize: 11, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
                <Tooltip cursor={false} formatter={(v) => formatMoney(Number(v))}
                  labelFormatter={(d) => new Date(String(d)).toLocaleDateString("en-US", { month: "short", day: "numeric" })} />
                <Line type="natural" dataKey="savings" stroke="#6e7590" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="No data yet" />
          )}
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Top recoveries" subtitle="Audits that caught the largest overcharges" />
        {savings.isLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : savings.data?.items.length ? (
          <Table headers={["Audit", "Recovered", "Completed"]}>
            {savings.data.items.map((item) => (
              <tr key={item.audit_id} className="hover:bg-zinc-50">
                <td className="px-4 py-3">
                  <a href={`/audit/${item.audit_id}`} className="font-mono text-xs text-brand-600 hover:underline">
                    {item.audit_id.slice(0, 12)}…
                  </a>
                </td>
                <td className="px-4 py-3 font-medium text-brand-700">{formatMoney(item.savings)}</td>
                <td className="px-4 py-3 text-zinc-500">{item.completed_at?.slice(0, 10) ?? "—"}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState title="No recoveries yet" hint="Savings appear when audits detect overcharges" />
        )}
      </Card>
    </AppShell>
  );
}

function StatTile({ icon: Icon, label, value, accent }: {
  icon: React.ElementType; label: string; value: React.ReactNode; accent?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">{label}</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className={cn("mt-3 text-3xl font-bold tracking-tight", accent ? "text-brand-700" : "text-brand-900")}>
        {value}
      </div>
    </Card>
  );
}
