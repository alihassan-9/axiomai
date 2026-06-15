"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { apiError } from "@/lib/api";
import { useAuth } from "@/stores/auth";
import { signInWithGoogle } from "@/utils/supabase/client";
import { ErrorNote } from "@/components/ui";
import { AuthShell, Field, SubmitButton, fieldClass } from "@/components/auth-shell";

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuth((s) => s.register);
  const [form, setForm] = useState({ org: "", name: "", email: "", password: "" });
  const [show, setShow] = useState(false);
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
    <AuthShell mode="register" onGoogle={async () => {
      try { await signInWithGoogle(); } catch { setError("Couldn't start Google sign-in. Try again."); }
    }}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Organisation">
            <input required value={form.org} onChange={update("org")}
              className={fieldClass} placeholder="Acme Accounting" />
          </Field>
          <Field label="Full name">
            <input required value={form.name} onChange={update("name")}
              className={fieldClass} placeholder="Jane Doe" />
          </Field>
        </div>
        <Field label="Work email">
          <input type="email" required value={form.email} onChange={update("email")}
            className={fieldClass} placeholder="name@example.com" />
        </Field>
        <Field label="Password">
          <div className="relative">
            <input type={show ? "text" : "password"} required minLength={8} value={form.password}
              onChange={update("password")}
              className={`${fieldClass} pr-11`} placeholder="At least 8 characters" />
            <button type="button" onClick={() => setShow((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              aria-label={show ? "Hide password" : "Show password"}>
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        <ErrorNote message={error} />
        <SubmitButton busy={busy} idle="Create workspace" busyLabel="Creating…" />
      </form>
    </AuthShell>
  );
}
