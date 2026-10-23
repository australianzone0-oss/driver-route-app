import { NextResponse } from "next/server";
import { handler, HttpError, requireUser } from "@/lib/server/auth";
import { query } from "@/lib/server/db";

type Ctx = { params: Promise<{ id: string }> };

/** Turns an office login on or off. */
export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const u = await requireUser("admin");
  const { id } = await ctx.params;
  const active = Boolean((await req.json()).active);
  if (id === u.id && !active) throw new HttpError(400, "You can't turn off your own login.");
  const rows = await query("update users set active = $3 where id = $1 and company_id = $2 and role = 'admin' returning id", [id, u.companyId, active]);
  if (!rows.length) throw new HttpError(404, "Not found.");
  if (!active) await query("delete from sessions where user_id = $1", [id]);
  return NextResponse.json({ ok: true });
});
