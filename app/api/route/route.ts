import { NextResponse } from "next/server";

/**
 * Driving route for one leg. Uses the public OSRM demo server, which is fine for a
 * prototype. For production swap to Google Routes API (or HERE/TomTom for trucks).
 * Body: { points: [[lat, lng], ...] }
 */
export async function POST(req: Request) {
  const { points } = (await req.json()) as { points: [number, number][] };
  if (!Array.isArray(points) || points.length < 2) {
    return NextResponse.json({ error: "Need at least two points" }, { status: 400 });
  }
  const coords = points.map(([lat, lng]) => `${lng},${lat}`).join(";");
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`,
      { headers: { "User-Agent": "driver-route-app/0.1 (prototype)" } },
    );
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) throw new Error(data.message ?? "No route found");
    return NextResponse.json({
      km: route.distance / 1000,
      minutes: route.duration / 60,
      legs: route.legs.map((l: any) => ({ km: l.distance / 1000, minutes: l.duration / 60 })),
      line: route.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
