import { NextResponse } from "next/server";
import { currentUser, handler, requireUser } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { checkVehicle, VEHICLE_COLUMNS } from "@/lib/server/vehicles";
import type { Me, Vehicle } from "@/lib/types";

async function vehicle(id: string | null, companyId: string) {
  if (!id) return null;
  return (await query<Vehicle>(`select ${VEHICLE_COLUMNS} from vehicles where id = $1 and company_id = $2`, [id, companyId]))[0] ?? null;
}

export const GET = handler(async () => {
  const u = await currentUser();
  if (!u) return NextResponse.json({ me: null });
  const me: Me = {
    id: u.id,
    name: u.name,
    role: u.role,
    email: u.email,
    phone: u.phone,
    vehicle: await vehicle(u.vehicleId, u.companyId),
    trailer: await vehicle(u.trailerId, u.companyId),
    company: { name: u.companyName, slug: u.companySlug },
  };
  return NextResponse.json({ me });
});

/** A driver picks the truck and trailer they're driving today. */
export const PATCH = handler(async (req: Request) => {
  const u = await requireUser("driver");
  const b = await req.json();
  if (b.vehicleId !== undefined) {
    await checkVehicle(u.companyId, b.vehicleId);
    await query("update users set vehicle_id = $1 where id = $2", [b.vehicleId || null, u.id]);
  }
  if (b.trailerId !== undefined) {
    await checkVehicle(u.companyId, b.trailerId, "trailer");
    await query("update users set trailer_id = $1 where id = $2", [b.trailerId || null, u.id]);
  }
  return NextResponse.json({ ok: true });
});
