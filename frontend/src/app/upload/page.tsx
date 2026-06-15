"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight, ArrowUp, Banknote, CheckCircle2, FileText, Play, Plus, ShieldCheck, Sparkles, X,
} from "lucide-react";
import { api, apiError } from "@/lib/api";
import type { Audit, Doc } from "@/lib/types";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import { AppShell } from "@/components/app-shell";
import { Spinner, StatusBadge } from "@/components/ui";

const ACCEPT = { "application/pdf": [".pdf"], "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"] };
type Mode = "invoice" | "policy";
interface Staged { file: File; mode: Mode }
interface Msg { id: string; role: "user" | "assistant"; text?: string; files?: string[]; audit?: Audit }

const uid = () => Math.random().toString(36).slice(2);

export default function UploadPage() {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [staged, setStaged] = useState<Staged[]>([]);
  const [mode, setMode] = useState<Mode>("invoice");
  const [busy, setBusy] = useState(false);

  const documents = useQuery({
    queryKey: ["documents"],
    queryFn: async () => (await api.get<Doc[]>("/documents")).data,
    refetchInterval: 5000,
  });
  const docs = useMemo(() => documents.data ?? [], [documents.data]);
  const activePolicy = useMemo(
    () => [...docs.filter((d) => d.type === "policy")]
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))[0],
    [docs],
  );
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["documents"] });
  const push = (m: Omit<Msg, "id">) => setMessages((prev) => [...prev, { id: uid(), ...m }]);

  // Drag/click only STAGES files; nothing is sent until the user hits enter/arrow.
  const onDrop = (files: File[]) =>
    setStaged((s) => [...s, ...files.map((file) => ({ file, mode }))]);
  const { getRootProps, getInputProps, open, isDragActive } = useDropzone({
    onDrop, accept: ACCEPT, maxSize: 25 * 1024 * 1024, noClick: true, noKeyboard: true,
  });

  async function processFile(s: Staged) {
    const form = new FormData();
    form.append("file", s.file);
    if (s.mode === "policy") {
      await api.post("/documents/policy/upload", form, { headers: { "Content-Type": "multipart/form-data" } });
      refresh();
      push({ role: "assistant", text: `Policy “${s.file.name}” saved and enforced on every audit until you replace it.` });
    } else {
      const { data: doc } = await api.post<Doc>("/documents/upload", form, { headers: { "Content-Type": "multipart/form-data" } });
      refresh();
      const { data: audit } = await api.post<Audit>("/audit/run", { doc_id: doc.id });
      push({ role: "assistant", text: `Audited “${s.file.name}”.`, audit });
    }
  }

  async function send() {
    if (busy) return;
    const text = input.trim();
    const files = [...staged];
    if (!text && files.length === 0) return;
    setInput("");
    setStaged([]);
    push({ role: "user", text: text || undefined, files: files.length ? files.map((s) => s.file.name) : undefined });
    setBusy(true);
    try {
      for (const s of files) await processFile(s);
      if (text) {
        const history = messages.slice(-6).map((m) => ({ role: m.role, content: m.text ?? "" }));
        const { data } = await api.post<{ reply: string }>("/chat", { message: text, history });
        push({ role: "assistant", text: data.reply });
      }
    } catch (e) {
      push({ role: "assistant", text: apiError(e) });
    } finally {
      setBusy(false);
    }
  }

  async function runDoc(doc: Doc) {
    if (busy) return;
    push({ role: "user", text: `Run audit on ${doc.filename}` });
    setBusy(true);
    try {
      const { data: audit } = await api.post<Audit>("/audit/run", { doc_id: doc.id });
      push({ role: "assistant", text: `Audited “${doc.filename}”.`, audit });
    } catch (e) {
      push({ role: "assistant", text: apiError(e) });
    } finally {
      setBusy(false);
    }
  }

  const empty = messages.length === 0;
  const canSend = !busy && (input.trim().length > 0 || staged.length > 0);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <section className={cn("flex flex-col", empty && "min-h-[58vh] justify-center")}>
          {empty ? (
            <div className="mb-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow-lg">
                <Sparkles className="h-6 w-6" />
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-brand-900">
                How can I help with your{" "}
                <span className="font-serif text-[1.2em] font-normal italic text-brand-500">invoices?</span>
              </h1>
              <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
                Attach one or more invoices and I’ll audit them; attach a policy to enforce it on every
                audit. Or just ask me about your audits, savings, and violations.
              </p>
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              {messages.map((m) => <Bubble key={m.id} msg={m} />)}
              {busy && (
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Spinner className="h-4 w-4" /> Working…
                </div>
              )}
            </div>
          )}

          {/* Composer */}
          <div {...getRootProps()}
            className={cn(
              "rounded-3xl border bg-white p-3 shadow-[0_1px_2px_rgba(20,18,45,0.04),0_18px_40px_-24px_rgba(20,18,45,0.25)] transition-colors",
              isDragActive ? "border-brand-400 ring-4 ring-brand-100" : "border-zinc-200/80",
            )}>
            <input {...getInputProps()} />

            {/* staged file chips */}
            {staged.length > 0 && (
              <div className="mb-1 flex flex-wrap gap-2 px-1 pt-1">
                {staged.map((s, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 py-1 pl-2 pr-1 text-xs text-brand-900">
                    {s.mode === "policy" ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> : <FileText className="h-3.5 w-3.5 text-brand-500" />}
                    <span className="max-w-[160px] truncate">{s.file.name}</span>
                    <button type="button" onClick={() => setStaged((p) => p.filter((_, j) => j !== i))}
                      className="rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
              rows={1}
              placeholder="Ask about your audits, or attach invoices / a policy…"
              className="max-h-40 w-full resize-none bg-transparent px-2 py-1.5 text-sm text-brand-900 placeholder:text-zinc-400 focus:outline-none"
            />
            <div className="mt-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button type="button" onClick={open} disabled={busy}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-brand-700 disabled:opacity-50"
                  title="Attach files">
                  <Plus className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-1 rounded-full bg-zinc-100 p-1 text-xs font-medium">
                  {(["invoice", "policy"] as Mode[]).map((m) => (
                    <button key={m} type="button" onClick={() => setMode(m)}
                      className={cn("rounded-full px-3 py-1 capitalize transition-colors",
                        mode === m ? "bg-white text-brand-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700")}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <button type="button" onClick={() => void send()} disabled={!canSend}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-r from-brand-600 to-brand-800 text-white shadow-lg shadow-brand-700/25 transition-all hover:opacity-95 active:scale-95 disabled:opacity-40">
                {busy ? <Spinner className="h-4 w-4 text-white" /> : <ArrowUp className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <p className="mt-2 px-2 text-center text-[11px] text-zinc-400">
            {activePolicy ? <>Active policy: <span className="font-medium text-zinc-500">{activePolicy.filename}</span> · enforced on every audit</>
              : "No policy set yet — switch to Policy and attach one to enforce compliance"}
          </p>
        </section>

        {/* History */}
        <section className="mt-12">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">Recent documents</h2>
          <div className="space-y-3">
            {documents.isLoading ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : docs.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-zinc-200 bg-white/50 py-8 text-center text-sm text-zinc-400">
                Nothing uploaded yet — attach an invoice above to begin.
              </p>
            ) : (
              [...docs].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
                .map((d) => (
                  <HistoryCard key={d.id} doc={d} isActivePolicy={activePolicy?.id === d.id}
                    onRun={() => void runDoc(d)} busy={busy} />
                ))
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] space-y-2">
          {msg.files && (
            <div className="flex flex-wrap justify-end gap-2">
              {msg.files.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-800 px-3 py-1.5 text-xs font-medium text-white shadow-sm">
                  <FileText className="h-3.5 w-3.5 text-white/70" /> {f}
                </span>
              ))}
            </div>
          )}
          {msg.text && (
            <div className="rounded-2xl rounded-br-md bg-gradient-to-br from-brand-600 to-brand-800 px-4 py-2.5 text-sm text-white shadow-sm">
              {msg.text}
            </div>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[88%] space-y-2">
        {msg.text && (
          <div className="rounded-2xl rounded-bl-md border border-zinc-200/70 bg-white px-4 py-2.5 text-sm leading-relaxed text-brand-900 shadow-sm">
            <p className="whitespace-pre-wrap">{msg.text}</p>
          </div>
        )}
        {msg.audit && <AuditResultCard audit={msg.audit} />}
      </div>
    </div>
  );
}

function AuditResultCard({ audit }: { audit: Audit }) {
  const inv = audit.findings_json?.invoice;
  const vendor = inv?.vendor || "Invoice";
  const overcharge = audit.savings_amount > 0;
  const math = audit.findings_json?.math_findings?.length ?? 0;
  const policy = audit.findings_json?.policy_findings?.length ?? 0;
  const completed = audit.status === "completed";

  return (
    <div className="w-[320px] overflow-hidden rounded-2xl border border-zinc-200/70 bg-white shadow-[0_1px_2px_rgba(20,18,45,0.04),0_18px_40px_-24px_rgba(20,18,45,0.25)]">
      <div className="flex items-center justify-between px-5 pt-4">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-brand-900">{vendor}</div>
          {inv?.invoice_number && <div className="text-[11px] text-zinc-400">{inv.invoice_number}</div>}
        </div>
        <StatusBadge status={audit.status} />
      </div>

      <div className="px-5 py-4">
        {overcharge ? (
          <div className="rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 p-4 text-white">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-white/70">
              <Banknote className="h-3.5 w-3.5" /> Overcharge detected
            </div>
            <div className="mt-1 text-3xl font-bold tracking-tight">{formatMoney(audit.savings_amount)}</div>
            <div className="text-[11px] text-white/60">recoverable before payment</div>
          </div>
        ) : completed ? (
          <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-4 text-emerald-700">
            <CheckCircle2 className="h-5 w-5" />
            <div className="text-sm font-semibold">Verified — arithmetic checks out</div>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-2xl bg-zinc-50 p-4 text-zinc-500">
            <Spinner className="h-4 w-4" /> <span className="text-sm">Auditing… open to watch live</span>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-zinc-50 py-2">
            <div className={cn("text-lg font-bold", math ? "text-red-500" : "text-brand-900")}>{math}</div>
            <div className="text-[10px] uppercase tracking-wide text-zinc-400">Math issues</div>
          </div>
          <div className="rounded-xl bg-zinc-50 py-2">
            <div className={cn("text-lg font-bold", policy ? "text-amber-500" : "text-brand-900")}>{policy}</div>
            <div className="text-[10px] uppercase tracking-wide text-zinc-400">Policy flags</div>
          </div>
        </div>

        <Link href={`/audit/${audit.id}`}
          className="mt-4 flex items-center justify-center gap-1 rounded-xl border border-zinc-200 py-2 text-xs font-semibold text-brand-700 transition-colors hover:bg-zinc-50">
          View full audit <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

function HistoryCard({ doc, isActivePolicy, onRun, busy }: {
  doc: Doc; isActivePolicy: boolean; onRun: () => void; busy: boolean;
}) {
  const isInvoice = doc.type === "invoice";
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(20,18,45,0.04),0_14px_30px_-20px_rgba(20,18,45,0.2)]">
      <div className="flex min-w-0 items-center gap-3">
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm",
          isInvoice ? "bg-gradient-to-br from-brand-400 to-brand-700" : "bg-gradient-to-br from-emerald-400 to-emerald-600")}>
          {isInvoice ? <FileText className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-brand-900">{doc.filename}</div>
          <div className="text-xs text-zinc-400"><span className="capitalize">{doc.type}</span> · {formatDate(doc.created_at)}</div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {isInvoice ? (
          <button type="button" onClick={onRun} disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-brand-800 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-brand-700/25 transition-all hover:opacity-95 active:scale-95 disabled:opacity-50">
            <Play className="h-3 w-3" /> Run audit
          </button>
        ) : (
          <>
            {isActivePolicy && <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">Active</span>}
            <StatusBadge status={doc.status} />
          </>
        )}
      </div>
    </div>
  );
}
