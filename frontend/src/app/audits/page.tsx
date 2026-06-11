"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Audit } from "@/lib/types";
import { formatDate, formatMoney } from "@/lib/utils";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button, Card, EmptyState, Spinner, StatusBadge, Table } from "@/components/ui";

export default function AuditsPage() {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["audits", page],
    queryFn: async () =>
      (await api.get<{ items: Audit[]; meta: { total: number; page_size: number } }>(
        `/audit?page=${page}&page_size=20`,
      )).data,
    refetchInterval: 5000,
  });

  const totalPages = query.data ? Math.max(1, Math.ceil(query.data.meta.total / query.data.meta.page_size)) : 1;

  return (
    <AppShell>
      <PageHeader title="Audits" subtitle="Every audit run across your organisation" />
      <Card>
        {query.isLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : query.data?.items.length ? (
          <>
            <Table headers={["Audit", "Status", "Savings", "Created", "Completed", ""]}>
              {query.data.items.map((a) => (
                <tr key={a.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-mono text-xs">{a.id.slice(0, 12)}…</td>
                  <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                  <td className="px-4 py-3">{formatMoney(a.savings_amount)}</td>
                  <td className="px-4 py-3 text-zinc-500">{formatDate(a.created_at)}</td>
                  <td className="px-4 py-3 text-zinc-500">{formatDate(a.completed_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/audit/${a.id}`} className="text-xs font-medium text-brand-600 hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </Table>
            <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3">
              <span className="text-xs text-zinc-500">
                Page {page} of {totalPages} · {query.data.meta.total} audits
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" className="px-3 py-1 text-xs" disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button variant="secondary" className="px-3 py-1 text-xs" disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          </>
        ) : (
          <EmptyState title="No audits yet" hint="Run one from the Upload Center" />
        )}
      </Card>
    </AppShell>
  );
}
