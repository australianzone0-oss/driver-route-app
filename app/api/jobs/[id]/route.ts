import { NextResponse } from "next/server";
import { handler, HttpError, requireUser } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { loadJobs, readPrice } from "@/lib/server/jobs";
import { checkCustomer } from "@/lib/server/records";

type Ctx = { params: Promise<{ id: string }> };

/** Office reassigns a job, or sets its customer, container or price. */
export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const u = await requireUser("admin");
  const { id } = await ctx.params;
  const b = await req.json();
  const [current] = await query<{ status: string; invoice_id: string | null }>(
    "select status, invoice_id from jobs where id = $1 and company_id = $2",
    [id, u.companyId],
  );
  if (!current) throw new HttpError(404, "Job not found.");

  const sets: string[] = [];
  const params: unknown[] = [id, u.companyId];
  const add = (col: string, v: unknown) => {
    params.push(v);
    sets.push(`${col} = $${params.length}`);
  };
  if (b.driverId !== undefined) {
    if (current.status === "completed") throw new HttpError(400, "This job is already completed.");
    const ok = await query("select 1 from users where id = $1 and company_id = $2 and role = 'driver' and active", [String(b.driverId ?? ""), u.companyId]);
    if (!ok.length) throw new HttpError(400, "Choose an active driver.");
    add("driver_id", b.driverId);
  }
  if (b.price !== undefined || b.customerId !== undefined) {
    if (current.invoice_id) throw new HttpError(400, "This job is already on an invoice.");
  }
  if (b.price !== undefined) add("price", readPrice(b.price));
  if (b.customerId !== undefined) {
    const customerId = b.customerId ? String(b.customerId) : null;
    await checkCustomer(u.companyId, customerId);
    add("customer_id", customerId);
  }
  if (b.containerId !== undefined) {
    const containerId = b.containerId ? String(b.containerId) : null;
    if (containerId && !(await query("select 1 from containers where id = $1 and company_id = $2", [containerId, u.companyId])).length) {
      throw new HttpError(400, "That container doesn't exist.");
    }
    add("container_id", containerId);
  }
  if (!sets.length) throw new HttpError(400, "Nothing to change.");
  await query(`update jobs set ${sets.join(", ")} where id = $1 and company_id = $2`, params);
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
