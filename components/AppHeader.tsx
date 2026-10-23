"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { actions, useStore } from "@/lib/store";

export function AppHeader({ title, back }: { title?: string; back?: string }) {
  const { session, drivers } = useStore();
  const router = useRouter();
  const who =
    session?.role === "office" ? "Office" : session?.role === "driver" ? drivers.find((d) => d.id === session.driverId)?.name : null;

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
        <span className="truncate text-base font-semibold">{title ?? "RouteRun"}</span>
        <div className="ml-auto flex items-center gap-2 text-sm">
          {who && <span className="hidden text-white/80 sm:inline">{who}</span>}
          {session && (
            <button
              className="rounded-lg px-2 py-1 text-white/90 hover:bg-white/10"
              onClick={() => {
                actions.signOut();
                router.push("/");
              }}
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
