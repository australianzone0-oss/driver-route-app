import { NextResponse } from "next/server";
import { handler, HttpError, requireUser } from "@/lib/server/auth";
import { query, transaction } from "@/lib/server/db";
import { loadJobs } from "@/lib/server/jobs";
import { sendCompletionNotice } from "@/lib/server/notify";

type Ctx = { params: Promise<{ id: string }> };

const MAX_IMAGE = 600_000; // characters of data URL, roughly 450 KB

/**
 * Marks a stop done. When that finishes the job and the customer has an email
 * or mobile, the completion notice is sent from the server.
 */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const u = await requireUser();
  const { id } = await ctx.params;
  const b = await req.json();
  const image = (v: unknown) => {
    if (!v) return null;
    const s = String(v);
    if (!s.startsWith("data:image/") || s.length > MAX_IMAGE) throw new HttpError(400, "Photo or signature is too large.");
    return s;
  };

  const result = await transaction(async (q) => {
    const rows = await q<{ job_id: string; type: string; status: string; driver_id: string; pickup_pending: boolean }>(
      `select s.job_id, s.type, s.status, j.driver_id,
              exists (select 1 from stops p where p.job_id = s.job_id and p.type = 'pickup' and p.status = 'pending') as pickup_pending
         from stops s join jobs j on j.id = s.job_id
        where s.id = $1 and j.company_id = $2
        for update of s`,
      [id, u.companyId],
    );
    const stop = rows[0];
    if (!stop || (u.role === "driver" && stop.driver_id !== u.id)) throw new HttpError(404, "Stop not found.");
    if (stop.status === "done") throw new HttpError(409, "That stop is already done.");
    if (stop.type === "dropoff" && stop.pickup_pending) throw new HttpError(409, "Do the pickup for this job first.");

    await q("update stops set status = 'done', completed_at = now(), received_by = $2, photo = $3, signature = $4 where id = $1", [
      id,
      b.receivedBy ? String(b.receivedBy).trim().slice(0, 120) : null,
      image(b.photo),
      image(b.signature),
    ]);
    const [{ remaining }] = await q<{ remaining: number }>("select count(*)::int as remaining from stops where job_id = $1 and status = 'pending'", [stop.job_id]);
    await q("update jobs set status = $2 where id = $1", [stop.job_id, remaining === 0 ? "completed" : "in_progress"]);
    return { jobId: stop.job_id, completed: remaining === 0 };
  });

  let [job] = await loadJobs(u.companyId, { jobId: result.jobId });
  if (result.completed && b.notify !== false && job.notifyOnComplete && (job.customerEmail || job.customerPhone)) {
    const drop = job.stops.find((s) => s.type === "dropoff")!;
    const [driver] = await query<{ name: string; company: string }>(
      "select u.name, c.name as company from users u join companies c on c.id = u.company_id where u.id = $1",
      [job.driverId],
    );
    const sent = await sendCompletionNotice({
      email: job.customerEmail,
      phone: job.customerPhone,
      customerName: job.customerName,
      reference: job.reference,
      address: drop.address,
      completedAt: drop.completedAt!,
      receivedBy: drop.receivedBy,
      driverName: driver.name,
      companyName: driver.company,
    });
    for (const n of sent) {
      await query("insert into notices (job_id, channel, sent_to, ok, demo, error) values ($1, $2, $3, $4, $5, $6)", [
        job.id,
        n.channel,
        n.to,
        n.ok,
        n.demo,
        n.error ?? null,
      ]);
    }
    [job] = await loadJobs(u.companyId, { jobId: result.jobId });
  }
  return NextResponse.json({ job, completed: result.completed });
});
