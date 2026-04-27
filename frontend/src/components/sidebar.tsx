"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Building2,
  PieChart,
  Target,
  FileText,
  Upload,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Buchungen", icon: ArrowLeftRight },
  { href: "/accounts", label: "Konten", icon: Building2 },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/reports", label: "Auswertungen", icon: PieChart },
  { href: "/budgets", label: "Budgets & Ziele", icon: Target },
  { href: "/contracts", label: "Verträge", icon: FileText },
  { href: "/settings", label: "Einstellungen", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

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
    </aside>
  );
}
