import { NextResponse } from "next/server";
import { handler, HttpError, requireUser } from "@/lib/server/auth";
import { query } from "@/lib/server/db";

const COLS = `name, slug, abn, address, phone, email, gst_rate::float8 as "gstRate", invoice_prefix as "invoicePrefix",
  next_invoice_no as "nextInvoiceNo", payment_terms_days as "paymentTermsDays"`;

export const GET = handler(async () => {
  const u = await requireUser("admin");
  const [company] = await query(`select ${COLS} from companies where id = $1`, [u.companyId]);
  return NextResponse.json({ company });
});

export const PATCH = handler(async (req: Request) => {
  const u = await requireUser("admin");
  const b = await req.json();
  const text = (v: unknown) => (v == null ? null : String(v).trim() || null);
  const int = (v: unknown, label: string, min: number, max: number) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < min || n > max) throw new HttpError(400, `${label} must be a whole number from ${min} to ${max}.`);
    return n;
  };
  const name = text(b.name);
  if (!name) throw new HttpError(400, "Enter the company name.");
  const gst = Number(b.gstRate);
  if (!Number.isFinite(gst) || gst < 0 || gst > 50) throw new HttpError(400, "GST rate must be a percentage, e.g. 10.");
  const prefix = text(b.invoicePrefix)?.toUpperCase().replace(/[^A-Z0-9]/g, "") || "INV";
  const [company] = await query(
    `update companies set name = $2, abn = $3, address = $4, phone = $5, email = $6, gst_rate = $7, invoice_prefix = $8,
            next_invoice_no = $9, payment_terms_days = $10
      where id = $1 returning ${COLS}`,
    [
      u.companyId, name, text(b.abn), text(b.address), text(b.phone), text(b.email), gst, prefix,
      int(b.nextInvoiceNo, "Next invoice number", 1, 99999999), int(b.paymentTermsDays, "Payment terms", 0, 365),
    ],
  );
  return NextResponse.json({ company });
});
