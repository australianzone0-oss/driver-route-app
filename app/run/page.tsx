"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { CompleteSheet } from "@/components/CompleteSheet";
import { distanceKm, formatKm, formatMinutes, googleMapsLink, wazeLink } from "@/lib/geo";
import { planRun, type PlannedStop } from "@/lib/planner";
import { api, useApi, useMe } from "@/lib/api";
import type { Job, LatLng } from "@/lib/types";

const RunMap = dynamic(() => import("@/components/RunMap"), { ssr: false, loading: () => <div className="h-full w-full bg-slate-200" /> });

type Leg = { km: number; minutes: number; line: [number, number][] };

export default function RunPage() {
  const me = useMe("driver");
  const jobsApi = useApi<{ jobs: Job[] }>(me ? "/api/jobs" : null, 30000);
  const jobs = useMemo(() => jobsApi.data?.jobs ?? [], [jobsApi.data]);

  const [gps, setGps] = useState<LatLng | null>(null);
  const [gpsState, setGpsState] = useState<"waiting" | "on" | "off">("waiting");
  const [pinned, setPinned] = useState<string | null>(null);
  const [leg, setLeg] = useState<Leg | null>(null);
  const [completing, setCompleting] = useState<PlannedStop | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Follow the driver's location, ignoring jitter under 50 m.
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGpsState("off");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const next = { lat: p.coords.latitude, lng: p.coords.longitude };
        setGps((prev) => (prev && distanceKm(prev, next) < 0.05 ? prev : next));
        setGpsState("on");
      },
      () => setGpsState("off"),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const myJobs = jobs;

  // Without GPS, plan from the last stop completed.
  const lastDone = useMemo(() => {
    const done = myJobs.flatMap((j) => j.stops).filter((s) => s.status === "done" && s.completedAt);
    done.sort((a, b) => b.completedAt!.localeCompare(a.completedAt!));
    return done[0]?.location ?? null;
  }, [myJobs]);
  const start = gps ?? lastDone;

  const plan = useMemo(() => planRun(myJobs, start, pinned), [myJobs, start, pinned]);
  const next = plan[0];

  useEffect(() => {
    setLeg(null);
    if (!start || !next) return;
    const ctrl = new AbortController();
    fetch("/api/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points: [[start.lat, start.lng], [next.stop.location.lat, next.stop.location.lng]] }),
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setLeg({ km: d.km, minutes: d.minutes, line: d.line }))
      .catch(() => {});
    return () => ctrl.abort();
  }, [start, next?.stop.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const doneToday = myJobs.filter((j) => j.status === "completed").length;
  const totalKm = plan.reduce((sum, p) => sum + p.legKm, 0);

  async function confirm(d: { receivedBy?: string; photo?: string; signature?: string; notify: boolean }) {
    if (!completing) return;
    const { job, stop } = completing;
    setCompleting(null);
    setPinned(null);
    setToast(stop.type === "dropoff" ? "Completing job…" : "Saving pickup…");
    try {
      const r = await api<{ job: Job; completed: boolean }>(`/api/stops/${stop.id}/complete`, { body: d });
      jobsApi.setData((prev) => prev && { jobs: prev.jobs.map((j) => (j.id === r.job.id ? r.job : j)) });
      if (!r.completed) {
        setToast(`Picked up for ${job.customerName}. Drop-off added to your run.`);
      } else if (!r.job.notices.length) {
        setToast(`Job complete for ${job.customerName}.`);
      } else {
        const parts = r.job.notices.map((n) => `${n.channel === "email" ? "Email" : "SMS"} ${n.ok ? (n.demo ? "ready (demo, not sent)" : "sent") : "failed"}`);
        setToast(`Job complete. ${parts.join(", ")}.`);
      }
    } catch (e) {
      setToast((e as Error).message);
      jobsApi.refresh();
    }
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!me) return null;

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader me={me} title={`${me.name.split(" ")[0]}'s run${me.vehicle ? ` · ${me.vehicle.rego}` : ""}`} />

      <div className="relative h-[38dvh] min-h-56 w-full">
        <RunMap plan={plan} here={start} nextLine={leg?.line ?? null} />
        <div className="absolute left-3 top-3 z-[500] rounded-full bg-white/95 px-3 py-1 text-xs font-medium shadow">
          {gpsState === "on" ? "📍 Using your location" : gpsState === "waiting" ? "Finding your location…" : "📍 Location off: planning from last stop"}
        </div>
      </div>

      <main className="mx-auto w-full max-w-md flex-1 space-y-4 px-4 pb-28 pt-4">
        {next ? (
          <section className="card overflow-hidden">
            <div className={`px-4 py-2 text-xs font-bold uppercase tracking-wider text-white ${next.stop.type === "pickup" ? "bg-amber-600" : "bg-brand-600"}`}>
              Next stop · {next.stop.type === "pickup" ? "Pickup" : "Drop-off"}
              {pinned && <span className="ml-2 font-medium normal-case opacity-80">(your choice)</span>}
            </div>
            <div className="p-4">
              <h2 className="text-lg font-bold leading-tight">{next.job.customerName}</h2>
              <p className="mt-1 text-[15px] text-slate-700">{next.stop.address}</p>
              <p className="mt-2 text-sm text-slate-500">
                {leg ? `${formatKm(leg.km)} · about ${formatMinutes(leg.minutes)} drive` : start ? `${formatKm(next.legKm)} away (straight line)` : "Turn on location for distance"}
                {next.job.reference && ` · Ref ${next.job.reference}`}
              </p>
              {next.job.notes && <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{next.job.notes}</p>}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <a className="btn-primary" href={googleMapsLink(next.stop.location, start)} target="_blank" rel="noreferrer">
                  Navigate
                </a>
                <a className="btn-ghost" href={wazeLink(next.stop.location)} target="_blank" rel="noreferrer">
                  Waze
                </a>
              </div>
              <button className="btn-success mt-2 w-full py-3.5 text-base" onClick={() => setCompleting(next)}>
                {next.stop.type === "pickup" ? "Arrived: confirm pickup" : "Arrived: complete delivery"}
              </button>
            </div>
          </section>
        ) : (
          <section className="card p-6 text-center">
            <p className="text-3xl">✅</p>
            <h2 className="mt-2 text-lg font-bold">{!jobsApi.data ? "Loading your run…" : myJobs.length ? "All stops done" : "No jobs yet"}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {myJobs.length ? `${doneToday} job${doneToday === 1 ? "" : "s"} completed.` : "Add a job, or load a sample run to try the app."}
            </p>
            {!myJobs.length && (
              <button className="btn-ghost mt-4" onClick={() => api("/api/jobs/sample", { body: {} }).then(jobsApi.refresh)}>
                Load sample run (Sydney)
              </button>
            )}
          </section>
        )}

        {plan.length > 1 && (
          <section>
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h3 className="text-sm font-bold text-slate-700">Then</h3>
              <span className="text-xs text-slate-500">
                {plan.length} stops · about {formatKm(totalKm)} straight line
              </span>
            </div>
            <ol className="card divide-y divide-slate-100">
              {plan.slice(1).map((p, i) => (
                <li key={p.stop.id} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${p.stop.type === "pickup" ? "bg-amber-600" : "bg-brand-600"}`}
                  >
                    {i + 2}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {p.stop.type === "pickup" ? "Pickup" : "Drop-off"} · {p.job.customerName}
                    </p>
                    <p className="truncate text-xs text-slate-500">{p.stop.address}</p>
                  </div>
                  <button className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50" onClick={() => setPinned(p.stop.id)}>
                    Go here next
                  </button>
                </li>
              ))}
            </ol>
            <p className="mt-2 px-1 text-xs text-slate-500">
              Order is worked out from where you are: always the closest stop you can do next. Drop-offs unlock after their pickup.
            </p>
          </section>
        )}

        {doneToday > 0 && next && (
          <p className="px-1 text-xs text-slate-500">
            {doneToday} job{doneToday === 1 ? "" : "s"} completed so far.
          </p>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-[900] border-t border-slate-200 bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-md">
          <Link href="/jobs/new" className="btn-primary w-full">
            + Add job
          </Link>
        </div>
      </div>

      {completing && <CompleteSheet job={completing.job} stop={completing.stop} onCancel={() => setCompleting(null)} onConfirm={confirm} />}

      {toast && (
        <div className="fixed inset-x-4 bottom-24 z-[2100] mx-auto max-w-md rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
