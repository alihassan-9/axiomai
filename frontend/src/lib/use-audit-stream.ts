"use client";

// SSE consumption via fetch streaming (EventSource cannot send Authorization headers).
import { useEffect, useState } from "react";
import { loadTokens } from "./api";
import type { ProgressEvent } from "./types";

export function useAuditStream(auditId: string, active: boolean) {
  const [events, setEvents] = useState<ProgressEvent[]>([]);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();

    async function consume() {
      const tokens = loadTokens();
      if (!tokens) return;
      try {
        const response = await fetch(`/api/v1/audit/${auditId}/stream`, {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
          signal: controller.signal,
        });
        if (!response.ok || !response.body) return;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() ?? "";
          for (const block of blocks) {
            const dataLine = block.split("\n").find((l) => l.startsWith("data:"));
            if (!dataLine) continue;
            try {
              const event = JSON.parse(dataLine.slice(5).trim()) as ProgressEvent;
              setEvents((prev) => [...prev, event]);
            } catch {
              // ignore malformed frames
            }
          }
        }
      } catch {
        // stream aborted or network error — polling covers refresh
      }
    }

    void consume();
    return () => controller.abort();
  }, [auditId, active]);

  return events;
}
