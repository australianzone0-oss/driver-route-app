"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { actions, useStore } from "@/lib/store";

export default function SignIn() {
  const { drivers, session, ready } = useStore();
  const router = useRouter();
  const [driverId, setDriverId] = useState("d1");

  useEffect(() => {
    if (!ready || !session) return;
    router.replace(session.role === "office" ? "/office" : "/run");
  }, [ready, session, router]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-8 flex items-center gap-3">
        <img src="/icon.svg" alt="" className="h-12 w-12" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">RouteRun</h1>
          <p className="text-sm text-slate-500">Plan the run. Complete the job. Tell the customer.</p>
        </div>
      </div>

      <section className="card p-5">
        <h2 className="font-semibold">I&apos;m a driver</h2>
        <label className="label mt-3">Driver</label>
        <select className="field" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <button
          className="btn-primary mt-4 w-full"
          onClick={() => {
            actions.signIn({ role: "driver", driverId });
            router.push("/run");
          }}
        >
          Start my run
        </button>
      </section>

      <section className="card mt-4 p-5">
        <h2 className="font-semibold">Office</h2>
        <p className="mt-1 text-sm text-slate-500">Create jobs and assign them to drivers.</p>
        <button
          className="btn-ghost mt-4 w-full"
          onClick={() => {
            actions.signIn({ role: "office" });
            router.push("/office");
          }}
        >
          Open office board
        </button>
      </section>

      <p className="mt-6 text-center text-xs text-slate-400">
        Prototype: data is saved in this browser only. Real sign-in comes with the Supabase setup.
      </p>
    </main>
  );
}
