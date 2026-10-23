import type { Job } from "./types";

const now = () => new Date().toISOString();

function job(
  id: string,
  driverId: string,
  customerName: string,
  pickup: [string, number, number] | null,
  dropoff: [string, number, number],
  extra: Partial<Job> = {},
): Job {
  const stops = [];
  if (pickup) {
    stops.push({ id: `${id}-p`, jobId: id, type: "pickup" as const, address: pickup[0], location: { lat: pickup[1], lng: pickup[2] }, status: "pending" as const });
  }
  stops.push({ id: `${id}-d`, jobId: id, type: "dropoff" as const, address: dropoff[0], location: { lat: dropoff[1], lng: dropoff[2] }, status: "pending" as const });
  return {
    id,
    customerName,
    notifyOnComplete: true,
    driverId,
    createdBy: "office",
    createdAt: now(),
    status: "pending",
    stops,
    attachments: [],
    notices: [],
    ...extra,
  };
}

/** A small run around Sydney for trying the app. */
export function sampleJobs(driverId: string): Job[] {
  const tag = Math.random().toString(36).slice(2, 6);
  return [
    job(`s1-${tag}`, driverId, "Harbour Fitouts", ["Botany Rd, Alexandria NSW 2015", -33.9065, 151.1955], ["George St, Sydney NSW 2000", -33.8688, 151.2069], { reference: "CN-10421", customerEmail: "orders@example.com", customerPhone: "0400000000" }),
    job(`s2-${tag}`, driverId, "Parramatta Tiles", ["Silverwater Rd, Silverwater NSW 2128", -33.8390, 151.0450], ["Church St, Parramatta NSW 2150", -33.8136, 151.0034], { reference: "CN-10422", customerEmail: "store@example.com" }),
    job(`s3-${tag}`, driverId, "Bondi Cafe Supplies", null, ["Campbell Parade, Bondi Beach NSW 2026", -33.8915, 151.2767], { reference: "CN-10423", customerPhone: "0411111111", createdBy: "driver" }),
  ];
}
