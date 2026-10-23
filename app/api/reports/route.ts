import { NextResponse } from "next/server";
import { handler, HttpError, requireUser } from "@/lib/server/auth";
import { query } from "@/lib/server/db";

const SYD = (col: string) => `to_char(${col} at time zone 'Australia/Sydney', 'YYYY-MM-DD HH24:MI')`;

/** Report rows between two dates (inclusive), ready for a table or CSV. */
const REPORTS: Record<string, string> = {
  jobs: `
    select j.reference as "Reference", j.customer_name as "Customer", u.name as "Driver",
           case j.status when 'pending' then 'Pending' when 'in_progress' then 'In progress' else 'Completed' end as "Status",
           p.address as "Pickup", d.address as "Drop-off", k.container_number as "Container",
           ${SYD("j.created_at")} as "Created", ${SYD("d.completed_at")} as "Completed",
           d.received_by as "Received by", j.price::float8 as "Price ex GST", i.number as "Invoice"
      from jobs j
      join users u on u.id = j.driver_id
      left join stops p on p.job_id = j.id and p.type = 'pickup'
      left join stops d on d.job_id = j.id and d.type = 'dropoff'
      left join containers k on k.id = j.container_id
      left join invoices i on i.id = j.invoice_id
     where j.company_id = $1 and (j.created_at at time zone 'Australia/Sydney')::date between $2 and $3
     order by j.created_at`,
  containers: `
    select k.container_number as "Container", k.size as "Size", k.container_type as "Type", k.movement as "Movement",
           k.full_empty as "Full/empty", k.status as "Status", case when k.held then 'Yes' else '' end as "Held",
           c.name as "Customer", k.vessel as "Vessel", k.voyage as "Voyage",
           to_char(k.wharf_pickup_date, 'YYYY-MM-DD') as "Wharf pickup", to_char(k.wharf_dropoff_date, 'YYYY-MM-DD') as "Wharf drop-off",
           to_char(k.dehire_date, 'YYYY-MM-DD') as "Dehire by", k.empty_park as "Empty park",
           k.wharf as "Wharf", k.weight_kg as "Weight (kg)", k.door_direction as "Door", k.edo_pin as "EDO PIN",
           to_char(k.job_date, 'YYYY-MM-DD') as "Job date", k.job_time as "Job time"
      from containers k left join customers c on c.id = k.customer_id
     where k.company_id = $1 and (k.created_at at time zone 'Australia/Sydney')::date between $2 and $3
     order by k.created_at`,
  invoices: `
    select i.number as "Invoice", c.name as "Customer", to_char(i.issue_date, 'YYYY-MM-DD') as "Issued",
           to_char(i.due_date, 'YYYY-MM-DD') as "Due", i.status as "Status",
           i.subtotal::float8 as "Subtotal", i.gst::float8 as "GST", i.total::float8 as "Total"
      from invoices i join customers c on c.id = i.customer_id
     where i.company_id = $1 and i.issue_date between $2 and $3
     order by i.issue_date, i.number`,
  drivers: `
    select u.name as "Driver", u.phone as "Mobile", v.rego as "Vehicle",
           count(j.id) filter (where j.status = 'completed')::int as "Completed",
           count(j.id) filter (where j.status <> 'completed')::int as "Open",
           coalesce(sum(j.price) filter (where j.status = 'completed'), 0)::float8 as "Value ex GST"
      from users u
      left join vehicles v on v.id = u.vehicle_id
      left join jobs j on j.driver_id = u.id and (j.created_at at time zone 'Australia/Sydney')::date between $2 and $3
     where u.company_id = $1 and u.role = 'driver'
     group by u.id, u.name, u.phone, v.rego order by u.name`,
};

export const GET = handler(async (req: Request) => {
  const u = await requireUser("admin");
  const sp = new URL(req.url).searchParams;
  const sql = REPORTS[sp.get("type") ?? ""];
  if (!sql) throw new HttpError(400, "Choose a report.");
  const date = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const from = date(sp.get("from"));
  const to = date(sp.get("to"));
  if (!from || !to) throw new HttpError(400, "Choose a date range.");
  const rows = await query(sql, [u.companyId, from, to]);
  return NextResponse.json({ rows });
});
