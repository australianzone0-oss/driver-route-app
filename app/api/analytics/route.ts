import { NextResponse } from "next/server";
import { handler, requireUser } from "@/lib/server/auth";
import { query } from "@/lib/server/db";

const TODAY = "(now() at time zone 'Australia/Sydney')::date";

/** Trends for the Analytics tab over the last `days` days (7 to 365). */
export const GET = handler(async (req: Request) => {
  const u = await requireUser("admin");
  const days = Math.min(365, Math.max(7, Number(new URL(req.url).searchParams.get("days")) || 30));
  const p = [u.companyId, days];
  const [jobsPerDay, revenueByMonth, byDriver, topCustomers, [totals]] = await Promise.all([
    query(
      `select to_char(d, 'YYYY-MM-DD') as date, count(s.id)::int as count
         from generate_series(${TODAY} - ($2::int - 1), ${TODAY}, interval '1 day') d
         left join stops s on s.type = 'dropoff' and (s.completed_at at time zone 'Australia/Sydney')::date = d::date
              and s.job_id in (select id from jobs where company_id = $1)
        group by d order by d`,
      p,
    ),
    query(
      `select to_char(m, 'YYYY-MM') as month, coalesce(sum(i.subtotal), 0)::float8 as amount
         from generate_series(date_trunc('month', ${TODAY}) - interval '5 months', date_trunc('month', ${TODAY}), interval '1 month') m
         left join invoices i on i.company_id = $1 and i.status <> 'void' and date_trunc('month', i.issue_date) = m
        group by m order by m`,
      [u.companyId],
    ),
    query(
      `select u.name, count(j.id)::int as count
         from users u
         join jobs j on j.driver_id = u.id and j.status = 'completed'
         join stops s on s.job_id = j.id and s.type = 'dropoff' and s.completed_at >= now() - ($2::int || ' days')::interval
        where u.company_id = $1
        group by u.name order by count desc limit 10`,
      p,
    ),
    query(
      `select c.name, sum(i.subtotal)::float8 as amount
         from invoices i join customers c on c.id = i.customer_id
        where i.company_id = $1 and i.status <> 'void' and i.issue_date > ${TODAY} - $2::int
        group by c.name order by amount desc limit 8`,
      p,
    ),
    query(
      `select count(*) filter (where s.completed_at >= now() - ($2::int || ' days')::interval)::int as completed,
              coalesce(avg(j.price) filter (where s.completed_at >= now() - ($2::int || ' days')::interval), 0)::float8 as "avgPrice",
              (select coalesce(sum(subtotal), 0)::float8 from invoices where company_id = $1 and status <> 'void' and issue_date > ${TODAY} - $2::int) as invoiced
         from jobs j join stops s on s.job_id = j.id and s.type = 'dropoff'
        where j.company_id = $1 and j.status = 'completed'`,
      p,
    ),
  ]);
  return NextResponse.json({ days, jobsPerDay, revenueByMonth, byDriver, topCustomers, totals });
});
