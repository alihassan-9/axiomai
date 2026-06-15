"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { apiError } from "@/lib/api";
import { useAuth } from "@/stores/auth";
import { signInWithGoogle } from "@/utils/supabase/client";
import { ErrorNote } from "@/components/ui";
import { AuthShell, Field, SubmitButton, fieldClass } from "@/components/auth-shell";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuth((s) => s.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      router.replace("/dashboard");
    } catch (err) {
      setError(apiError(err));
      setBusy(false);
    }
  }

  return (
    <AuthShell mode="login" onGoogle={async () => {
      try { await signInWithGoogle(); } catch { setError("Couldn't start Google sign-in. Try again."); }
    }}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Email">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className={fieldClass} placeholder="name@example.com" />
        </Field>
        <Field label="Password">
          <div className="relative">
            <input type={show ? "text" : "password"} required value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${fieldClass} pr-11`} placeholder="••••••••••••" />
            <button type="button" onClick={() => setShow((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              aria-label={show ? "Hide password" : "Show password"}>
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600">
          <input type="checkbox" className="h-4 w-4 rounded border-zinc-300 text-brand-600 accent-brand-600" defaultChecked />
          Keep me signed in
        </label>

        <ErrorNote message={error} />
        <SubmitButton busy={busy} idle="Log in" busyLabel="Signing in…" />
      </form>
    </AuthShell>
  );
}
