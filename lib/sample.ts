import type { NewJobInput } from "@/lib/server/jobs";

type Place = [address: string, lat: number, lng: number];
const at = ([address, lat, lng]: Place) => ({ address, lat, lng });

/** A small run around Sydney for trying the app. */
export function sampleJobs(driverId: string): NewJobInput[] {
  const base = { driverId, createdBy: "office" as const, notifyOnComplete: true, attachments: [] };
  return [
    {
      ...base,
      customerName: "Harbour Fitouts",
      reference: "CN-10421",
      customerEmail: "orders@example.com",
      customerPhone: "0400000000",
      pickup: at(["Botany Rd, Alexandria NSW 2015", -33.9065, 151.1955]),
      dropoff: at(["George St, Sydney NSW 2000", -33.8688, 151.2069]),
    },
    {
      ...base,
      customerName: "Parramatta Tiles",
      reference: "CN-10422",
      customerEmail: "store@example.com",
      pickup: at(["Silverwater Rd, Silverwater NSW 2128", -33.839, 151.045]),
      dropoff: at(["Church St, Parramatta NSW 2150", -33.8136, 151.0034]),
    },
    {
      ...base,
      customerName: "Bondi Cafe Supplies",
      reference: "CN-10423",
      customerPhone: "0411111111",
      createdBy: "driver",
      dropoff: at(["Campbell Parade, Bondi Beach NSW 2026", -33.8915, 151.2767]),
    },
  ];
}
