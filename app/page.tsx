"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, lastCompany } from "@/lib/api";
import type { Me } from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  // Already signed in, or used a portal on this device before: go straight there.
  useEffect(() => {
    api<{ me: Me | null }>("/api/me")
      .then(({ me }) => {
        if (me) router.replace(me.role === "admin" ? "/office" : "/run");
        else {
          const last = lastCompany();
          if (last) setCompany(last.name ?? last.slug);
        }
      })
      .catch(() => {});
  }, [router]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-8 flex items-center gap-3">
        <img src="/icon.svg" alt="" className="h-12 w-12" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">RouteRun</h1>
          <p className="text-sm text-slate-500">Plan the run. Complete the job. Tell the customer.</p>
        </div>
      </div>

      <form
        className="card p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(undefined);
          try {
            const c = await api<{ slug: string }>(`/api/companies?find=${encodeURIComponent(company.trim())}`);
            router.push(`/c/${c.slug}`);
          } catch (err) {
            setError((err as Error).message);
            setBusy(false);
          }
        }}
      >
        <h2 className="font-semibold">Log in to your company</h2>
        <label className="label mt-3" htmlFor="company">
          Company name
        </label>
        <input
          id="company"
          className="field"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="e.g. Australian Zone"
          autoComplete="organization"
        />
        <p className="mt-1 text-xs text-slate-500">Drivers and office staff both start here. Drivers then log in with their mobile number.</p>
        {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button className="btn-primary mt-4 w-full" disabled={!company.trim() || busy}>
          {busy ? "Finding…" : "Continue"}
        </button>
      </form>

      <div className="card mt-4 p-5">
        <h2 className="font-semibold">New to RouteRun?</h2>
        <p className="mt-1 text-sm text-slate-500">Set up your company, add drivers and vehicles, and start assigning jobs.</p>
        <Link href="/signup" className="btn-ghost mt-4 w-full">
          Create a company account
        </Link>
      </div>
    </main>
  );
}
