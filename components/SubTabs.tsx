"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Second-level tabs inside an office section, e.g. Resources → Drivers / Vehicles. */
export function SubTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <div className="inline-flex rounded-xl bg-white p-1 ring-1 ring-slate-200">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${path === t.href ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

export const RESOURCE_TABS = [
  { href: "/office/drivers", label: "Drivers" },
  { href: "/office/vehicles", label: "Vehicles" },
  { href: "/office/trailers", label: "Trailers" },
];
