"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, lastPortal } from "@/lib/api";
import { slugify } from "@/lib/phone";
import type { Me } from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");

  // Already signed in, or used a portal on this device before: go straight there.
  useEffect(() => {
    api<{ me: Me | null }>("/api/me")
      .then(({ me }) => {
        if (me) router.replace(me.role === "admin" ? "/office" : "/run");
        else {
          const slug = lastPortal();
          if (slug) setCode(slug);
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
        onSubmit={(e) => {
          e.preventDefault();
          const slug = slugify(code);
          if (slug) router.push(`/c/${slug}`);
        }}
      >
        <h2 className="font-semibold">Log in to your company</h2>
        <label className="label mt-3" htmlFor="code">
          Company portal
        </label>
        <div className="flex items-center rounded-xl border border-slate-300 bg-white focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
          <span className="pl-3 text-sm text-slate-400">/c/</span>
          <input
            id="code"
            className="w-full rounded-xl bg-transparent px-1 py-2.5 text-[15px] outline-none"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="your-company"
            autoCapitalize="none"
            autoCorrect="off"
          />
        </div>
        <p className="mt-1 text-xs text-slate-500">Your office gives you this. Drivers log in with their mobile number.</p>
        <button className="btn-primary mt-4 w-full" disabled={!slugify(code)}>
          Continue
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
