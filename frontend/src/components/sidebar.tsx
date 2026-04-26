"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Building2,
  PieChart,
  Target,
  FileText,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CurrentUser } from "@/lib/auth";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Buchungen", icon: ArrowLeftRight },
  { href: "/accounts", label: "Konten", icon: Building2 },
  { href: "/reports", label: "Auswertungen", icon: PieChart },
  { href: "/budgets", label: "Budgets & Ziele", icon: Target },
  { href: "/contracts", label: "Verträge", icon: FileText },
  { href: "/settings", label: "Einstellungen", icon: Settings },
];

export function Sidebar({ user }: { user: CurrentUser }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col border-r border-border bg-card">
      <div className="px-4 py-5 border-b border-border">
        <span className="text-lg font-semibold tracking-tight">Finanzen</span>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname === href
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-border p-4 space-y-2">
        <p className="text-xs text-muted-foreground truncate">{user.name}</p>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut size={14} />
          Abmelden
        </button>
      </div>
    </aside>
  );
}
