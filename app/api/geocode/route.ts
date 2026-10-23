import { NextResponse } from "next/server";

export type GeocodeResult = { label: string; lat: number; lng: number };

/**
 * Address search. Uses Google Geocoding when GOOGLE_MAPS_API_KEY is set,
 * otherwise OpenStreetMap Nominatim (free, limited to light use).
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length < 3) return NextResponse.json({ results: [] });

  try {
    const results = process.env.GOOGLE_MAPS_API_KEY ? await google(q) : await nominatim(q);
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json({ results: [], error: String(err) }, { status: 502 });
  }
}

async function google(q: string): Promise<GeocodeResult[]> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", q);
  url.searchParams.set("region", "au");
  url.searchParams.set("components", "country:AU");
  url.searchParams.set("key", process.env.GOOGLE_MAPS_API_KEY!);
  const res = await fetch(url);
  const data = await res.json();
  return (data.results ?? []).slice(0, 5).map((r: any) => ({
    label: r.formatted_address,
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
  }));
}

async function nominatim(q: string): Promise<GeocodeResult[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("countrycodes", "au");
  url.searchParams.set("limit", "5");
  const res = await fetch(url, { headers: { "User-Agent": "driver-route-app/0.1 (prototype)" } });
  const data = await res.json();
  return (data ?? []).map((r: any) => ({ label: r.display_name, lat: Number(r.lat), lng: Number(r.lon) }));
}
