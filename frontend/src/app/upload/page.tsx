"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, Play, ShieldPlus } from "lucide-react";
import { api, apiError } from "@/lib/api";
import type { Audit, Doc } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button, Card, CardHeader, EmptyState, ErrorNote, Spinner, StatusBadge, Table } from "@/components/ui";

const ACCEPT = { "application/pdf": [".pdf"], "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"] };

function Dropzone({ kind, onDone }: { kind: "invoice" | "policy"; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(async (files: File[]) => {
    setError(null);
    setUploading(true);
    try {
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        const url = kind === "invoice" ? "/documents/upload" : "/documents/policy/upload";
        await api.post(url, form, { headers: { "Content-Type": "multipart/form-data" } });
      }
      onDone();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setUploading(false);
    }
  }, [kind, onDone]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: ACCEPT, maxSize: 25 * 1024 * 1024,
  });

  return (
    <div>
      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          isDragActive ? "border-brand-500 bg-brand-50" : "border-zinc-300 bg-white hover:border-brand-400"
        }`}
      >
        <input {...getInputProps()} />
        {uploading ? <Spinner /> : kind === "invoice"
          ? <FileUp className="h-8 w-8 text-brand-500" />
          : <ShieldPlus className="h-8 w-8 text-emerald-500" />}
        <p className="mt-3 text-sm font-medium text-zinc-700">
          {kind === "invoice" ? "Drop invoice PDFs / scans here" : "Drop company policy PDFs here"}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          {kind === "invoice"
            ? "Each file becomes an auditable document"
            : "Indexed into your RAG policy knowledge base"}
          {" · "}PDF, PNG, JPG · max 25 MB
        </p>
      </div>
      <div className="mt-2"><ErrorNote message={error} /></div>
    </div>
  );
}

export default function UploadPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const documents = useQuery({
    queryKey: ["documents"],
    queryFn: async () => (await api.get<Doc[]>("/documents")).data,
    refetchInterval: 5000,
  });

  const runAudit = useMutation({
    mutationFn: async (docId: string) =>
      (await api.post<Audit>("/audit/run", { doc_id: docId })).data,
    onSuccess: (audit) => router.push(`/audit/${audit.id}`),
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["documents"] });

  return (
    <AppShell>
      <PageHeader title="Upload Center" subtitle="Ingest invoices to audit and policies to enforce" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Dropzone kind="invoice" onDone={refresh} />
        <Dropzone kind="policy" onDone={refresh} />
      </div>

      <Card className="mt-8">
        <CardHeader title="Documents" subtitle="Everything uploaded by your organisation" />
        {documents.isLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : documents.data?.length ? (
          <Table headers={["File", "Type", "Status", "Uploaded", ""]}>
            {documents.data.map((d) => (
              <tr key={d.id} className="hover:bg-zinc-50">
                <td className="max-w-xs truncate px-4 py-3 font-medium">{d.filename}</td>
                <td className="px-4 py-3 capitalize text-zinc-600">{d.type}</td>
                <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                <td className="px-4 py-3 text-zinc-500">{formatDate(d.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  {d.type === "invoice" && (
                    <Button
                      variant="secondary"
                      className="px-3 py-1.5 text-xs"
                      disabled={runAudit.isPending}
                      onClick={() => runAudit.mutate(d.id)}
                    >
                      <Play className="h-3 w-3" /> Run audit
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState title="Nothing uploaded yet" hint="Drop a file above to begin" />
        )}
        {runAudit.isError && (
          <div className="px-5 pb-4"><ErrorNote message={apiError(runAudit.error)} /></div>
        )}
      </Card>
    </AppShell>
  );
}
