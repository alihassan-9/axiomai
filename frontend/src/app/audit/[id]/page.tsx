"use client";

import { use, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, Download, RefreshCw, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import type { Audit, ProgressEvent } from "@/lib/types";
import { useAuditStream } from "@/lib/use-audit-stream";
import { formatMoney } from "@/lib/utils";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Badge, Button, Card, CardHeader, EmptyState, Spinner } from "@/components/ui";

const AGENT_STEPS = [
  ["orchestrator", "Orchestrator", "Planning pipeline"],
  ["extraction", "Extraction Agent", "Parsing document structure"],
  ["math_audit", "Math Audit Agent", "Symbolic recomputation"],
  ["policy_check", "Policy Compliance Agent", "RAG policy evaluation"],
  ["correction", "Correction & Explainer", "Verification + narrative"],
] as const;

function LiveProgress({ events }: { events: ProgressEvent[] }) {
  const stepState = useMemo(() => {
    const state = new Map<string, string>();
    for (const e of events) state.set(e.step, e.status);
    return state;
  }, [events]);
  const failed = events.some((e) => e.step === "error");

  return (
    <Card>
      <CardHeader title="Live audit progress" subtitle="Agents stream results in real time" />
      <div className="space-y-1 p-5">
        {AGENT_STEPS.map(([key, name, hint]) => {
          const status = stepState.get(key);
          return (
            <div key={key} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
              {status === "completed" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : status === "running" ? (
                <Spinner className="h-5 w-5" />
              ) : failed ? (
                <XCircle className="h-5 w-5 text-red-400" />
              ) : (
                <Circle className="h-5 w-5 text-zinc-300" />
              )}
              <div>
                <div className="text-sm font-medium">{name}</div>
                <div className="text-xs text-zinc-500">{hint}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function InvoicePanel({ audit }: { audit: Audit }) {
  const invoice = audit.findings_json.invoice;
  const preview = useQuery({
    queryKey: ["preview", audit.doc_id],
    queryFn: async () => (await api.get<{ url: string }>(`/documents/${audit.doc_id}/preview`)).data.url,
  });

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader title="Source document" />
        {preview.data ? (
          <iframe src={preview.data} className="h-[480px] w-full" title="Invoice PDF" />
        ) : (
          <div className="flex h-40 items-center justify-center"><Spinner /></div>
        )}
      </Card>
      {invoice && (
        <Card>
          <CardHeader title="Extracted invoice"
            subtitle={`${audit.findings_json.extraction_method ?? ""} · confidence ${
              Math.round((audit.findings_json.extraction_confidence ?? 0) * 100)}%`} />
          <div className="p-5 text-sm">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><span className="text-zinc-500">Vendor</span><div className="font-medium">{invoice.vendor || "—"}</div></div>
              <div><span className="text-zinc-500">Invoice #</span><div className="font-medium">{invoice.invoice_number || "—"}</div></div>
              <div><span className="text-zinc-500">Date</span><div className="font-medium">{invoice.invoice_date || "—"}</div></div>
              <div><span className="text-zinc-500">Currency</span><div className="font-medium">{invoice.currency}</div></div>
            </div>
            <table className="mt-4 w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500">
                  <th className="py-2">Description</th><th>Qty</th><th>Unit</th><th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {invoice.line_items.map((item, i) => (
                  <tr key={i}>
                    <td className="max-w-[200px] truncate py-2">{item.description}</td>
                    <td>{item.quantity ?? "—"}</td>
                    <td>{formatMoney(item.unit_price)}</td>
                    <td className="text-right">{formatMoney(item.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 space-y-1 border-t border-zinc-200 pt-3 text-right text-xs">
              <div>Subtotal: <span className="font-medium">{formatMoney(invoice.subtotal)}</span></div>
              <div>Tax: <span className="font-medium">{formatMoney(invoice.tax_amount)}</span></div>
              <div className="text-sm">Grand total: <span className="font-semibold">{formatMoney(invoice.grand_total)}</span></div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function FindingsPanel({ audit }: { audit: Audit }) {
  const math = audit.findings_json.math_findings ?? [];
  const policy = audit.findings_json.policy_findings ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Mathematical verification"
          subtitle="Every relationship recomputed symbolically"
          action={audit.findings_json.math_passed
            ? <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">VERIFIED</Badge>
            : <Badge severity="critical">DISCREPANCIES</Badge>} />
        <div className="space-y-3 p-5">
          {math.length === 0 ? (
            <p className="text-sm text-emerald-700">✓ All arithmetic checks passed exactly.</p>
          ) : math.map((f, i) => (
            <div key={i} className="rounded-lg border border-red-100 bg-red-50/60 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-red-800">{f.check}</span>
                <Badge severity={f.severity}>{f.severity}</Badge>
              </div>
              <p className="mt-1 text-xs text-zinc-700">{f.citation}</p>
              {f.delta !== undefined && (
                <p className="mt-1 text-xs font-medium text-red-700">
                  Expected {formatMoney(f.expected)} · stated {formatMoney(f.actual)} · Δ {formatMoney(f.delta)}
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Policy compliance" subtitle="Structured rules + RAG over your policy documents" />
        <div className="space-y-3 p-5">
          {policy.length === 0 ? (
            <p className="text-sm text-emerald-700">✓ No policy violations detected.</p>
          ) : policy.map((f, i) => (
            <div key={i} className="rounded-lg border border-amber-100 bg-amber-50/60 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-900">
                  {f.policy_name || (f.source === "rag-llm" ? "Policy document (RAG)" : "Rule")}
                </span>
                <Badge severity={f.severity}>{f.severity}</Badge>
              </div>
              <p className="mt-1 text-xs text-zinc-700">{f.message}</p>
              {f.policy_quote && (
                <p className="mt-1 border-l-2 border-amber-300 pl-2 text-[11px] italic text-zinc-600">
                  “{f.policy_quote}”
                </p>
              )}
              {f.location && <p className="mt-1 text-[11px] text-zinc-500">{f.location}</p>}
            </div>
          ))}
        </div>
      </Card>

      {audit.savings_amount > 0 && (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-emerald-700">Detected overcharge</div>
          <div className="mt-1 text-2xl font-bold text-emerald-800">{formatMoney(audit.savings_amount)}</div>
          <p className="mt-1 text-xs text-emerald-700">Recoverable if disputed before payment.</p>
        </Card>
      )}

      {audit.narrative && (
        <Card>
          <CardHeader title="Audit narrative" subtitle="Explainable summary for finance managers" />
          <p className="whitespace-pre-wrap p-5 text-sm leading-relaxed text-zinc-700">{audit.narrative}</p>
        </Card>
      )}
    </div>
  );
}

export default function AuditViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const audit = useQuery({
    queryKey: ["audit", id],
    queryFn: async () => (await api.get<Audit>(`/audit/${id}`)).data,
    refetchInterval: (q) =>
      q.state.data && ["completed", "failed"].includes(q.state.data.status) ? false : 2500,
  });

  const running = !!audit.data && ["pending", "running"].includes(audit.data.status);
  const events = useAuditStream(id, running);

  if (audit.isLoading || !audit.data) {
    return <AppShell><div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div></AppShell>;
  }
  const a = audit.data;

  return (
    <AppShell>
      <PageHeader
        title={`Audit ${a.id.slice(0, 8)}`}
        subtitle={a.status === "completed" ? "Completed" : a.status === "failed" ? `Failed: ${a.error ?? ""}` : "Running…"}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" className="text-xs"
              onClick={() => api.post(`/audit/${a.id}/rerun`).then((r) => { window.location.href = `/audit/${r.data.id}`; })}>
              <RefreshCw className="h-3.5 w-3.5" /> Re-run
            </Button>
            {a.status === "completed" && (
              <>
                <a href={`/api/v1/audit/${a.id}/export?format=csv`} target="_blank">
                  <Button variant="secondary" className="text-xs"><Download className="h-3.5 w-3.5" /> CSV</Button>
                </a>
                <a href={`/api/v1/audit/${a.id}/export?format=pdf`} target="_blank">
                  <Button variant="secondary" className="text-xs"><Download className="h-3.5 w-3.5" /> PDF</Button>
                </a>
              </>
            )}
          </div>
        }
      />

      {running ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <LiveProgress events={events} />
          <Card><EmptyState title="Findings will appear here" hint="The pipeline streams progress live" /></Card>
        </div>
      ) : a.status === "failed" ? (
        <Card><EmptyState title="Audit failed" hint={a.error ?? "Unknown error"} /></Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <InvoicePanel audit={a} />
          <FindingsPanel audit={a} />
        </div>
      )}
    </AppShell>
  );
}
