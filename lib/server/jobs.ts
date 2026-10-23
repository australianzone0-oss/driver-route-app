import type { Job, Notice, Stop } from "@/lib/types";
import { query, type Query } from "./db";

type JobRow = {
  id: string;
  reference: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  notify_on_complete: boolean;
  notes: string | null;
  driver_id: string;
  created_by: "driver" | "office";
  status: Job["status"];
  attachments: Job["attachments"] | string;
  created_at: Date | string;
};

type StopRow = {
  id: string;
  job_id: string;
  type: Stop["type"];
  address: string;
  lat: number;
  lng: number;
  status: Stop["status"];
  completed_at: Date | string | null;
  received_by: string | null;
  photo: string | null;
  signature: string | null;
};

type NoticeRow = { job_id: string; channel: Notice["channel"]; sent_to: string; ok: boolean; demo: boolean; error: string | null; sent_at: Date | string };

const iso = (d: Date | string) => new Date(d).toISOString();

/** Loads jobs for a company, optionally only one driver's, with stops and notices. */
export async function loadJobs(companyId: string, opts: { driverId?: string; jobId?: string; q?: Query } = {}): Promise<Job[]> {
  const q = opts.q ?? query;
  const where = ["company_id = $1"];
  const params: unknown[] = [companyId];
  if (opts.driverId) {
    params.push(opts.driverId);
    where.push(`driver_id = $${params.length}`);
  }
  if (opts.jobId) {
    params.push(opts.jobId);
    where.push(`id = $${params.length}`);
  }
  const jobs = await q<JobRow>(`select * from jobs where ${where.join(" and ")} order by created_at desc limit 500`, params);
  if (!jobs.length) return [];
  const ids = jobs.map((j) => j.id);
  const [stops, notices] = await Promise.all([
    q<StopRow>("select * from stops where job_id = any($1::uuid[]) order by type desc", [ids]),
    q<NoticeRow>("select * from notices where job_id = any($1::uuid[]) order by sent_at", [ids]),
  ]);

  return jobs.map((j) => ({
    id: j.id,
    reference: j.reference ?? undefined,
    customerName: j.customer_name,
    customerEmail: j.customer_email ?? undefined,
    customerPhone: j.customer_phone ?? undefined,
    notifyOnComplete: j.notify_on_complete,
    notes: j.notes ?? undefined,
    driverId: j.driver_id,
    createdBy: j.created_by,
    createdAt: iso(j.created_at),
    status: j.status,
    attachments: typeof j.attachments === "string" ? JSON.parse(j.attachments) : j.attachments,
    stops: stops
      .filter((s) => s.job_id === j.id)
      .map((s) => ({
        id: s.id,
        jobId: s.job_id,
        type: s.type,
        address: s.address,
        location: { lat: s.lat, lng: s.lng },
        status: s.status,
        completedAt: s.completed_at ? iso(s.completed_at) : undefined,
        receivedBy: s.received_by ?? undefined,
        photo: s.photo ?? undefined,
        signature: s.signature ?? undefined,
      })),
    notices: notices
      .filter((n) => n.job_id === j.id)
      .map((n) => ({ channel: n.channel, to: n.sent_to, ok: n.ok, demo: n.demo, error: n.error ?? undefined, sentAt: iso(n.sent_at) })),
  }));
}

export type NewJobInput = {
  reference?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  notifyOnComplete: boolean;
  notes?: string;
  driverId: string;
  createdBy: "driver" | "office";
  attachments: Job["attachments"];
  pickup?: { address: string; lat: number; lng: number } | null;
  dropoff: { address: string; lat: number; lng: number };
};

export async function insertJob(q: Query, companyId: string, input: NewJobInput): Promise<string> {
  const [{ id }] = await q<{ id: string }>(
    `insert into jobs (company_id, reference, customer_name, customer_email, customer_phone, notify_on_complete, notes, driver_id, created_by, attachments)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb) returning id`,
    [
      companyId,
      input.reference || null,
      input.customerName,
      input.customerEmail || null,
      input.customerPhone || null,
      input.notifyOnComplete,
      input.notes || null,
      input.driverId,
      input.createdBy,
      JSON.stringify(input.attachments ?? []),
    ],
  );
  for (const [type, s] of [["pickup", input.pickup], ["dropoff", input.dropoff]] as const) {
    if (!s) continue;
    await q("insert into stops (job_id, type, address, lat, lng) values ($1, $2, $3, $4, $5)", [id, type, s.address, s.lat, s.lng]);
  }
  return id;
}
