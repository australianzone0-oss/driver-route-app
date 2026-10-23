import { NextResponse } from "next/server";
import { handler, HttpError, requireUser } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { clean, VEHICLE_COLUMNS } from "@/lib/server/vehicles";
import type { Vehicle } from "@/lib/types";

export const GET = handler(async () => {
  const u = await requireUser();
  const vehicles = await query<Vehicle>(
    `select ${VEHICLE_COLUMNS} from vehicles where company_id = $1 order by active desc, rego`,
    [u.companyId],
  );
  return NextResponse.json({ vehicles });
});

export const POST = handler(async (req: Request) => {
  const u = await requireUser("admin");
  const b = await req.json();
  const rego = String(b.rego ?? "").replace(/\s+/g, "").toUpperCase();
  if (!rego) throw new HttpError(400, "Enter the registration (rego).");
  const exists = await query("select 1 from vehicles where company_id = $1 and rego = $2", [u.companyId, rego]);
  if (exists.length) throw new HttpError(409, "A vehicle with that rego already exists.");
  const [vehicle] = await query<Vehicle>(
    `insert into vehicles (company_id, rego, description, vehicle_type, capacity, notes)
     values ($1, $2, $3, $4, $5, $6) returning ${VEHICLE_COLUMNS}`,
    [u.companyId, rego, clean(b.description), clean(b.vehicleType), clean(b.capacity), clean(b.notes)],
  );
  return NextResponse.json({ vehicle }, { status: 201 });
});
