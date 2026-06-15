"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import axios from "axios";
import { supabase } from "@/utils/supabase/client";
import { apiError, saveTokens } from "@/lib/api";
import { useAuth } from "@/stores/auth";
import type { TokenPair } from "@/lib/types";
import { Spinner } from "@/components/ui";

export default function AuthCallback() {
  const router = useRouter();
  const hydrate = useAuth((s) => s.hydrate);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let done = false;

    async function finishWith(accessToken: string) {
      if (done) return;
      done = true;
      try {
        const { data } = await axios.post<TokenPair>("/api/v1/auth/oauth", { access_token: accessToken });
        saveTokens(data);
        await hydrate();
        router.replace("/dashboard");
      } catch (e) {
        setError(`Backend sign-in failed: ${apiError(e)}`);
      }
    }

    void (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (code) {
        // Guard against React's dev double-invoke exchanging the one-time code twice.
        const guard = `axiom_oauth_${code}`;
        if (sessionStorage.getItem(guard)) return;
        sessionStorage.setItem(guard, "1");

        const { data, error: exErr } = await supabase.auth.exchangeCodeForSession(code);
        if (data?.session) return finishWith(data.session.access_token);
        if (exErr) { setError(`Could not complete Google sign-in: ${exErr.message}`); return; }
      }

      // Fallback: an already-established session, else surface a provider error.
      const { data } = await supabase.auth.getSession();
      if (data.session) return finishWith(data.session.access_token);
      const providerErr = params.get("error_description") || params.get("error");
      setError(providerErr
        ? decodeURIComponent(providerErr.replace(/\+/g, " "))
        : "No sign-in token was returned by Google. Please try again.");
    })();
  }, [router, hydrate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f6f8] px-4 text-center">
      {error ? (
        <div className="max-w-md">
          <p className="text-sm font-medium text-red-600">{error}</p>
          <Link href="/auth/login" className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:underline">
            Back to sign in
          </Link>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 text-zinc-500">
          <Spinner className="h-6 w-6" />
          <p className="text-sm">Finishing sign-in…</p>
        </div>
      )}
    </div>
  );
}
