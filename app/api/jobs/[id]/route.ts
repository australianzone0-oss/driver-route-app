import { NextResponse } from "next/server";
import { handler, HttpError, requireUser } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { loadJobs } from "@/lib/server/jobs";

type Ctx = { params: Promise<{ id: string }> };

/** Office reassigns a job to another driver. */
export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const u = await requireUser("admin");
  const { id } = await ctx.params;
  const b = await req.json();
  const ok = await query("select 1 from users where id = $1 and company_id = $2 and role = 'driver' and active", [String(b.driverId ?? ""), u.companyId]);
  if (!ok.length) throw new HttpError(400, "Choose an active driver.");
  const rows = await query("update jobs set driver_id = $3 where id = $1 and company_id = $2 and status <> 'completed' returning id", [id, u.companyId, b.driverId]);
  if (!rows.length) throw new HttpError(404, "Job not found or already completed.");
  const [job] = await loadJobs(u.companyId, { jobId: id });
  return NextResponse.json({ job });
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const u = await requireUser("admin");
  const { id } = await ctx.params;
  const rows = await query("delete from jobs where id = $1 and company_id = $2 returning id", [id, u.companyId]);
  if (!rows.length) throw new HttpError(404, "Job not found.");
  return NextResponse.json({ ok: true });
});
