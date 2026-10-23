/** Jobs ready to invoice: completed, not on an invoice, with their customer matched by link or by name. */
export const READY_JOBS_SQL = `
  select j.id, j.reference, j.customer_name as "customerName",
         coalesce(j.customer_id, c.id) as "customerId",
         coalesce(j.price, cu.default_rate)::float8 as "price",
         (j.price is null) as "priceFromDefault",
         d.address as "address", to_char(d.completed_at at time zone 'Australia/Sydney', 'YYYY-MM-DD') as "completedOn",
         k.container_number as "containerNumber"
    from jobs j
    left join customers c on j.customer_id is null and c.company_id = j.company_id and lower(c.name) = lower(j.customer_name)
    left join customers cu on cu.id = coalesce(j.customer_id, c.id)
    left join stops d on d.job_id = j.id and d.type = 'dropoff'
    left join containers k on k.id = j.container_id
   where j.company_id = $1 and j.status = 'completed' and j.invoice_id is null
   order by d.completed_at`;

export type ReadyJob = {
  id: string;
  reference: string | null;
  customerName: string;
  customerId: string | null;
  price: number | null;
  priceFromDefault: boolean;
  address: string | null;
  completedOn: string | null;
  containerNumber: string | null;
};

export const INVOICE_COLUMNS = `i.id, i.number, i.customer_id as "customerId", c.name as "customerName",
  to_char(i.issue_date, 'YYYY-MM-DD') as "issueDate", to_char(i.due_date, 'YYYY-MM-DD') as "dueDate",
  i.status, i.subtotal::float8 as subtotal, i.gst::float8 as gst, i.total::float8 as total, i.notes,
  (i.status = 'sent' and i.due_date < current_date) as overdue`;

export const round2 = (n: number) => Math.round(n * 100) / 100;
