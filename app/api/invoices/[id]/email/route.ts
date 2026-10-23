import { NextResponse } from "next/server";
import { handler, HttpError, requireUser } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { emailConfigured, sendEmail } from "@/lib/server/notify";
import { money } from "@/lib/records";

type Ctx = { params: Promise<{ id: string }> };

/** Emails the invoice to the customer as plain text and marks a draft as sent. */
export const POST = handler(async (_req: Request, ctx: Ctx) => {
  const u = await requireUser("admin");
  const { id } = await ctx.params;
  if (!emailConfigured()) throw new HttpError(503, "Email isn't set up for this app yet.");
  const [inv] = await query<{
    number: string; status: string; email: string | null; customer: string; issued: string; due: string;
    subtotal: number; gst: number; total: number; notes: string | null;
    company: string; abn: string | null; cphone: string | null; cemail: string | null;
  }>(
    `select i.number, i.status, c.email, c.name as customer, to_char(i.issue_date, 'DD/MM/YYYY') as issued, to_char(i.due_date, 'DD/MM/YYYY') as due,
            i.subtotal::float8 as subtotal, i.gst::float8 as gst, i.total::float8 as total, i.notes,
            co.name as company, co.abn, co.phone as cphone, co.email as cemail
       from invoices i join customers c on c.id = i.customer_id join companies co on co.id = i.company_id
      where i.id = $1 and i.company_id = $2`,
    [id, u.companyId],
  );
  if (!inv) throw new HttpError(404, "Invoice not found.");
  if (inv.status === "void") throw new HttpError(400, "This invoice is void.");
  if (!inv.email) throw new HttpError(400, "Add an email address to this customer first.");
  const lines = await query<{ description: string; quantity: number; amount: number }>(
    "select description, quantity::float8 as quantity, amount::float8 as amount from invoice_lines where invoice_id = $1 order by description",
    [id],
  );

  const text = [
    `Tax invoice ${inv.number} from ${inv.company}${inv.abn ? ` (ABN ${inv.abn})` : ""}`,
    `To: ${inv.customer}`,
    `Issued ${inv.issued}, due ${inv.due}`,
    "",
    ...lines.map((l) => `${l.quantity !== 1 ? `${l.quantity} × ` : ""}${l.description}: ${money(l.amount)}`),
    "",
    `Subtotal: ${money(inv.subtotal)}`,
    `GST: ${money(inv.gst)}`,
    `Total due: ${money(inv.total)}`,
    ...(inv.notes ? ["", inv.notes] : []),
    "",
    `Questions? Reply to this email${inv.cphone ? ` or call ${inv.cphone}` : ""}.`,
  ].join("\n");

  const r = await sendEmail(inv.email, `Invoice ${inv.number} from ${inv.company}`, text);
  if (!r.ok) throw new HttpError(502, "The email couldn't be sent. Check the email settings and try again.");
  if (inv.status === "draft") await query("update invoices set status = 'sent' where id = $1", [id]);
  return NextResponse.json({ ok: true, to: inv.email });
});
