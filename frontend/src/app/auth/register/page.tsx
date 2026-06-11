"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiError } from "@/lib/api";
import { useAuth } from "@/stores/auth";
import { Button, Card, ErrorNote, Input, Label } from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuth((s) => s.register);
  const [form, setForm] = useState({ org: "", name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function update(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await register(form.org, form.name, form.email, form.password);
      router.replace("/dashboard");
    } catch (err) {
      setError(apiError(err));
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-lg font-semibold">Create your workspace</h1>
        <p className="mt-1 text-sm text-zinc-500">
          You&apos;ll be the organisation admin and can invite your team later.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="org">Organisation name</Label>
            <Input id="org" required value={form.org} onChange={update("org")} placeholder="Acme Accounting LLP" />
          </div>
          <div>
            <Label htmlFor="name">Your full name</Label>
            <Input id="name" required value={form.name} onChange={update("name")} placeholder="Jane Doe" />
          </div>
          <div>
            <Label htmlFor="email">Work email</Label>
            <Input id="email" type="email" required value={form.email} onChange={update("email")}
              placeholder="you@company.com" />
          </div>
          <div>
            <Label htmlFor="password">Password (min 8 chars)</Label>
            <Input id="password" type="password" required minLength={8} value={form.password}
              onChange={update("password")} placeholder="••••••••" />
          </div>
          <ErrorNote message={error} />
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Creating…" : "Create workspace"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-zinc-500">
          Already registered?{" "}
          <Link href="/auth/login" className="font-medium text-brand-600 hover:underline">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}
