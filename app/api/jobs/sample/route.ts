import { NextResponse } from "next/server";
import { sampleJobs } from "@/lib/sample";
import { handler, HttpError, requireUser } from "@/lib/server/auth";
import { query, transaction } from "@/lib/server/db";
import { insertJob } from "@/lib/server/jobs";

/** Adds a sample Sydney run for a driver, for trying the app. */
export const POST = handler(async (req: Request) => {
  const u = await requireUser();
  const b = await req.json().catch(() => ({}));
  const driverId = u.role === "driver" ? u.id : String(b.driverId ?? "");
  const ok = await query("select 1 from users where id = $1 and company_id = $2 and role = 'driver'", [driverId, u.companyId]);
  if (!ok.length) throw new HttpError(400, "Add a driver first.");
  await transaction(async (q) => {
    for (const job of sampleJobs(driverId)) await insertJob(q, u.companyId, job);
  });
  return NextResponse.json({ ok: true });
});
