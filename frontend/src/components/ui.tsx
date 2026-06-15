"use client";

// Minimal shadcn-style component kit (button, card, input, badge, spinner, table).
import * as React from "react";
import { cn, SEVERITY_STYLES } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  className, variant = "primary", disabled, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-gradient-to-r from-brand-600 to-brand-800 text-white shadow-lg shadow-brand-700/25 hover:opacity-95",
    secondary: "bg-white text-brand-900 border border-zinc-200 shadow-sm hover:bg-zinc-50",
    ghost: "text-zinc-600 hover:bg-zinc-100",
    danger: "bg-red-600 text-white shadow-lg shadow-red-600/25 hover:bg-red-700",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold",
        "transition-all focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-1",
        "active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none",
        variants[variant], className,
      )}
      disabled={disabled}
      {...props}
    />
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(
      "rounded-2xl border border-zinc-200/70 bg-white",
      "shadow-[0_1px_2px_rgba(20,18,45,0.04),0_18px_40px_-24px_rgba(20,18,45,0.22)]",
      className,
    )} {...props} />
  );
}

export function CardHeader({ title, subtitle, action, icon: Icon }: {
  title: string; subtitle?: string; action?: React.ReactNode; icon?: React.ElementType;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-6 py-4">
      <div className="flex items-start gap-3">
        {Icon && (
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Icon className="h-4 w-4" />
          </span>
        )}
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight text-brand-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-brand-900",
          "placeholder:text-zinc-400 transition-colors focus:border-brand-400 focus:bg-white",
          "focus:outline-none focus:ring-4 focus:ring-brand-100",
          className,
        )}
        {...props}
      />
    );
  },
);

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-zinc-400", className)} {...props} />;
}

export function Badge({ severity, children, className }: {
  severity?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
      severity ? SEVERITY_STYLES[severity] ?? "bg-zinc-100 text-zinc-700 border-zinc-200"
               : "bg-zinc-100 text-zinc-700 border-zinc-200",
      className,
    )}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
    running: "bg-blue-100 text-blue-800 border-blue-200",
    processing: "bg-blue-100 text-blue-800 border-blue-200",
    pending: "bg-zinc-100 text-zinc-600 border-zinc-200",
    uploaded: "bg-zinc-100 text-zinc-600 border-zinc-200",
    extracted: "bg-emerald-100 text-emerald-800 border-emerald-200",
    indexed: "bg-emerald-100 text-emerald-800 border-emerald-200",
    failed: "bg-red-100 text-red-800 border-red-200",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
      styles[status] ?? "bg-zinc-100 text-zinc-600 border-zinc-200")}>
      {status}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("h-5 w-5 animate-spin text-brand-600", className)} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
            {headers.map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">{children}</tbody>
      </table>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <p className="text-sm font-medium text-zinc-700">{title}</p>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </div>
  );
}
