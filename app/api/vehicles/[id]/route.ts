import { NextResponse } from "next/server";
import { handler, HttpError, requireUser } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { clean, readKind, VEHICLE_COLUMNS } from "@/lib/server/vehicles";
import type { Vehicle } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

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
  if (b.rego !== undefined) {
    const rego = String(b.rego).replace(/\s+/g, "").toUpperCase();
    if (!rego) throw new HttpError(400, "Enter the registration (rego).");
    add("rego", rego);
  }
  if (b.description !== undefined) add("description", clean(b.description));
  if (b.vehicleType !== undefined) add("vehicle_type", clean(b.vehicleType));
  if (b.capacity !== undefined) add("capacity", clean(b.capacity));
  if (b.notes !== undefined) add("notes", clean(b.notes));
  if (b.active !== undefined) add("active", Boolean(b.active));
  if (b.kind !== undefined) {
    // Switching between truck and trailer moves it to the matching slot on any driver who has it.
    const kind = readKind(b.kind);
    add("kind", kind);
    const [from, to] = kind === "trailer" ? ["vehicle_id", "trailer_id"] : ["trailer_id", "vehicle_id"];
    await query(`update users set ${to} = $1, ${from} = null where ${from} = $1 and company_id = $2`, [id, u.companyId]);
  }
  if (!sets.length) throw new HttpError(400, "Nothing to change.");
  const rows = await query<Vehicle>(`update vehicles set ${sets.join(", ")} where id = $1 and company_id = $2 returning ${VEHICLE_COLUMNS}`, params);
  if (!rows[0]) throw new HttpError(404, "Vehicle not found.");
  return NextResponse.json({ vehicle: rows[0] });
});
