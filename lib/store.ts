"use client";

/**
 * Demo data store kept in the browser (localStorage).
 * Replace with Supabase for real use: see supabase/schema.sql and README.
 */
import { useSyncExternalStore } from "react";
import type { Driver, Job, Notice, Session, Stop } from "./types";
import { sampleJobs } from "./sample";

type State = {
  drivers: Driver[];
  jobs: Job[];
  session: Session | null;
};

const KEY = "driver-route-app:v1";

const defaultState: State = {
  drivers: [
    { id: "d1", name: "Sam Taylor" },
    { id: "d2", name: "Priya Singh" },
  ],
  jobs: [],
  session: null,
};

let state: State = defaultState;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...defaultState, ...JSON.parse(raw) };
  } catch {
    // Storage blocked or corrupt: start fresh.
  }
}

function save() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded (large photos) or storage blocked: keep in memory only.
  }
}

function set(next: Partial<State>) {
  state = { ...state, ...next };
  save();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  load();
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    loaded = false;
    load();
    listeners.forEach((l) => l());
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useStore(): State & { ready: boolean } {
  const s = useSyncExternalStore(
    subscribe,
    () => {
      load();
      return state;
    },
    () => defaultState,
  );
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  return { ...s, ready };
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export const actions = {
  signIn(session: Session) {
    set({ session });
  },
  signOut() {
    set({ session: null });
  },
  addJob(job: Job) {
    set({ jobs: [job, ...state.jobs] });
  },
  updateJob(id: string, patch: Partial<Job>) {
    set({ jobs: state.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)) });
  },
  deleteJob(id: string) {
    set({ jobs: state.jobs.filter((j) => j.id !== id) });
  },
  /** Marks a stop done and returns the updated job. */
  completeStop(jobId: string, stopId: string, details: Pick<Stop, "receivedBy" | "photo" | "signature">): Job | undefined {
    let updated: Job | undefined;
    const jobs = state.jobs.map((job) => {
      if (job.id !== jobId) return job;
      const stops = job.stops.map((s) =>
        s.id === stopId ? { ...s, ...details, status: "done" as const, completedAt: new Date().toISOString() } : s,
      );
      const allDone = stops.every((s) => s.status === "done");
      updated = { ...job, stops, status: allDone ? "completed" : "in_progress" };
      return updated;
    });
    set({ jobs });
    return updated;
  },
  addNotices(jobId: string, notices: Notice[]) {
    set({ jobs: state.jobs.map((j) => (j.id === jobId ? { ...j, notices: [...j.notices, ...notices] } : j)) });
  },
  loadSample(driverId: string) {
    set({ jobs: [...sampleJobs(driverId), ...state.jobs] });
  },
  clearAll() {
    set({ jobs: [] });
  },
};
