import { createClient } from "@supabase/supabase-js";

// Standard supabase-js browser client. Uses localStorage for the PKCE verifier and
// session, which survives the OAuth redirect (the @supabase/ssr cookie store did not
// in this no-middleware app). detectSessionInUrl auto-exchanges the code on return.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
}

export const supabase = createClient(url, key, {
  auth: { flowType: "pkce", detectSessionInUrl: false, persistSession: true, autoRefreshToken: false },
});

/** Start Google OAuth; Supabase redirects back to /auth/callback to finish. */
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
  if (error) throw error;
}
