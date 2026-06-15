"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

/** Premium custom dropdown: clean popover, dark selected row with a check. */
export function Select({ value, onChange, options, className }: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-3 text-sm text-brand-900 transition-colors hover:bg-white focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-100"
      >
        <span className="truncate">{current?.label ?? "Select"}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-zinc-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-zinc-200/70 bg-white p-1.5 shadow-[0_24px_50px_-20px_rgba(20,18,45,0.4)]">
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors",
                  selected ? "bg-brand-900 font-medium text-white" : "text-zinc-600 hover:bg-zinc-50",
                )}
              >
                <span className="truncate">{o.label}</span>
                {selected && <Check className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
