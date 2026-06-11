"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/stores/auth";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button, Card, CardHeader, ErrorNote, Input, Label } from "@/components/ui";

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

  return (
    <AppShell>
      <PageHeader title="Settings" subtitle="Your account and workspace preferences" />
      <div className="max-w-xl space-y-6">
        <Card>
          <CardHeader title="Profile" />
          <div className="space-y-4 p-5">
            <div>
              <Label>Email</Label>
              <Input value={user?.email ?? ""} disabled className="bg-zinc-50 text-zinc-500" />
            </div>
            <div>
              <Label>Full name</Label>
              <Input value={fullName} placeholder={user?.full_name || "Your name"}
                onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <Label>New password (leave blank to keep current)</Label>
              <Input type="password" value={password} minLength={8}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            {save.isError && <ErrorNote message={apiError(save.error)} />}
            {saved && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                Saved.
              </div>
            )}
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Workspace" />
          <div className="space-y-2 p-5 text-sm text-zinc-600">
            <div className="flex justify-between"><span>Organisation ID</span>
              <span className="font-mono text-xs">{user?.org_id}</span></div>
            <div className="flex justify-between"><span>Your role</span>
              <span className="capitalize">{user?.role}</span></div>
            <p className="pt-2 text-xs text-zinc-400">
              Team management and billing live in the Admin panel (admins only).
            </p>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
