import { NextResponse } from "next/server";
import { normalizePhone } from "@/lib/phone";
import { handler, hashSecret, HttpError, requireUser } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { checkVehicle, DRIVER_COLUMNS, PIN_RULE } from "@/lib/server/vehicles";
import type { Driver } from "@/lib/types";

export const GET = handler(async () => {
  const u = await requireUser();
  const drivers = await query<Driver>(
    `select ${DRIVER_COLUMNS} from users where company_id = $1 and role = 'driver' order by active desc, name`,
    [u.companyId],
  );
  return NextResponse.json({ drivers });
});

/** Office adds a driver. The driver logs in with this mobile number and PIN. */
export const POST = handler(async (req: Request) => {
  const u = await requireUser("admin");
  const b = await req.json();
  const name = String(b.name ?? "").trim();
  const phone = normalizePhone(String(b.phone ?? ""));
  const pin = String(b.pin ?? "");
  if (!name) throw new HttpError(400, "Enter the driver's name.");
  if (!phone) throw new HttpError(400, "Enter a valid mobile number.");
  if (!PIN_RULE.test(pin)) throw new HttpError(400, "The PIN must be 6 digits.");
  await checkVehicle(u.companyId, b.vehicleId);

  const exists = await query("select 1 from users where company_id = $1 and phone = $2", [u.companyId, phone]);
  if (exists.length) throw new HttpError(409, "A driver with that mobile number already exists.");

  const [driver] = await query<Driver>(
    `insert into users (company_id, role, name, phone, password_hash, vehicle_id, licence_number)
     values ($1, 'driver', $2, $3, $4, $5, $6) returning ${DRIVER_COLUMNS}`,
    [u.companyId, name, phone, await hashSecret(pin), b.vehicleId || null, String(b.licenceNumber ?? "").trim() || null],
  );
  return NextResponse.json({ driver }, { status: 201 });
});
