import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, AtSign, Bell, BookOpen, Calculator,
  Download, FileSearch, Filter, Globe, Lightbulb, Mail, MessageCircle,
  PiggyBank, Plus, Receipt, Search, Settings, ShieldCheck, Sparkles, TrendingUp,
} from "lucide-react";
import { Reveal } from "@/components/reveal";
import { Logo } from "@/components/logo";

const NAV: [string, string][] = [
  ["How it works", "#how"], ["Why Axiom", "#why"], ["Get started", "#start"],
];

// --- tiny mockup primitives --------------------------------------------------

function MiniLine({ className = "", stroke = "#5a6178" }: { className?: string; stroke?: string }) {
  return (
    <svg viewBox="0 0 120 40" className={className} preserveAspectRatio="none">
      <polyline points="0,34 22,30 44,32 66,18 88,22 120,6"
        fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Gauge({ pct = 68, value = "$4,682", caption = "Available" }: { pct?: number; value?: string; caption?: string }) {
  const len = 141; // arc length of the semicircle below
  return (
    <div className="relative flex flex-col items-center">
      <svg viewBox="0 0 100 56" className="w-32">
        <defs>
          <linearGradient id="gaugeBrand" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#9097ad" />
            <stop offset="100%" stopColor="#494f63" />
          </linearGradient>
        </defs>
        <path d="M6 50 A44 44 0 0 1 94 50" fill="none" stroke="#e8eaf1" strokeWidth="9" strokeLinecap="round" />
        <path d="M6 50 A44 44 0 0 1 94 50" fill="none" stroke="url(#gaugeBrand)" strokeWidth="9"
          strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len - (pct / 100) * len} />
      </svg>
      <div className="-mt-7 text-center">
        <div className="text-xl font-bold tracking-tight text-brand-900">{value}</div>
        <div className="text-[10px] text-zinc-400">{caption}</div>
      </div>
    </div>
  );
}

// --- page --------------------------------------------------------------------

export default function LandingPage() {
  return (
    <div className="overflow-x-clip bg-white text-brand-900">
      {/* gradient wash behind nav + hero */}
      <div
        className="relative"
        style={{
          background:
            "radial-gradient(120% 80% at 50% -10%, #c7ccdb 0%, #dde0ea 30%, #eef0f5 55%, #ffffff 100%)",
        }}
      >
        {/* Navbar */}
        <header className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-6 py-6">
          <Link href="/" className="flex items-center">
            <Logo priority />
          </Link>
          <nav className="hidden items-center gap-1 rounded-full border border-white/60 bg-white/50 px-2 py-1.5 shadow-sm backdrop-blur md:flex">
            {NAV.map(([label, href]) => (
              <a key={label} href={href}
                className="cursor-pointer rounded-full px-4 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-white hover:text-brand-900">
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center justify-end gap-1">
            <Link href="/auth/login"
              className="rounded-full px-4 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:text-brand-900">
              Sign in
            </Link>
            <Link href="/auth/register"
              className="rounded-full bg-brand-800 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700">
              Start free trial
            </Link>
          </div>
        </header>

        {/* Hero */}
        <section className="mx-auto max-w-5xl px-6 pb-10 pt-8 text-center">
          <Reveal delay={80}>
            <h1 className="mx-auto mt-2 max-w-3xl text-6xl font-bold leading-[1.02] tracking-tight text-brand-900 sm:text-7xl">
              From a messy invoice
              <br />
              <span className="font-serif text-[4.2rem] font-normal italic text-brand-900 sm:text-[5rem]">to a fully audited</span>{" "}
              <span className="text-brand-400">report.</span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-zinc-500">
              Axiom audits every vendor invoice in seconds exact math, policy compliance with
              citations, and reports you can actually trust.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <Link href="/auth/register"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand-800 px-7 py-3.5 text-sm font-medium text-white shadow-lg shadow-brand-900/20 transition-transform hover:scale-[1.03]">
              Start free trial <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
        </section>

        {/* Laptop dashboard mockup */}
        <section className="mx-auto max-w-5xl px-6 pb-2">
          <Reveal delay={120} y={40}>
            <div className="rounded-t-[28px] border border-brand-800/40 border-b-0 bg-brand-800 p-3 shadow-[0_-10px_60px_-20px_rgba(36,38,47,0.4)]">
              <div className="overflow-hidden rounded-2xl bg-white">
                <DashboardMock />
              </div>
            </div>
          </Reveal>
        </section>
      </div>

      {/* How it works — scattered cards */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-28">
        <Reveal className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-xs font-medium text-zinc-600 shadow-sm">
            <BookOpen className="h-3.5 w-3.5" /> How it works
          </span>
          <h2 className="mt-6 text-5xl font-bold tracking-tight text-brand-900 sm:text-6xl">
            How Axiom <span className="font-serif text-[3.2rem] font-normal italic sm:text-[4rem]">works</span>
          </h2>
          <p className="mx-auto mt-4 max-w-sm text-zinc-500">
            Axiom helps finance teams ditch invoice errors. You&apos;re next.
          </p>
        </Reveal>

        <div className="mx-auto mt-16 grid max-w-5xl items-center gap-5 md:grid-cols-3">
          {/* left column */}
          <div className="space-y-5">
            {/* brand recovered card */}
            <Reveal y={30}>
              <div className="rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 p-6 text-white shadow-[0_30px_60px_-30px_rgba(36,38,47,0.5)] transition-transform duration-300 hover:-translate-y-1.5">
                <div className="flex items-center justify-between text-xs text-white/70">
                  <span>Recovered</span><span>Past 30 days ▾</span>
                </div>
                <div className="mt-6 flex items-end gap-2">
                  <span className="text-4xl font-bold tracking-tight">$3,800</span>
                  <span className="mb-1.5 rounded-md bg-white/20 px-2 py-0.5 text-[10px]">Feb 12</span>
                </div>
                <div className="mt-1 flex items-center gap-1 text-xs text-white/80">
                  <ArrowUpRight className="h-3.5 w-3.5" /> 16.4%
                </div>
                <MiniLine className="mt-4 h-10 w-full" stroke="rgba(255,255,255,0.7)" />
              </div>
            </Reveal>
            {/* gauge card */}
            <Reveal y={30} delay={120}>
              <div className="rounded-3xl border border-zinc-100 bg-white p-6 shadow-[0_30px_60px_-30px_rgba(36,38,47,0.3)] transition-transform duration-300 hover:-translate-y-1.5">
                <Gauge pct={72} value="$4,682" caption="Recovered" />
                <div className="mt-4 flex justify-center gap-3 text-[10px] text-zinc-400">
                  <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-brand-400" />Verified</span>
                  <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-brand-600" />Flagged</span>
                </div>
              </div>
            </Reveal>
          </div>

          {/* center accuracy card */}
          <Reveal y={30} delay={60}>
            <div className="rounded-3xl border border-zinc-100 bg-white p-6 shadow-[0_40px_80px_-30px_rgba(36,38,47,0.35)] transition-transform duration-300 hover:-translate-y-1.5">
              <div className="text-sm font-medium text-zinc-500">Audit accuracy</div>
              <div className="mt-3 text-5xl font-bold tracking-tight text-brand-900">+18%</div>
              <div className="mt-2 text-sm text-zinc-500">Verification coverage has increased</div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="h-16 rounded-2xl bg-brand-300" />
                <div className="h-16 rounded-2xl bg-brand-800" />
              </div>
            </div>
          </Reveal>

          {/* right column */}
          <div className="space-y-5">
            {/* dark profile card */}
            <Reveal y={30} delay={180}>
              <div className="rounded-3xl bg-brand-800 p-5 text-white shadow-[0_30px_60px_-30px_rgba(36,38,47,0.5)] transition-transform duration-300 hover:-translate-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium"><Settings className="h-3.5 w-3.5" /> My profile</span>
                  <span className="text-white/40">@alexgrace</span>
                </div>
                <div className="mt-4 rounded-xl bg-white/5 p-2 text-xs text-white/70">Account settings</div>
                <div className="mt-3 text-[10px] uppercase tracking-wide text-white/30">Switch account</div>
                <div className="mt-2 space-y-2">
                  {[["Isabelle Laurent", "belle.laurent@yahoo.com"], ["Alex Grace", "alex.grace@gmail.com"]].map(([n, e]) => (
                    <div key={n} className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-brand-400 to-brand-600" />
                      <div className="min-w-0">
                        <div className="text-xs font-medium">{n}</div>
                        <div className="truncate text-[10px] text-white/40">{e}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
            {/* small income card */}
            <Reveal y={30} delay={240}>
              <div className="rounded-3xl border border-zinc-100 bg-white p-5 shadow-[0_30px_60px_-30px_rgba(36,38,47,0.3)] transition-transform duration-300 hover:-translate-y-1.5">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Recovered</span><span>Past 30 days ▾</span>
                </div>
                <div className="mt-3 flex items-end gap-2">
                  <span className="text-3xl font-bold tracking-tight text-brand-900">$1,600</span>
                  <span className="mb-1 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500">Aug 12</span>
                </div>
                <MiniLine className="mt-3 h-8 w-full" stroke="#6e7590" />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Why finance teams choose us */}
      <section id="why" className="mx-auto max-w-6xl px-6 py-20">
        <Reveal className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-xs font-medium text-zinc-600 shadow-sm">
            <Sparkles className="h-3.5 w-3.5" /> Recognition
          </span>
          <h2 className="mt-6 text-5xl font-bold tracking-tight text-brand-900 sm:text-6xl">
            Why finance teams <span className="font-serif text-[3.2rem] font-normal italic sm:text-[4rem]">choose us</span>
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-10 md:grid-cols-3">
          {[
            { icon: TrendingUp, title: "Recover overcharges", body: "Most teams that adopt Axiom catch errors they were paying on every cycle." },
            { icon: PiggyBank, title: "Tighter compliance", body: "Axiom users improve their policy adherence and approval discipline." },
            { icon: Lightbulb, title: "The Axiom effect", body: "Finance teams often find their relationship with vendor spend transformed." },
          ].map((c, i) => (
            <Reveal key={c.title} delay={i * 100}>
              <div className="group">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 shadow-sm">
                  <c.icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <h3 className="mt-5 text-xl font-medium text-brand-900">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">{c.body}</p>
                <div className="mt-6 flex h-56 items-center justify-center rounded-3xl border border-dashed border-zinc-200 bg-zinc-50/70 p-6 transition-colors group-hover:bg-zinc-50">
                  <ChooseCard index={i} />
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA panel with scattered cards */}
      <section id="start" className="mx-auto max-w-6xl px-6 py-20">
        <Reveal y={32}>
          <div className="relative overflow-hidden rounded-[32px] px-6 py-24 text-center"
            style={{ background: "linear-gradient(180deg, #dfe2ea 0%, #c9cedd 100%)" }}>
            {/* scattered cards */}
            <div className="pointer-events-none absolute left-6 top-10 hidden w-44 -rotate-3 rounded-2xl bg-brand-800 p-3 text-white shadow-xl lg:block">
              <div className="flex items-center justify-between text-[10px]"><span>My profile</span><span className="text-white/40">@alex</span></div>
              <div className="mt-2 rounded-lg bg-white/10 p-1.5 text-[9px] text-white/60">Account settings</div>
            </div>
            <div className="pointer-events-none absolute right-8 top-16 hidden w-44 rotate-3 rounded-2xl border border-zinc-100 bg-white p-3 shadow-xl lg:block">
              <Gauge pct={70} value="$4,682" caption="Recovered" />
            </div>
            <div className="pointer-events-none absolute bottom-10 left-10 hidden w-44 rotate-2 rounded-2xl border border-zinc-100 bg-white p-3 shadow-xl lg:block">
              <div className="text-[10px] text-zinc-400">Tax flagged</div>
              <div className="mt-1 flex items-end gap-1.5">
                <span className="text-2xl font-bold text-brand-900">$1.2k</span>
                <span className="mb-1 rounded bg-emerald-100 px-1 text-[9px] font-medium text-emerald-700">+12%</span>
              </div>
              <div className="mt-2 h-2 w-2/3 rounded-full bg-red-400/70" />
            </div>
            <div className="pointer-events-none absolute bottom-12 right-10 hidden w-48 -rotate-2 rounded-2xl border border-zinc-100 bg-white p-3 shadow-xl lg:block">
              <div className="flex items-center justify-between text-[10px] text-zinc-400"><span>Recovered</span><span>Past 30 days</span></div>
              <div className="mt-1 text-2xl font-bold text-brand-900">$1,600</div>
              <MiniLine className="mt-1 h-6 w-full" stroke="#6e7590" />
            </div>

            <div className="relative">
              <Logo size="h-14 w-14" showText={false} className="justify-center" />
              <h2 className="mx-auto mt-6 max-w-lg text-4xl font-bold tracking-tight text-brand-900 sm:text-5xl">
                Your invoices, <span className="font-serif text-[2.6rem] font-normal italic sm:text-[3.2rem]">your control.</span> Axiom
              </h2>
              <Link href="/auth/register"
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand-800 px-7 py-3.5 text-sm font-medium text-white transition-transform hover:scale-[1.03]">
                Start free trial <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-6 pb-2 pt-16 text-center">
          <nav className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-zinc-600">
            {["Company", "Features", "Solutions", "App", "Community", "Legal"].map((l) => (
              <span key={l} className="cursor-pointer transition-colors hover:text-brand-900">{l}</span>
            ))}
          </nav>
          <div className="mt-6 flex items-center justify-center gap-3 text-zinc-500">
            {[Globe, AtSign, MessageCircle, Mail].map((Icon, i) => (
              <span key={i} className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 transition-colors hover:bg-zinc-50">
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </span>
            ))}
          </div>
        </div>
        {/* giant faded wordmark */}
        <div className="select-none px-6 pt-8 text-center leading-none">
          <span className="block bg-gradient-to-b from-brand-200 to-transparent bg-clip-text text-[24vw] font-bold tracking-tighter text-transparent">
            axiom
          </span>
        </div>
      </footer>
    </div>
  );
}

// --- larger mockups ----------------------------------------------------------

function DashboardMock() {
  return (
    <div className="text-brand-900">
      {/* top bar */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-600 text-[10px] font-bold text-white">A</div>
        </div>
        <div className="hidden items-center gap-1 rounded-full bg-zinc-50 p-1 text-xs text-zinc-500 sm:flex">
          {["Audits", "Dashboard", "Reports", "Support"].map((t, i) => (
            <span key={t} className={i === 1 ? "rounded-full bg-brand-800 px-3 py-1 text-white" : "px-3 py-1"}>{t}</span>
          ))}
        </div>
        <div className="flex items-center gap-2 text-zinc-400">
          <Settings className="h-4 w-4" /><Bell className="h-4 w-4" />
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-brand-400 to-brand-600" />
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold tracking-tight">Good morning, Alex!</h3>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-800 px-3 py-1.5 text-xs font-medium text-white">
            <Plus className="h-3.5 w-3.5" /> New audit
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5"><Filter className="h-3.5 w-3.5" /> Filter</span>
          <span className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5">Last month ▾</span>
          <span className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5"><Download className="h-3.5 w-3.5" /> Export</span>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5"><Search className="h-3.5 w-3.5" /> Search</span>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {/* invoices / card */}
          <div className="rounded-2xl border border-zinc-100 p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold">My invoices</span>
              <span className="text-zinc-400">+ Add</span>
            </div>
            <div className="mt-3 aspect-[1.6/1] rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 p-3 text-white">
              <div className="flex items-center justify-between">
                <div className="h-5 w-7 rounded bg-white/30" />
                <Receipt className="h-4 w-4 text-white/70" />
              </div>
              <div className="mt-6 text-sm font-semibold tracking-widest">INV ···· 4471</div>
              <div className="mt-1 text-[10px] text-white/60">Acme Logistics · 09/26</div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-zinc-500">Recovered</span>
              <span className="font-semibold">$16,531.54</span>
            </div>
          </div>

          {/* recovery plan */}
          <div className="rounded-2xl border border-zinc-100 p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold">Recovery plan</span>
              <span className="text-zinc-400">View details ›</span>
            </div>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-3xl font-bold tracking-tight">$37k</span>
              <span className="mb-1 text-[10px] text-zinc-400">flagged this month</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px] text-zinc-400">
              <span>$22,548</span><span>$12,432</span><span>$16,864</span>
            </div>
            <div className="mt-2 flex items-end gap-2">
              <div className="h-14 flex-1 rounded-lg bg-brand-800" />
              <div className="h-20 flex-1 rounded-lg bg-brand-400" />
              <div className="relative h-16 flex-1 rounded-lg bg-brand-300">
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-white px-1.5 py-0.5 text-[8px] font-bold shadow ring-1 ring-zinc-100">+5%</span>
              </div>
            </div>
          </div>

          {/* gauge */}
          <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-100 p-4">
            <Gauge pct={74} value="$4,682" caption="Available" />
            <div className="mt-3 flex gap-3 text-[10px] text-zinc-400">
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-brand-400" />Verified</span>
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-brand-500" />Planned</span>
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-brand-700" />Other</span>
            </div>
          </div>
        </div>

        {/* bottom partial row */}
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-zinc-100 p-4 text-xs lg:col-span-2">
            <div className="flex items-center justify-between font-semibold"><span>Vendors</span><span className="text-zinc-400">Past 30 days ▾</span></div>
            <div className="mt-3 space-y-2">
              {[["Acme Logistics", "$9,681.49"], ["Globex Supplies", "$5,299.52"], ["Initech Consulting", "$1,762.15"]].map(([n, v]) => (
                <div key={n} className="flex items-center justify-between border-b border-zinc-50 pb-2 text-zinc-600">
                  <span>{n}</span><span className="font-medium text-brand-900">{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 p-4 text-white">
            <div className="text-xs text-white/70">Audit streak</div>
            <div className="mt-2 text-2xl font-bold">128 clean</div>
            <MiniLine className="mt-3 h-8 w-full" stroke="rgba(255,255,255,0.7)" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ChooseCard({ index }: { index: number }) {
  if (index === 0) {
    return (
      <div className="w-full rotate-[-3deg] rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 p-5 text-white shadow-xl">
        <div className="text-xs text-white/70">Recovered</div>
        <div className="mt-3 flex items-end gap-2">
          <span className="text-3xl font-bold">$3,800</span>
          <span className="mb-1 rounded bg-white/20 px-1.5 text-[10px]">Feb 12</span>
        </div>
        <MiniLine className="mt-3 h-8 w-full" stroke="rgba(255,255,255,0.7)" />
      </div>
    );
  }
  if (index === 1) {
    return (
      <div className="w-full rounded-2xl border border-zinc-100 bg-white p-5 shadow-xl">
        <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
          <Calculator className="h-3.5 w-3.5" /> Category insights
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] text-zinc-400">Freight</div>
            <div className="flex items-center gap-1"><span className="text-xl font-bold">$1.2k</span><span className="rounded bg-emerald-100 px-1 text-[9px] text-emerald-700">+12%</span></div>
            <div className="mt-1 h-2 w-full rounded-full bg-red-400/70" />
          </div>
          <div>
            <div className="text-[10px] text-zinc-400">Software</div>
            <div className="text-xl font-bold">$4.5k</div>
            <div className="mt-1 h-2 w-2/3 rounded-full bg-zinc-200" />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="w-full space-y-2">
      <div className="rounded-2xl border border-zinc-100 bg-white p-4 text-xs shadow-xl">
        <div className="flex items-center justify-between font-semibold"><span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-brand-600" /> Recovered</span><span>$16,531.54</span></div>
        <div className="mt-2 space-y-1.5 text-zinc-500">
          {[["Acme Logistics", "$9,681.49"], ["Globex Supplies", "$5,299.52"], ["Compliance score", "94%"]].map(([n, v]) => (
            <div key={n} className="flex justify-between"><span>{n}</span><span className="font-medium text-brand-900">{v}</span></div>
          ))}
        </div>
      </div>
      <div className="ml-6 rounded-xl bg-brand-800 p-2.5 text-[10px] text-white shadow-xl">
        <span className="flex items-center gap-1.5"><FileSearch className="h-3 w-3" /> My profile <span className="ml-auto text-white/40">@alex</span></span>
      </div>
    </div>
  );
}
