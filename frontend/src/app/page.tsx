import Link from "next/link";
import { ArrowRight, Calculator, FileSearch, ShieldCheck, Sparkles, Zap } from "lucide-react";

const FEATURES = [
  {
    icon: FileSearch,
    title: "Intelligent Extraction",
    body: "OCR + LLM extraction turns messy invoice PDFs into structured, verifiable data — vendors, line items, taxes, totals.",
  },
  {
    icon: Calculator,
    title: "Symbolic Math Verification",
    body: "Every arithmetic relationship is recomputed with exact symbolic math. A one-cent overcharge gets flagged with the precise delta.",
  },
  {
    icon: ShieldCheck,
    title: "Policy Compliance via RAG",
    body: "Upload your expense policies once. Every invoice is checked against them — thresholds, vendor rules, category caps — with citations.",
  },
  {
    icon: Sparkles,
    title: "Explainable Audit Reports",
    body: "No black boxes. Each finding cites the exact line, formula, and policy clause, with a plain-English narrative for managers.",
  },
];

const STEPS: [string, string][] = [
  ["Upload", "Drop invoice PDFs and your policy documents."],
  ["Audit", "Five AI agents extract, verify, and cross-check in seconds."],
  ["Recover", "Catch overcharges and violations before you pay."],
];

export default function LandingPage() {
  return (
    <div className="bg-white text-zinc-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-semibold">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">N</div>
          Neuro-Symbolic Financial Auditor
        </div>
        <nav className="flex items-center gap-3">
          <Link href="/auth/login" className="px-3 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900">
            Sign in
          </Link>
          <Link href="/auth/register"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Get started
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 text-center">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
          <Zap className="h-3.5 w-3.5" /> Neural extraction + symbolic verification
        </div>
        <h1 className="mx-auto max-w-3xl text-5xl font-bold leading-tight tracking-tight">
          Stop paying for invoice errors you never see
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-zinc-600">
          Finance teams lose hours — and real money — manually checking vendor invoices against
          policies and contracts. Our AI audits every invoice in seconds: exact math verification,
          policy compliance with citations, and fully explainable reports.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/auth/register"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700">
            Start auditing free <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/auth/login"
            className="inline-flex items-center rounded-lg border border-zinc-300 px-6 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50">
            Sign in
          </Link>
        </div>
      </section>

      <section className="border-y border-zinc-100 bg-zinc-50 py-16">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 md:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-zinc-200 bg-white p-6">
              <f.icon className="h-6 w-6 text-brand-600" />
              <h3 className="mt-4 text-sm font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-2xl font-bold">How it works</h2>
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {STEPS.map(([title, body], index) => (
            <div key={title} className="text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 font-semibold text-white">
                {index + 1}
              </div>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-zinc-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-brand-950 py-16 text-center text-white">
        <h2 className="text-3xl font-bold">Catch the next $45 error before you pay it</h2>
        <p className="mx-auto mt-3 max-w-xl text-brand-200">
          Multi-tenant, role-based, fully audited. Built for accounting firms, finance teams, and procurement.
        </p>
        <Link href="/auth/register"
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-brand-900 hover:bg-brand-50">
          Create your workspace <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <footer className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8 text-xs text-zinc-500">
        <span>© 2026 Neuro-Symbolic Financial Auditor</span>
        <span>Built with Next.js, FastAPI, LangGraph & SymPy</span>
      </footer>
    </div>
  );
}
