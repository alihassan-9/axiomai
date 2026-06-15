"use client";

// Authenticated layout: left sidebar + search topbar. Redirects to login when unauthenticated.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  ArrowRight, BarChart3, FileText, LayoutDashboard, LogOut,
  Settings, Shield, ShieldCheck, Sparkles, Upload,
} from "lucide-react";
import { useAuth } from "@/stores/auth";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui";
import { Logo } from "@/components/logo";

const MENU = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/audits", label: "Audits", icon: FileText },
  { href: "/compliance", label: "Compliance", icon: ShieldCheck },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];
const GENERAL = [
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/admin", label: "Admin", icon: Shield, adminOnly: true },
];

function initials(name: string): string {
  return name.split(/[\s@.]+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, hydrate, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!loading && !user) router.replace("/auth/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5"
        style={{ background: "radial-gradient(120% 90% at 50% 0%, #eef0f5 0%, #f5f6f8 60%, #ffffff 100%)" }}>
        <div className="animate-pulse">
          <Logo size="h-16 w-16" showText={false} priority />
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-400">
          <Spinner className="h-4 w-4" /> Loading your workspace…
        </div>
      </div>
    );
  }

  const NavLink = ({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) => {
    const active = pathname.startsWith(href);
    return (
      <Link
        href={href}
        className={cn(
          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
          active
            ? "bg-gradient-to-r from-brand-600 to-brand-800 text-white shadow-lg shadow-brand-700/25"
            : "text-zinc-500 hover:bg-zinc-100/80 hover:text-brand-900",
        )}
      >
        <Icon className={cn("h-[18px] w-[18px] transition-colors", active ? "text-white" : "text-zinc-400 group-hover:text-brand-600")} />
        {label}
      </Link>
    );
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 flex w-64 flex-col border-r border-zinc-200/60 bg-gradient-to-b from-white to-zinc-50/40 px-4 py-5 shadow-[1px_0_30px_-20px_rgba(20,18,45,0.25)]">
        <Link href="/dashboard" className="block px-1">
          <Logo priority />
        </Link>

        <nav className="mt-7 flex-1 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Menu</div>
          {MENU.map((item) => <NavLink key={item.href} {...item} />)}
          <div className="px-3 pb-2 pt-5 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">General</div>
          {GENERAL.filter((i) => !i.adminOnly || user.role === "admin").map((item) => <NavLink key={item.href} {...item} />)}
          <button
            onClick={() => void logout().then(() => router.replace("/"))}
            className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-[18px] w-[18px] text-zinc-400 transition-colors group-hover:text-red-500" /> Logout
          </button>
        </nav>

        {/* Bottom promo card */}
        <Link
          href="/upload"
          className="mt-4 block overflow-hidden rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 p-4 text-white shadow-[0_18px_40px_-22px_rgba(36,38,47,0.6)] transition-transform hover:scale-[1.02]"
        >
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-white/80" /> New audit
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-white/70">Upload an invoice and catch errors instantly.</p>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur">
            Open assistant <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </Link>

        {/* User identity */}
        <div className="mt-3 flex items-center gap-2.5 rounded-2xl border border-zinc-200/70 bg-white p-2 shadow-sm">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-[11px] font-bold text-white">
            {initials(user.full_name || user.email)}
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-xs font-semibold text-brand-900">{user.full_name || user.email}</div>
            <div className="truncate text-[10px] text-zinc-400">{user.email}</div>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <main className="ml-64 flex-1 px-6 py-6"
        style={{ background: "radial-gradient(120% 55% at 50% 0%, #dfe3ed 0%, #e9ebf2 35%, #f2f3f7 100%)" }}>
        {children}
      </main>
    </div>
  );
}

export function PageHeader({ title, accent, subtitle, action }: {
  title: string; accent?: string; subtitle?: string; action?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-brand-900 sm:text-3xl">
          {title}
          {accent && (
            <>{" "}<span className="font-serif text-[1.2em] font-normal italic text-brand-500">{accent}</span></>
          )}
        </h1>
        {subtitle && <p className="mt-1.5 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
