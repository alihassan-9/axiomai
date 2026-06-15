"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { api, apiError } from "@/lib/api";
import type { Policy, PolicyRule } from "@/lib/types";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Badge, Button, Card, CardHeader, EmptyState, ErrorNote, Input, Label, Spinner } from "@/components/ui";
import { Select } from "@/components/select";

const EMPTY_RULE: PolicyRule = {
  field: "grand_total", operator: "gt", value: 500, severity: "high",
  message: "", when: null,
};

const FIELD_OPTIONS = [
  "grand_total", "subtotal", "tax_amount", "vendor",
  "line_items[].line_total", "line_items[].quantity", "line_items[].unit_price",
];
const OPERATORS = ["gt", "gte", "lt", "lte", "eq", "neq", "contains", "in", "not_in"] as const;
const OPERATOR_LABELS: Record<string, string> = {
  gt: "is greater than", gte: "is greater than or equal", lt: "is less than",
  lte: "is less than or equal", eq: "equals", neq: "does not equal",
  contains: "contains", in: "is in list", not_in: "is not in list",
};
const SEVERITIES = ["info", "low", "medium", "high", "critical"] as const;

const FIELD_OPTS = FIELD_OPTIONS.map((f) => ({ value: f, label: f }));
const OPERATOR_OPTS = OPERATORS.map((o) => ({ value: o, label: OPERATOR_LABELS[o] }));
const SEVERITY_OPTS = SEVERITIES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }));

function RuleEditor({ rule, onChange, onRemove }: {
  rule: PolicyRule; onChange: (r: PolicyRule) => void; onRemove: () => void;
}) {
  const [whenCategory, setWhenCategory] = useState(
    (rule.when as { category?: string } | null)?.category ?? "",
  );

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <div className="grid gap-3 md:grid-cols-4">
        <div>
          <Label>Field</Label>
          <Select value={rule.field} options={FIELD_OPTS}
            onChange={(v) => onChange({ ...rule, field: v })} />
        </div>
        <div>
          <Label>Violates when</Label>
          <Select value={rule.operator} options={OPERATOR_OPTS}
            onChange={(v) => onChange({ ...rule, operator: v as PolicyRule["operator"] })} />
        </div>
        <div>
          <Label>Value</Label>
          <Input value={String(rule.value ?? "")}
            onChange={(e) => {
              const v = e.target.value;
              const num = Number(v);
              onChange({ ...rule, value: v !== "" && !Number.isNaN(num) ? num : v });
            }} />
        </div>
        <div>
          <Label>Severity</Label>
          <Select value={rule.severity} options={SEVERITY_OPTS}
            onChange={(v) => onChange({ ...rule, severity: v as PolicyRule["severity"] })} />
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <Label>Only when category equals (optional)</Label>
          <Input placeholder="e.g. Software" value={whenCategory}
            onChange={(e) => {
              setWhenCategory(e.target.value);
              onChange({ ...rule, when: e.target.value ? { category: e.target.value } : null });
            }} />
        </div>
        <div>
          <Label>Violation message</Label>
          <Input placeholder="e.g. Software spend cap is $500/month" value={rule.message}
            onChange={(e) => onChange({ ...rule, message: e.target.value })} />
        </div>
      </div>
      <button onClick={onRemove} className="mt-3 flex items-center gap-1 text-xs text-red-600 hover:underline">
        <Trash2 className="h-3 w-3" /> Remove rule
      </button>
    </div>
  );
}

export default function CompliancePage() {
  const queryClient = useQueryClient();
  const policies = useQuery({
    queryKey: ["policies"],
    queryFn: async () => (await api.get<Policy[]>("/compliance/policies")).data,
  });

  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [rules, setRules] = useState<PolicyRule[]>([{ ...EMPTY_RULE }]);

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["policies"] });

  const create = useMutation({
    mutationFn: async () => api.post("/compliance/policies", {
      name: draftName, description: draftDescription, rules, is_active: true,
    }),
    onSuccess: () => {
      setDraftName(""); setDraftDescription(""); setRules([{ ...EMPTY_RULE }]);
      invalidate();
    },
  });

  const toggle = useMutation({
    mutationFn: async (p: Policy) =>
      api.put(`/compliance/policies/${p.id}`, { is_active: !p.is_active }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/compliance/policies/${id}`),
    onSuccess: invalidate,
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
      <PageHeader title="Policy" accent="Manager" subtitle="Structured compliance rules applied to every audit" />

      <Card>
        <CardHeader title="Create policy" subtitle="Rules describe the violation condition" />
        <div className="space-y-4 p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Policy name</Label>
              <Input value={draftName} onChange={(e) => setDraftName(e.target.value)}
                placeholder="Monthly software spend cap" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={draftDescription} onChange={(e) => setDraftDescription(e.target.value)}
                placeholder="Limits per-invoice software purchases" />
            </div>
          </div>
          {rules.map((rule, i) => (
            <RuleEditor key={i} rule={rule}
              onChange={(r) => setRules(rules.map((x, j) => (j === i ? r : x)))}
              onRemove={() => setRules(rules.filter((_, j) => j !== i))} />
          ))}
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => setRules([...rules, { ...EMPTY_RULE }])}>
              <Plus className="h-4 w-4" /> Add rule
            </Button>
            <Button disabled={!draftName || rules.length === 0 || create.isPending}
              onClick={() => create.mutate()}>
              {create.isPending ? "Saving…" : "Save policy"}
            </Button>
          </div>
          {create.isError && <ErrorNote message={apiError(create.error)} />}
        </div>
      </Card>

      <div className="mt-6 space-y-4">
        {policies.isLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : policies.data?.length ? (
          policies.data.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start justify-between p-5">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{p.name}</h3>
                    <Badge className={p.is_active
                      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                      : "bg-zinc-100 text-zinc-500 border-zinc-200"}>
                      {p.is_active ? "active" : "inactive"}
                    </Badge>
                  </div>
                  {p.description && <p className="mt-1 text-xs text-zinc-500">{p.description}</p>}
                  <div className="mt-3 space-y-1">
                    {p.rule_json.rules?.map((r, i) => (
                      <div key={i} className="font-mono text-[11px] text-zinc-600">
                        {r.field} {r.operator} {JSON.stringify(r.value)}
                        {r.when ? ` when ${JSON.stringify(r.when)}` : ""} → <span className="uppercase">{r.severity}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => toggle.mutate(p)}>
                    {p.is_active ? "Deactivate" : "Activate"}
                  </Button>
                  <Button variant="danger" className="px-3 py-1.5 text-xs" onClick={() => remove.mutate(p.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Card><EmptyState title="No policies yet" hint="Create structured rules above, or upload policy PDFs in the Upload Center for RAG" /></Card>
        )}
      </div>
      </div>
    </AppShell>
  );
}
