"use client";

import Link from "next/link";
import {
  ArrowRight, Box, Frame, Hexagon, Image as ImageIcon, Layers, Palette, Pencil,
  PenTool, Pipette, Ruler, Sparkles, Square, Triangle, Type,
} from "lucide-react";
import { Logo } from "@/components/logo";

// Decorative icons scattered behind the card (design-tool motif, low opacity).
const FLOATERS: { Icon: React.ElementType; className: string; size: number }[] = [
  { Icon: Layers, className: "left-[8%] top-[14%]", size: 26 },
  { Icon: Pencil, className: "left-[22%] top-[20%] -rotate-12", size: 18 },
  { Icon: ImageIcon, className: "left-[60%] top-[9%]", size: 24 },
  { Icon: Palette, className: "right-[10%] top-[18%]", size: 26 },
  { Icon: Ruler, className: "left-[5%] top-[40%] -rotate-45", size: 22 },
  { Icon: Square, className: "left-[11%] top-[58%]", size: 18 },
  { Icon: Frame, className: "left-[19%] top-[76%]", size: 24 },
  { Icon: Box, className: "left-[9%] top-[90%]", size: 26 },
  { Icon: Pencil, className: "left-[16%] top-[97%] rotate-12", size: 18 },
  { Icon: Triangle, className: "left-[36%] top-[95%]", size: 22 },
  { Icon: Hexagon, className: "left-[14%] top-[114%]", size: 22 },
  { Icon: PenTool, className: "right-[8%] top-[44%] -rotate-12", size: 22 },
  { Icon: Pipette, className: "right-[18%] top-[68%]", size: 22 },
  { Icon: Layers, className: "right-[6%] top-[78%]", size: 26 },
  { Icon: Pencil, className: "right-[14%] top-[96%] -rotate-45", size: 18 },
  { Icon: Type, className: "right-[20%] top-[97%]", size: 24 },
];

const COPY = {
  login: {
    badge: "Welcome back",
    title: ["Pick up exactly", "where you left off."],
    body: "Log in to your workspace — your invoices, audits and reports are all where you left them.",
    footPrompt: "Don't have an account?",
    footLink: "Sign up",
    footHref: "/auth/register",
    headingLead: "Log in to your",
    headingAccent: "workspace",
  },
  register: {
    badge: "Get started",
    title: ["Start auditing", "in minutes."],
    body: "Create your workspace — upload an invoice and catch overcharges, tax errors and policy breaches in seconds.",
    footPrompt: "Already have an account?",
    footLink: "Log in",
    footHref: "/auth/login",
    headingLead: "Create your",
    headingAccent: "workspace",
  },
};

export function AuthShell({
  mode, children, onGoogle,
}: {
  mode: "login" | "register";
  children: React.ReactNode;
  onGoogle?: () => void;
}) {
  const c = COPY[mode];

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10"
      style={{ background: "radial-gradient(120% 90% at 50% 0%, #eef0f5 0%, #f5f6f8 45%, #f7f7f6 100%)" }}>
      {/* floating decorative icons */}
      <div className="pointer-events-none absolute inset-0">
        {FLOATERS.map((f, i) => (
          <f.Icon key={i} className={`absolute text-brand-300/45 ${f.className}`}
            style={{ width: f.size, height: f.size }} strokeWidth={1.5} />
        ))}
      </div>

      {/* card */}
      <div className="relative grid w-full max-w-4xl overflow-hidden rounded-3xl border border-white/60 bg-white shadow-[0_30px_80px_-40px_rgba(36,38,47,0.45)] md:grid-cols-2">
        {/* left brand panel */}
        <div className="relative hidden flex-col justify-between bg-gradient-to-br from-brand-700 to-brand-900 p-9 text-white md:flex">
          <Logo dark priority />

          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white/90">
              <Sparkles className="h-3 w-3" /> {c.badge}
            </span>
            <h2 className="mt-5 text-3xl font-bold leading-tight tracking-tight">
              {c.title[0]}
              <br />
              <span className="font-serif text-4xl font-normal italic text-white/70">{c.title[1]}</span>
            </h2>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/60">{c.body}</p>
          </div>

          <p className="text-sm text-white/60">
            {c.footPrompt}{" "}
            <Link href={c.footHref} className="font-semibold text-white hover:underline">{c.footLink}</Link>
          </p>
        </div>

        {/* right form panel */}
        <div className="bg-white p-8 sm:p-10">
          {/* tabs */}
          <div className="inline-flex rounded-full bg-zinc-100 p-1 text-sm">
            <Link href="/auth/login"
              className={`rounded-full px-5 py-1.5 font-medium transition-colors ${mode === "login" ? "bg-white text-brand-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>
              Log in
            </Link>
            <Link href="/auth/register"
              className={`rounded-full px-5 py-1.5 font-medium transition-colors ${mode === "register" ? "bg-white text-brand-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>
              Sign up
            </Link>
          </div>

          <h1 className="mt-6 text-2xl font-bold tracking-tight text-brand-900">
            {c.headingLead}{" "}
            <span className="font-serif text-[1.2em] font-normal italic text-brand-500">{c.headingAccent}</span>
          </h1>

          <div className="mt-6">{children}</div>

          <div className="my-5 flex items-center gap-3 text-[11px] font-medium uppercase tracking-widest text-zinc-400">
            <span className="h-px flex-1 bg-zinc-200" /> or <span className="h-px flex-1 bg-zinc-200" />
          </div>

          <button type="button" onClick={onGoogle}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-zinc-200 bg-white py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50">
            <GoogleMark /> Continue with Google
          </button>

          {/* mobile-only switch (left panel hidden on small screens) */}
          <p className="mt-6 text-center text-sm text-zinc-500 md:hidden">
            {c.footPrompt}{" "}
            <Link href={c.footHref} className="font-semibold text-brand-700 hover:underline">{c.footLink}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// Shared field primitives styled to the reference (uppercase labels, filled inputs).
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

export const fieldClass =
  "w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-brand-900 " +
  "placeholder:text-zinc-400 transition-colors focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-100";

export function SubmitButton({ busy, idle, busyLabel }: { busy: boolean; idle: string; busyLabel: string }) {
  return (
    <button type="submit" disabled={busy}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-700 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-700/25 transition-transform hover:scale-[1.01] disabled:opacity-60 disabled:hover:scale-100">
      {busy ? busyLabel : <>{idle} <ArrowRight className="h-4 w-4" /></>}
    </button>
  );
}

function GoogleMark() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
    </svg>
  );
}
