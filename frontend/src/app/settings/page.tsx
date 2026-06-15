"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Activity, Building2, CheckCircle2, KeyRound, ShieldCheck, UserRound, Zap,
} from "lucide-react";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/stores/auth";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button, Card, ErrorNote, Input } from "@/components/ui";

function initials(name: string): string {
  return name.split(/[\s@.]+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default function SettingsPage() {
  const { user, hydrate } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [password, setPassword] = useState("");
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = {};
      if (fullName) body.full_name = fullName;
      if (password) body.password = password;
      await api.put("/auth/me", body);
    },
    onSuccess: () => {
      setSaved(true);
      setPassword("");
      void hydrate();
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const name = user?.full_name || user?.email || "";

  return (
    <AppShell>
      <PageHeader title="Account" accent="settings" subtitle="Your account and workspace preferences" />

      <div className="max-w-3xl space-y-6">
        {/* Identity */}
        <Card className="flex items-center gap-4 p-6">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-700 text-xl font-bold text-white shadow-lg shadow-brand-600/25">
            {initials(name)}
          </div>
          <div className="min-w-0">
            <div className="truncate text-lg font-bold tracking-tight text-brand-900">{name}</div>
            <div className="truncate text-sm text-zinc-500">{user?.email}</div>
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold capitalize text-brand-700">
              <ShieldCheck className="h-3 w-3" /> {user?.role}
            </span>
          </div>
        </Card>

        {/* Profile */}
        <Section icon={UserRound} title="Profile" tint="bg-brand-50/60 text-brand-600">
          <Row label="Email" desc="Used to sign in; cannot be changed here">
            <Input value={user?.email ?? ""} disabled className="w-60 cursor-not-allowed bg-zinc-100 text-zinc-500" />
          </Row>
          <Row label="Full name" desc="Shown across your workspace">
            <Input value={fullName} placeholder={user?.full_name || "Your name"}
              onChange={(e) => setFullName(e.target.value)} className="w-60" />
          </Row>
          <Row label="New password" desc="Leave blank to keep your current password">
            <Input type="password" value={password} minLength={8}
              onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className="w-60" />
          </Row>
          <div className="flex items-center justify-between gap-4 px-6 py-4">
            <div className="min-h-[1px] flex-1">
              {save.isError && <ErrorNote message={apiError(save.error)} />}
              {saved && (
                <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> Changes saved.
                </div>
              )}
            </div>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              <KeyRound className="h-4 w-4" /> {save.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </Section>

        {/* Workspace */}
        <Section icon={Building2} title="Workspace" tint="bg-indigo-50 text-indigo-600">
          <Row label="Organisation ID" desc="Your tenant identifier">
            <span className="font-mono text-xs text-brand-900">{user?.org_id}</span>
          </Row>
          <Row label="Your role" desc="Determines what you can access">
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold capitalize text-brand-900">{user?.role}</span>
          </Row>
          <div className="px-6 py-4 text-xs text-zinc-400">
            Team management and billing live in the Admin panel (admins only).
          </div>
        </Section>

        {/* Footer status */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="flex items-center gap-3 bg-amber-50/40 p-5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600"><Zap className="h-4 w-4" /></span>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Version</div>
              <div className="text-sm font-bold text-brand-900">1.0.0</div>
            </div>
          </Card>
          <Card className="flex items-center gap-3 bg-emerald-50/40 p-5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600"><Activity className="h-4 w-4" /></span>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Status</div>
              <div className="text-sm font-bold text-brand-900">All systems normal</div>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Section({ icon: Icon, title, tint, children }: {
  icon: React.ElementType; title: string; tint: string; children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-zinc-100 px-6 py-4">
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${tint}`}>
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="text-[15px] font-semibold tracking-tight text-brand-900">{title}</h3>
      </div>
      <div className="divide-y divide-zinc-100">{children}</div>
    </Card>
  );
}

function Row({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-4">
      <div className="min-w-0">
        <div className="text-sm font-medium text-brand-900">{label}</div>
        <div className="text-xs text-zinc-500">{desc}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
