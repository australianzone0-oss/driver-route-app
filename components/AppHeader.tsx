"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "@/lib/api";
import type { Me } from "@/lib/types";

const officeTabs = [
  { href: "/office", label: "Jobs" },
  { href: "/office/drivers", label: "Drivers" },
  { href: "/office/vehicles", label: "Vehicles" },
];

export function AppHeader({ me, title, back }: { me: Me; title?: string; back?: string }) {
  const router = useRouter();
  const path = usePathname();
  const showTabs = me.role === "admin" && !back;

  return (
    <header className="sticky top-0 z-[1000] bg-brand-700 text-white shadow">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
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
        <nav className="mx-auto flex max-w-5xl gap-1 px-3 pb-2">
          {officeTabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${path === t.href ? "bg-white text-brand-700" : "text-white/85 hover:bg-white/10"}`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
