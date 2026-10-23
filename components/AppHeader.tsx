"use client";

import {
  BarChart3, Boxes, ClipboardList, DollarSign, FileText, Gauge, Settings, Truck, Users, Wrench, type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "@/lib/api";
import type { Me } from "@/lib/types";

const officeTabs: { href: string; label: string; icon: LucideIcon; also?: string[] }[] = [
  { href: "/office", label: "Dashboard", icon: Gauge },
  { href: "/office/jobs", label: "Jobs", icon: ClipboardList },
  { href: "/office/customers", label: "Customers", icon: Users },
  { href: "/office/containers", label: "Containers", icon: Boxes },
  { href: "/office/drivers", label: "Resources", icon: Truck, also: ["/office/vehicles", "/office/trailers"] },
  { href: "/office/finance", label: "Finance", icon: DollarSign },
  { href: "/office/reports", label: "Reports", icon: FileText },
  { href: "/office/tools", label: "Tools", icon: Wrench },
  { href: "/office/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/office/settings", label: "Settings", icon: Settings },
];

function isActive(path: string, t: (typeof officeTabs)[number]) {
  if (t.href === "/office") return path === "/office";
  return [t.href, ...(t.also ?? [])].some((h) => path === h || path.startsWith(`${h}/`));
}

export function AppHeader({ me, title, back }: { me: Me; title?: string; back?: string }) {
  const router = useRouter();
  const path = usePathname();
  const showTabs = me.role === "admin" && !back;

  return (
    <header className="sticky top-0 z-[1000] bg-brand-700 text-white shadow">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        {back ? (
          <Link href={back} className="-ml-1 rounded-lg px-2 py-1 text-lg hover:bg-white/10" aria-label="Back">
            ←
          </Link>
        ) : (
          <img src="/icon.svg" alt="" className="h-7 w-7" />
        )}
        <div className="min-w-0">
          <p className="truncate text-base font-semibold leading-tight">{title ?? me.company.name}</p>
          {title && <p className="truncate text-xs text-white/70">{me.company.name}</p>}
        </div>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <span className="hidden text-white/80 sm:inline">{me.name}</span>
          <button className="rounded-lg px-2 py-1 text-white/90 hover:bg-white/10" onClick={() => signOut(router, me.company.slug)}>
            Sign out
          </button>
        </div>
      </div>
      {showTabs && (
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none]">
          {officeTabs.map((t) => {
            const on = isActive(path, t);
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={on ? "page" : undefined}
                className={`flex min-w-[4.75rem] shrink-0 flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-xs font-medium ${on ? "bg-white text-brand-700" : "text-white/85 hover:bg-white/10"}`}
              >
                <t.icon className="h-5 w-5" aria-hidden />
                {t.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
