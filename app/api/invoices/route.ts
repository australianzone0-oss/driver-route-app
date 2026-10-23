import { NextResponse } from "next/server";
import { handler, HttpError, requireUser } from "@/lib/server/auth";
import { query, transaction } from "@/lib/server/db";
import { INVOICE_COLUMNS, READY_JOBS_SQL, round2, type ReadyJob } from "@/lib/server/finance";

export const GET = handler(async () => {
  const u = await requireUser("admin");
  const invoices = await query(
    `select ${INVOICE_COLUMNS} from invoices i join customers c on c.id = i.customer_id
      where i.company_id = $1 order by i.created_at desc limit 500`,
    [u.companyId],
  );
  return NextResponse.json({ invoices });
});

type Line = { description: string; quantity: number; unitPrice: number; jobId: string | null };

/** Creates a draft invoice for one customer from completed jobs and any extra lines. */
export const POST = handler(async (req: Request) => {
  const u = await requireUser("admin");
  const b = await req.json();
  const customerId = String(b.customerId ?? "");
  const jobIds: string[] = Array.isArray(b.jobIds) ? b.jobIds.map(String) : [];

  const id = await transaction(async (q) => {
    const [customer] = await q<{ id: string; terms: number | null }>(
      "select id, payment_terms_days as terms from customers where id = $1 and company_id = $2",
      [customerId, u.companyId],
    );
    if (!customer) throw new HttpError(400, "Choose a customer.");

    const ready = (await q<ReadyJob>(READY_JOBS_SQL, [u.companyId])).filter((j) => jobIds.includes(j.id));
    if (ready.length !== jobIds.length) throw new HttpError(409, "Some of those jobs are already invoiced or not completed. Refresh and try again.");
    if (ready.some((j) => j.customerId !== customerId)) throw new HttpError(400, "All jobs on an invoice must be for the same customer.");
    if (ready.some((j) => j.price == null)) throw new HttpError(400, "Set a price on every job first.");

    const lines: Line[] = ready.map((j) => ({
      jobId: j.id,
      description: [`Delivery${j.reference ? ` ref ${j.reference}` : ""}`, j.containerNumber, j.completedOn?.split("-").reverse().join("/"), j.address].filter(Boolean).join(" · "),
      quantity: 1,
      unitPrice: j.price!,
    }));
    for (const l of Array.isArray(b.extraLines) ? b.extraLines : []) {
      const description = String(l.description ?? "").trim();
      const quantity = Number(l.quantity ?? 1);
      const unitPrice = Number(l.unitPrice);
      if (!description) continue;
      if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice)) throw new HttpError(400, `Check the amount for "${description}".`);
      lines.push({ jobId: null, description, quantity, unitPrice });
    }
    if (!lines.length) throw new HttpError(400, "Add at least one job or line.");

    const [co] = await q<{ prefix: string; no: number; gst: string; terms: number }>(
      `update companies set next_invoice_no = next_invoice_no + 1 where id = $1
       returning invoice_prefix as prefix, next_invoice_no - 1 as no, gst_rate as gst, payment_terms_days as terms`,
      [u.companyId],
    );
    const subtotal = round2(lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0));
    const gst = round2((subtotal * Number(co.gst)) / 100);
    const terms = customer.terms ?? co.terms;
    const [inv] = await q<{ id: string }>(
      `insert into invoices (company_id, customer_id, number, due_date, subtotal, gst, total, notes)
       values ($1, $2, $3, current_date + $4::int, $5, $6, $7, $8) returning id`,
      [u.companyId, customerId, `${co.prefix}-${co.no}`, terms, subtotal, gst, round2(subtotal + gst), String(b.notes ?? "").trim() || null],
    );
    for (const l of lines) {
      await q("insert into invoice_lines (invoice_id, job_id, description, quantity, unit_price, amount) values ($1, $2, $3, $4, $5, $6)", [
        inv.id, l.jobId, l.description, l.quantity, l.unitPrice, round2(l.quantity * l.unitPrice),
      ]);
    }
    // Link each job to the invoice and keep the price actually charged.
    for (const j of ready) {
      await q("update jobs set invoice_id = $2, customer_id = $3, price = $4 where id = $1", [j.id, inv.id, customerId, j.price]);
    }
    return inv.id;
  });
  return NextResponse.json({ id }, { status: 201 });
});
