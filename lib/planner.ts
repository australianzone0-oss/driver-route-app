import { distanceKm } from "./geo";
import type { Job, LatLng, Stop } from "./types";

export type PlannedStop = { stop: Stop; job: Job; legKm: number };

/** A stop can be visited once its job's pickup (if any) is done. */
function isEligible(stop: Stop, job: Job): boolean {
  if (stop.status !== "pending") return false;
  if (stop.type === "pickup") return true;
  const pickup = job.stops.find((s) => s.type === "pickup");
  return !pickup || pickup.status === "done";
}

/**
 * Orders the driver's open stops by always going to the nearest stop that can
 * be done next. A drop-off only becomes available after its pickup, so goods are
 * never delivered before they are collected.
 *
 * `pinnedStopId` lets the driver override the first stop.
 */
export function planRun(jobs: Job[], start: LatLng | null, pinnedStopId?: string | null): PlannedStop[] {
  const open = jobs.filter((j) => j.status !== "completed");
  // Work on copies so we can mark stops visited while simulating.
  const sim = open.map((job) => ({ ...job, stops: job.stops.map((s) => ({ ...s })) }));
  const original = new Map(open.flatMap((j) => j.stops.map((s) => [s.id, { stop: s, job: j }] as const)));

  const plan: PlannedStop[] = [];
  let here = start;

  for (;;) {
    const candidates = sim.flatMap((job) => job.stops.filter((s) => isEligible(s, job)).map((s) => ({ s, job })));
    if (!candidates.length) break;

    let pick = candidates[0];
    const pinned = plan.length === 0 && pinnedStopId ? candidates.find((c) => c.s.id === pinnedStopId) : undefined;
    if (pinned) {
      pick = pinned;
    } else if (here) {
      let best = Infinity;
      for (const c of candidates) {
        const d = distanceKm(here, c.s.location);
        if (d < best) {
          best = d;
          pick = c;
        }
      }
    }

    const orig = original.get(pick.s.id)!;
    plan.push({ ...orig, legKm: here ? distanceKm(here, pick.s.location) : 0 });
    pick.s.status = "done";
    here = pick.s.location;
  }

  return plan;
}
