"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { actions, useStore } from "@/lib/store";
import type { Job } from "@/lib/types";

const statusStyle: Record<Job["status"], string> = {
  pending: "bg-slate-100 text-slate-700",
  in_progress: "bg-amber-100 text-amber-800",
  completed: "bg-emerald-100 text-emerald-800",
};
const statusLabel: Record<Job["status"], string> = { pending: "Pending", in_progress: "In progress", completed: "Completed" };

export default function Office() {
  const { session, jobs, drivers, ready } = useStore();
  const router = useRouter();
  const [driverFilter, setDriverFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | Job["status"]>("all");

  useEffect(() => {
    if (ready && session?.role !== "office") router.replace("/");
  }, [ready, session, router]);

  const shown = useMemo(
    () => jobs.filter((j) => (driverFilter === "all" || j.driverId === driverFilter) && (statusFilter === "all" || j.status === statusFilter)),
    [jobs, driverFilter, statusFilter],
  );

  if (!ready || session?.role !== "office") return null;

  const counts = (id: string) => {
    const mine = jobs.filter((j) => j.driverId === id);
    return { open: mine.filter((j) => j.status !== "completed").length, done: mine.filter((j) => j.status === "completed").length };
  };

  return (
    <div className="min-h-dvh">
      <AppHeader title="Office board" />
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {drivers.map((d) => {
            const c = counts(d.id);
            return (
              <div key={d.id} className="card p-4">
                <p className="text-sm font-semibold">{d.name}</p>
                <p className="mt-1 text-2xl font-bold">
                  {c.open} <span className="text-sm font-medium text-slate-500">open</span>
                </p>
                <p className="text-xs text-slate-500">{c.done} completed</p>
              </div>
            );
          })}
          <Link href="/jobs/new" className="card flex items-center justify-center p-4 font-semibold text-brand-600 hover:bg-brand-50">
            + New job
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select className="field w-auto" value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)}>
            <option value="all">All drivers</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select className="field w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
          </select>
          <div className="ml-auto flex gap-2">
            <button className="btn-ghost py-2" onClick={() => actions.loadSample(driverFilter === "all" ? drivers[0].id : driverFilter)}>
              Load sample jobs
            </button>
          </div>
        </div>

        {shown.length === 0 ? (
          <div className="card p-8 text-center text-sm text-slate-500">No jobs to show.</div>
        ) : (
          <ul className="space-y-2">
            {shown.map((j) => {
              const drop = j.stops.find((s) => s.type === "dropoff");
              const pickup = j.stops.find((s) => s.type === "pickup");
              return (
                <li key={j.id} className="card p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{j.customerName}</span>
                        {j.reference && <span className="text-xs text-slate-500">Ref {j.reference}</span>}
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyle[j.status]}`}>{statusLabel[j.status]}</span>
                        {j.createdBy === "driver" && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">Added by driver</span>}
                      </div>
                      {pickup && (
                        <p className="mt-1 truncate text-sm text-slate-600">
                          <span className="font-medium text-amber-700">From</span> {pickup.address} {pickup.status === "done" && "✓"}
                        </p>
                      )}
                      {drop && (
                        <p className="truncate text-sm text-slate-600">
                          <span className="font-medium text-brand-700">To</span> {drop.address} {drop.status === "done" && "✓"}
                        </p>
                      )}
                      {drop?.completedAt && (
                        <p className="mt-1 text-xs text-slate-500">
                          Completed {new Date(drop.completedAt).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}
                          {drop.receivedBy && ` · received by ${drop.receivedBy}`}
                          {drop.signature && " · signed"}
                          {drop.photo && " · photo"}
                        </p>
                      )}
                      {j.notices.length > 0 && (
                        <p className="mt-1 text-xs text-slate-500">
                          {j.notices.map((n) => `${n.channel === "email" ? "Email" : "SMS"} to ${n.to}: ${n.ok ? (n.demo ? "demo" : "sent") : "failed"}`).join(" · ")}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        className="field w-auto py-1.5 text-sm"
                        value={j.driverId}
                        disabled={j.status === "completed"}
                        onChange={(e) => actions.updateJob(j.id, { driverId: e.target.value })}
                        aria-label="Assigned driver"
                      >
                        {drivers.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                      <button
                        className="rounded-lg px-2 py-1.5 text-sm text-slate-400 hover:bg-red-50 hover:text-red-600"
                        onClick={() => confirm(`Delete job for ${j.customerName}?`) && actions.deleteJob(j.id)}
                        aria-label="Delete job"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
