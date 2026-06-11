"use client";

import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api } from "@/lib/api";
import type { Summary, TrendPoint } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
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
      <PageHeader title="Reports" subtitle="Analytics across audits, violations, and recovered value"
        action={<Button variant="secondary" onClick={() => void downloadCsv()}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>} />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <div className="text-xs text-zinc-500">Completed audits</div>
          <div className="mt-1 text-2xl font-semibold">{summary.data?.completed_audits ?? "…"}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs text-zinc-500">Compliance score</div>
          <div className="mt-1 text-2xl font-semibold">{summary.data ? `${summary.data.compliance_score}%` : "…"}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs text-zinc-500">Total recovered</div>
          <div className="mt-1 text-2xl font-semibold text-emerald-700">
            {summary.data ? formatMoney(summary.data.total_savings) : "…"}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Savings over time" subtitle="Last 90 days" />
        <div className="h-72 p-4">
          {trends.data?.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends.data}>
                <defs>
                  <linearGradient id="savingsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#059669" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatMoney(Number(v))} />
                <Area type="monotone" dataKey="savings" stroke="#059669" strokeWidth={2} fill="url(#savingsFill)" />
              </AreaChart>
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
                <td className="px-4 py-3 font-medium text-emerald-700">{formatMoney(item.savings)}</td>
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
