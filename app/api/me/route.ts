import { NextResponse } from "next/server";
import { currentUser, handler } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { VEHICLE_COLUMNS } from "@/lib/server/vehicles";
import type { Me, Vehicle } from "@/lib/types";

export const GET = handler(async () => {
  const u = await currentUser();
  if (!u) return NextResponse.json({ me: null });
  const vehicle = u.vehicleId
    ? (await query<Vehicle>(`select ${VEHICLE_COLUMNS} from vehicles where id = $1 and company_id = $2`, [u.vehicleId, u.companyId]))[0] ?? null
    : null;
  const me: Me = {
    id: u.id,
    name: u.name,
    role: u.role,
    email: u.email,
    phone: u.phone,
    vehicle,
    company: { name: u.companyName, slug: u.companySlug },
  };
  return NextResponse.json({ me });
});
