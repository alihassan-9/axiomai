import { createClient } from "@supabase/supabase-js";

// Standard supabase-js browser client. Uses localStorage for the PKCE verifier and
// session, which survives the OAuth redirect (the @supabase/ssr cookie store did not
// in this no-middleware app). detectSessionInUrl auto-exchanges the code on return.
// Fall back to placeholders so the production build never crashes when env is
// unset (e.g. CI). Real values are inlined at build time when configured.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "public-anon-placeholder";

export const supabase = createClient(url, key, {
  auth: { flowType: "pkce", detectSessionInUrl: false, persistSession: true, autoRefreshToken: false },
});

/** Start Google OAuth; Supabase redirects back to /auth/callback to finish. */
export async function signInWithGoogle() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Google sign-in isn't configured — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
  if (error) throw error;
}
