import { NextResponse } from "next/server";
import { handler, HttpError, requireUser } from "@/lib/server/auth";
import { query, transaction } from "@/lib/server/db";
import { INVOICE_COLUMNS } from "@/lib/server/finance";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const u = await requireUser("admin");
  const { id } = await ctx.params;
  const [invoice] = await query(
    `select ${INVOICE_COLUMNS}, c.email as "customerEmail", c.address as "customerAddress", c.abn as "customerAbn"
       from invoices i join customers c on c.id = i.customer_id where i.id = $1 and i.company_id = $2`,
    [id, u.companyId],
  );
  if (!invoice) throw new HttpError(404, "Invoice not found.");
  const [lines, [company]] = await Promise.all([
    query(
      `select id, job_id as "jobId", description, quantity::float8 as quantity, unit_price::float8 as "unitPrice", amount::float8 as amount
         from invoice_lines where invoice_id = $1 order by description`,
      [id],
    ),
    query(`select name, abn, address, phone, email, gst_rate::float8 as "gstRate" from companies where id = $1`, [u.companyId]),
  ]);
  return NextResponse.json({ invoice, lines, company });
});

const NEXT: Record<string, string[]> = { draft: ["sent", "paid", "void"], sent: ["paid", "void", "draft"], paid: ["sent"], void: [] };

/** Moves an invoice between draft, sent, paid and void. Voiding frees its jobs to invoice again. */
export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const u = await requireUser("admin");
  const { id } = await ctx.params;
  const status = String((await req.json()).status ?? "");
  await transaction(async (q) => {
    const [inv] = await q<{ status: string }>("select status from invoices where id = $1 and company_id = $2 for update", [id, u.companyId]);
    if (!inv) throw new HttpError(404, "Invoice not found.");
    if (!NEXT[inv.status]?.includes(status)) throw new HttpError(400, `A ${inv.status} invoice can't be marked ${status}.`);
    await q("update invoices set status = $2, paid_at = case when $2 = 'paid' then now() else null end where id = $1", [id, status]);
    if (status === "void") await q("update jobs set invoice_id = null where invoice_id = $1", [id]);
  });
  return NextResponse.json({ ok: true });
});

/** Deletes a draft invoice and frees its jobs. */
export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const u = await requireUser("admin");
  const { id } = await ctx.params;
  await transaction(async (q) => {
    const [inv] = await q<{ status: string }>("select status from invoices where id = $1 and company_id = $2 for update", [id, u.companyId]);
    if (!inv) throw new HttpError(404, "Invoice not found.");
    if (inv.status !== "draft") throw new HttpError(400, "Only draft invoices can be deleted. Void it instead.");
    await q("update jobs set invoice_id = null where invoice_id = $1", [id]);
    await q("delete from invoices where id = $1", [id]);
  });
  return NextResponse.json({ ok: true });
});
