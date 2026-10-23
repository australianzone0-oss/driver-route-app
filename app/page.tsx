"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, lastCompany } from "@/lib/api";
import type { Me } from "@/lib/types";

type Match = { name: string; slug: string };
type Found = { matches: Match[]; by: "email" | "name" | "suggest"; exact: boolean };

function portalUrl(m: Match, by: string, q: string) {
  const prefill = by === "email" ? `?as=office&login=${encodeURIComponent(q)}` : "";
  return `/c/${m.slug}${prefill}`;
}

export default function Home() {
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [error, setError] = useState<string>();
  const [choices, setChoices] = useState<{ list: Match[]; exact: boolean; query: string; by: string }>();
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
          const q = company.trim();
          setBusy(true);
          setError(undefined);
          setChoices(undefined);
          try {
            const r = await api<Found>(`/api/companies?find=${encodeURIComponent(q)}`);
            if (r.exact && r.matches.length === 1) return router.push(portalUrl(r.matches[0], r.by, q));
            if (r.matches.length) setChoices({ list: r.matches, exact: r.exact, query: q, by: r.by });
            else
              setError(
                r.by === "email"
                  ? "No office login uses that email. Check it, or try your company name."
                  : "We couldn't find that company. Check the spelling, or try your office email instead.",
              );
          } catch (err) {
            setError((err as Error).message);
          }
          setBusy(false);
        }}
      >
        <h2 className="font-semibold">Log in to your company</h2>
        <label className="label mt-3" htmlFor="company">
          Company name or email
        </label>
        <input
          id="company"
          className="field"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="e.g. Australian Zone"
          autoComplete="organization"
        />
        <p className="mt-1 text-xs text-slate-500">Type your company name, or your office email. Drivers then log in with their mobile number.</p>
        {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {choices && (
          <div className="mt-3">
            <p className="text-sm font-medium text-slate-700">{choices.exact ? "Which company?" : "Did you mean:"}</p>
            <ul className="mt-2 space-y-2">
              {choices.list.map((m) => (
                <li key={m.slug}>
                  <button
                    type="button"
                    className="btn-ghost w-full justify-between py-2.5"
                    onClick={() => router.push(portalUrl(m, choices.by, choices.query))}
                  >
                    <span>{m.name}</span>
                    <span className="text-xs font-normal text-slate-400">/c/{m.slug}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
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
