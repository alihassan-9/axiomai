"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { api, apiError } from "@/lib/api";
import type { AuditLogEntry, Usage, User } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Badge, Button, Card, CardHeader, ErrorNote, Input, Label, Spinner, Table } from "@/components/ui";

const ROLES = ["admin", "analyst", "viewer"] as const;

export default function AdminPage() {
  const queryClient = useQueryClient();
  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => (await api.get<User[]>("/admin/users")).data,
  });
  const usage = useQuery({
    queryKey: ["admin-usage"],
    queryFn: async () => (await api.get<Usage>("/admin/usage")).data,
  });
  const log = useQuery({
    queryKey: ["admin-log"],
    queryFn: async () => (await api.get<AuditLogEntry[]>("/admin/audit-log?limit=50")).data,
  });

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<(typeof ROLES)[number]>("analyst");
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const invite = useMutation({
    mutationFn: async () =>
      (await api.post<{ temporary_password: string }>("/admin/users/invite", {
        email: inviteEmail, full_name: inviteName, role: inviteRole,
      })).data,
    onSuccess: (data) => {
      setTempPassword(data.temporary_password);
      setInviteEmail(""); setInviteName("");
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const changeRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) =>
      api.put(`/admin/users/${id}/role`, { role }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  return (
    <AppShell>
      <PageHeader title="Admin Panel" subtitle="Team, usage, and the immutable system audit trail" />

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Plan", usage.data?.plan_tier ?? "…"],
          ["Documents", usage.data ? String(usage.data.documents_uploaded) : "…"],
          ["Audits run", usage.data ? String(usage.data.audits_run) : "…"],
          ["Storage", usage.data ? `${(usage.data.storage_bytes / 1024 / 1024).toFixed(1)} MB` : "…"],
        ].map(([label, value]) => (
          <Card key={label} className="p-5">
            <div className="text-xs capitalize text-zinc-500">{label}</div>
            <div className="mt-1 text-xl font-semibold capitalize">{value}</div>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader title="Invite team member" subtitle="A temporary password is generated — share it securely" />
        <div className="grid gap-3 p-5 md:grid-cols-4">
          <div>
            <Label>Email</Label>
            <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="teammate@company.com" />
          </div>
          <div>
            <Label>Full name</Label>
            <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <Label>Role</Label>
            <select className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm"
              value={inviteRole} onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}>
              {ROLES.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <Button className="w-full" disabled={!inviteEmail || invite.isPending} onClick={() => invite.mutate()}>
              <UserPlus className="h-4 w-4" /> Invite
            </Button>
          </div>
        </div>
        {invite.isError && <div className="px-5 pb-4"><ErrorNote message={apiError(invite.error)} /></div>}
        {tempPassword && (
          <div className="mx-5 mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Temporary password (shown once): <span className="font-mono font-semibold">{tempPassword}</span>
          </div>
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader title="Team members" />
        {users.isLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : (
          <Table headers={["Member", "Email", "Role", "Joined"]}>
            {users.data?.map((u) => (
              <tr key={u.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3 font-medium">{u.full_name || "—"}</td>
                <td className="px-4 py-3 text-zinc-600">{u.email}</td>
                <td className="px-4 py-3">
                  <select
                    className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs capitalize"
                    value={u.role}
                    onChange={(e) => changeRole.mutate({ id: u.id, role: e.target.value })}
                  >
                    {ROLES.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3 text-zinc-500">{formatDate(u.created_at)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader title="System audit trail" subtitle="Immutable log of every sensitive action" />
        {log.isLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : (
          <Table headers={["Action", "Entity", "IP", "When"]}>
            {log.data?.map((entry) => (
              <tr key={entry.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3"><Badge>{entry.action}</Badge></td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-600">
                  {entry.entity}{entry.entity_id ? `:${entry.entity_id.slice(0, 8)}` : ""}
                </td>
                <td className="px-4 py-3 text-zinc-500">{entry.ip_address || "—"}</td>
                <td className="px-4 py-3 text-zinc-500">{formatDate(entry.timestamp)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </AppShell>
  );
}
