import { NextResponse } from "next/server";
import { handler, HttpError, requireUser } from "@/lib/server/auth";
import { query, transaction } from "@/lib/server/db";
import { insertJob, loadJobs, readPrice, type NewJobInput } from "@/lib/server/jobs";
import { checkCustomer } from "@/lib/server/records";

/** Office sees every job in the company; a driver sees their own. */
export const GET = handler(async () => {
  const u = await requireUser();
  const jobs = await loadJobs(u.companyId, u.role === "driver" ? { driverId: u.id } : {});
  return NextResponse.json({ jobs });
});

export const POST = handler(async (req: Request) => {
  const u = await requireUser();
  const b = await req.json();
  const point = (p: unknown) => {
    const s = p as { address?: unknown; lat?: unknown; lng?: unknown } | null;
    if (!s) return null;
    const lat = Number(s.lat);
    const lng = Number(s.lng);
    if (!String(s.address ?? "").trim() || !Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
    return { address: String(s.address).trim(), lat, lng };
  };

  const pickup = point(b.pickup);
  const dropoff = point(b.dropoff);
  if (!String(b.customerName ?? "").trim()) throw new HttpError(400, "Add the customer name.");
  if (!dropoff) throw new HttpError(400, "Add a drop-off address.");
  if (pickup === undefined) throw new HttpError(400, "The pickup address is incomplete.");

  const driverId = u.role === "driver" ? u.id : String(b.driverId ?? "");
  if (u.role === "admin") {
    const ok = await query("select 1 from users where id = $1 and company_id = $2 and role = 'driver' and active", [driverId, u.companyId]);
    if (!ok.length) throw new HttpError(400, "Choose an active driver.");
  }

  // Only the office links customers, containers and prices.
  const office = u.role === "admin";
  const customerId = office && b.customerId ? String(b.customerId) : null;
  const containerId = office && b.containerId ? String(b.containerId) : null;
  if (office) {
    await checkCustomer(u.companyId, customerId);
    if (containerId && !(await query("select 1 from containers where id = $1 and company_id = $2", [containerId, u.companyId])).length) {
      throw new HttpError(400, "That container doesn't exist.");
    }
  }

  const input: NewJobInput = {
    customerId,
    containerId,
    price: office ? readPrice(b.price) : null,
    reference: b.reference ? String(b.reference).trim() : undefined,
    customerName: String(b.customerName).trim(),
    customerEmail: b.customerEmail ? String(b.customerEmail).trim() : undefined,
    customerPhone: b.customerPhone ? String(b.customerPhone).trim() : undefined,
    notifyOnComplete: b.notifyOnComplete !== false,
    notes: b.notes ? String(b.notes).trim() : undefined,
    driverId,
    createdBy: u.role === "driver" ? "driver" : "office",
    attachments: Array.isArray(b.attachments)
      ? b.attachments.slice(0, 10).map((a: { name?: unknown; type?: unknown; size?: unknown }) => ({
          name: String(a.name ?? "file"),
          type: String(a.type ?? ""),
          size: Number(a.size) || 0,
        }))
      : [],
    pickup,
    dropoff,
  };
  const id = await transaction((q) => insertJob(q, u.companyId, input));
  const [job] = await loadJobs(u.companyId, { jobId: id });
  return NextResponse.json({ job }, { status: 201 });
});
