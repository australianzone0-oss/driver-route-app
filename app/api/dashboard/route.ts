import { NextResponse } from "next/server";
import { handler, requireUser } from "@/lib/server/auth";
import { query } from "@/lib/server/db";

const TODAY = "(now() at time zone 'Australia/Sydney')::date";

/** Counts for the office dashboard tiles and the next 7 days of wharf movements. */
export const GET = handler(async () => {
  const u = await requireUser("admin");
  const c = [u.companyId];
  const [[jobs], [containers], [finance], [customers], pickups, dropoffs, dehires, recent] = await Promise.all([
    query(
      `select count(*) filter (where j.status = 'pending')::int as pending,
              count(*) filter (where j.status = 'in_progress')::int as "inProgress",
              count(*) filter (where j.status = 'completed' and (d.completed_at at time zone 'Australia/Sydney')::date = ${TODAY})::int as "completedToday",
              count(distinct j.driver_id) filter (where j.status = 'in_progress')::int as "driversOnRoad",
              (select count(*)::int from users where company_id = $1 and role = 'driver' and active) as "activeDrivers"
         from jobs j left join stops d on d.job_id = j.id and d.type = 'dropoff'
        where j.company_id = $1`,
      c,
    ),
    query(
      `select count(*) filter (where held and status <> 'returned')::int as held,
              count(*) filter (where status <> 'returned' and dehire_date <= ${TODAY} + 3)::int as "dehireDue",
              count(*) filter (where status <> 'returned' and dehire_date < ${TODAY})::int as "dehireOverdue",
              count(*) filter (where status = 'at_wharf')::int as "atWharf",
              count(*) filter (where status <> 'returned')::int as active
         from containers where company_id = $1`,
      c,
    ),
    query(
      `select (select count(*)::int from jobs where company_id = $1 and status = 'completed' and invoice_id is null) as "notInvoiced",
              (select coalesce(sum(price), 0)::float8 from jobs where company_id = $1 and status = 'completed' and invoice_id is null) as "notInvoicedValue",
              coalesce(sum(total) filter (where status = 'sent'), 0)::float8 as unpaid,
              count(*) filter (where status = 'sent' and due_date < ${TODAY})::int as overdue,
              coalesce(sum(total) filter (where status = 'sent' and due_date < ${TODAY}), 0)::float8 as "overdueValue",
              count(*) filter (where status = 'draft')::int as drafts
         from invoices where company_id = $1`,
      c,
    ),
    query(`select count(*) filter (where credit_hold and active)::int as "creditHold", count(*) filter (where active)::int as active from customers where company_id = $1`, c),
    query(
      `select to_char(d, 'YYYY-MM-DD') as date, count(k.id)::int as count
         from generate_series(${TODAY}, ${TODAY} + 6, interval '1 day') d
         left join containers k on k.company_id = $1 and k.wharf_pickup_date = d::date and k.status = 'at_wharf'
        group by d order by d`,
      c,
    ),
    query(
      `select to_char(d, 'YYYY-MM-DD') as date, count(k.id)::int as count
         from generate_series(${TODAY}, ${TODAY} + 6, interval '1 day') d
         left join containers k on k.company_id = $1 and k.wharf_dropoff_date = d::date and k.status <> 'returned'
        group by d order by d`,
      c,
    ),
    query(
      `select k.id, k.container_number as "containerNumber", to_char(k.dehire_date, 'YYYY-MM-DD') as "dehireDate", cu.name as "customerName"
         from containers k left join customers cu on cu.id = k.customer_id
        where k.company_id = $1 and k.status <> 'returned' and k.dehire_date <= ${TODAY} + 3
        order by k.dehire_date limit 8`,
      c,
    ),
    query(
      `select j.id, j.customer_name as "customerName", u.name as "driverName", d.completed_at as "completedAt"
         from jobs j join stops d on d.job_id = j.id and d.type = 'dropoff' join users u on u.id = j.driver_id
        where j.company_id = $1 and j.status = 'completed'
        order by d.completed_at desc limit 6`,
      c,
    ),
  ]);
  return NextResponse.json({ jobs, containers, finance, customers, pickups, dropoffs, dehires, recent });
});
