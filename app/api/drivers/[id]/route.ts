import { NextResponse } from "next/server";
import { normalizePhone } from "@/lib/phone";
import { handler, hashSecret, HttpError, requireUser } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { checkVehicle, DRIVER_COLUMNS, PIN_RULE } from "@/lib/server/vehicles";
import type { Driver } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

/** Office edits a driver: details, vehicle, active, or a new PIN. */
export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const u = await requireUser("admin");
  const { id } = await ctx.params;
  const b = await req.json();

  const sets: string[] = [];
  const params: unknown[] = [id, u.companyId];
  const add = (col: string, v: unknown) => {
    params.push(v);
    sets.push(`${col} = $${params.length}`);
  };

  if (b.name !== undefined) {
    if (!String(b.name).trim()) throw new HttpError(400, "Enter the driver's name.");
    add("name", String(b.name).trim());
  }
  if (b.phone !== undefined) {
    const phone = normalizePhone(String(b.phone));
    if (!phone) throw new HttpError(400, "Enter a valid mobile number.");
    const clash = await query("select 1 from users where company_id = $1 and phone = $2 and id <> $3", [u.companyId, phone, id]);
    if (clash.length) throw new HttpError(409, "Another driver already uses that mobile number.");
    add("phone", phone);
  }
  if (b.vehicleId !== undefined) {
    await checkVehicle(u.companyId, b.vehicleId);
    add("vehicle_id", b.vehicleId || null);
  }
  if (b.licenceNumber !== undefined) add("licence_number", String(b.licenceNumber).trim() || null);
  if (b.active !== undefined) add("active", Boolean(b.active));
  if (b.pin !== undefined) {
    if (!PIN_RULE.test(String(b.pin))) throw new HttpError(400, "The PIN must be 6 digits.");
    add("password_hash", await hashSecret(String(b.pin)));
    sets.push("failed_logins = 0", "locked_until = null");
  }
  if (!sets.length) throw new HttpError(400, "Nothing to change.");

  const rows = await query<Driver>(
    `update users set ${sets.join(", ")} where id = $1 and company_id = $2 and role = 'driver' returning ${DRIVER_COLUMNS}`,
    params,
  );
  if (!rows[0]) throw new HttpError(404, "Driver not found.");
  if (b.active === false || b.pin !== undefined) await query("delete from sessions where user_id = $1", [id]);
  return NextResponse.json({ driver: rows[0] });
});
