"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Banknote, FileCheck2, ShieldAlert, TrendingUp } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api } from "@/lib/api";
import type { Audit, Summary, TrendPoint } from "@/lib/types";
import { formatDate, formatMoney } from "@/lib/utils";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, CardHeader, EmptyState, Spinner, StatusBadge, Table } from "@/components/ui";

function StatCard({ icon: Icon, label, value, accent }: {
  icon: React.ElementType; label: string; value: string; accent: string;
}) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-xs text-zinc-500">{label}</div>
        <div className="text-xl font-semibold">{value}</div>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const summary = useQuery({
    queryKey: ["summary"],
    queryFn: async () => (await api.get<Summary>("/reports/summary")).data,
  });
  const trends = useQuery({
    queryKey: ["trends"],
    queryFn: async () => (await api.get<TrendPoint[]>("/reports/trends?days=30")).data,
  });
  const audits = useQuery({
    queryKey: ["audits", "recent"],
    queryFn: async () =>
      (await api.get<{ items: Audit[] }>("/audit?page=1&page_size=8")).data.items,
  });

  const s = summary.data;

  return (
    <AppShell>
      <PageHeader title="Dashboard" subtitle="Audit activity across your organisation" />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={FileCheck2} label="Total audits" accent="bg-brand-50 text-brand-600"
          value={s ? String(s.total_audits) : "…"} />
        <StatCard icon={TrendingUp} label="Compliance score" accent="bg-emerald-50 text-emerald-600"
          value={s ? `${s.compliance_score}%` : "…"} />
        <StatCard icon={Banknote} label="Detected savings" accent="bg-amber-50 text-amber-600"
          value={s ? formatMoney(s.total_savings) : "…"} />
        <StatCard icon={ShieldAlert} label="Violations" accent="bg-red-50 text-red-600"
          value={s ? String(s.total_violations) : "…"} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Audit volume" subtitle="Last 30 days" />
          <div className="h-64 p-4">
            {trends.data?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trends.data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="audits" fill="#3d6eec" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="violations" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="No audit activity yet" hint="Upload an invoice to get started" />
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Savings recovered" subtitle="Cumulative value of caught errors" />
          <div className="h-64 p-4">
            {trends.data?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends.data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatMoney(Number(v))} />
                  <Line type="monotone" dataKey="savings" stroke="#059669" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="No savings recorded yet" />
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Recent audits" action={
          <Link href="/audits" className="text-xs font-medium text-brand-600 hover:underline">View all</Link>
        } />
        {audits.isLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : audits.data?.length ? (
          <Table headers={["Audit", "Status", "Savings", "Created", ""]}>
            {audits.data.map((a) => (
              <tr key={a.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3 font-mono text-xs">{a.id.slice(0, 12)}…</td>
                <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                <td className="px-4 py-3">{formatMoney(a.savings_amount)}</td>
                <td className="px-4 py-3 text-zinc-500">{formatDate(a.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/audit/${a.id}`} className="text-xs font-medium text-brand-600 hover:underline">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState title="No audits yet" hint="Upload an invoice and run your first audit" />
        )}
      </Card>
    </AppShell>
  );
}
