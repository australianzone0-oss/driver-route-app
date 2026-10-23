import { NextResponse } from "next/server";
import type { FieldSpec } from "@/lib/records";
import { handler, HttpError, requireUser } from "./auth";
import { query } from "./db";

/** `select` list that returns each field under its camelCase key. */
export function columns(fields: FieldSpec[]) {
  return [
    "id",
    ...fields.map((f) => {
      if (f.type === "money" || f.type === "number") return `${f.col}::float8 as "${f.key}"`;
      if (f.type === "date") return `to_char(${f.col}, 'YYYY-MM-DD') as "${f.key}"`;
      return `${f.col} as "${f.key}"`;
    }),
  ].join(", ");
}

/** Reads the fields present in a request body, validated and ready for SQL. */
export function readFields(fields: FieldSpec[], body: Record<string, unknown>, partial: boolean) {
  const out: { col: string; value: unknown }[] = [];
  for (const f of fields) {
    const raw = body[f.key];
    if (raw === undefined) {
      if (!partial && f.required) throw new HttpError(400, `Enter the ${f.label.toLowerCase()}.`);
      continue;
    }
    let value: unknown = raw == null ? null : String(raw).trim() || null;
    if (f.type === "bool") value = Boolean(raw);
    else if (value !== null) {
      if (f.type === "number" || f.type === "money") {
        const n = Number(String(value).replace(/[$,\s]/g, ""));
        if (!Number.isFinite(n) || n < 0) throw new HttpError(400, `${f.label} must be a number.`);
        value = n;
      } else if (f.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
        throw new HttpError(400, `${f.label} must be a date.`);
      } else if (f.type === "time" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value))) {
        throw new HttpError(400, `${f.label} must be a time like 08:30.`);
      } else if (f.type === "select" && f.options && !f.options.some((o) => o.value === value)) {
        throw new HttpError(400, `Choose a valid ${f.label.toLowerCase()}.`);
      } else if (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
        throw new HttpError(400, "Enter a valid email address.");
      } else if (f.upper) value = String(value).replace(/\s+/g, "").toUpperCase();
    }
    if (f.required && (value === null || value === "")) throw new HttpError(400, `Enter the ${f.label.toLowerCase()}.`);
    out.push({ col: f.col, value });
  }
  return out;
}

type Hooks = {
  /** Extra checks on the cleaned values, keyed by column. */
  validate?: (values: Record<string, unknown>, companyId: string) => Promise<void> | void;
  orderBy: string;
};

/** Office-only list/create handlers for a company-scoped table. */
export function collection(table: string, fields: FieldSpec[], hooks: Hooks) {
  const cols = columns(fields);
  return {
    GET: handler(async () => {
      const u = await requireUser("admin");
      const rows = await query(`select ${cols} from ${table} where company_id = $1 order by ${hooks.orderBy}`, [u.companyId]);
      return NextResponse.json({ items: rows });
    }),
    POST: handler(async (req: Request) => {
      const u = await requireUser("admin");
      const vals = readFields(fields, await req.json(), false);
      await hooks.validate?.(Object.fromEntries(vals.map((v) => [v.col, v.value])), u.companyId);
      const names = ["company_id", ...vals.map((v) => v.col)];
      const params = [u.companyId, ...vals.map((v) => v.value)];
      const [item] = await query(
        `insert into ${table} (${names.join(", ")}) values (${params.map((_, i) => `$${i + 1}`).join(", ")}) returning ${cols}`,
        params,
      );
      return NextResponse.json({ item }, { status: 201 });
    }),
  };
}

type Ctx = { params: Promise<{ id: string }> };

/** Office-only update/delete handlers for one row of a company-scoped table. */
export function member(table: string, fields: FieldSpec[], hooks: Omit<Hooks, "orderBy"> & { inUse?: string }) {
  const cols = columns(fields);
  return {
    PATCH: handler(async (req: Request, ctx: Ctx) => {
      const u = await requireUser("admin");
      const { id } = await ctx.params;
      const vals = readFields(fields, await req.json(), true);
      if (!vals.length) throw new HttpError(400, "Nothing to change.");
      await hooks.validate?.(Object.fromEntries(vals.map((v) => [v.col, v.value])), u.companyId);
      const params: unknown[] = [id, u.companyId, ...vals.map((v) => v.value)];
      const rows = await query(
        `update ${table} set ${vals.map((v, i) => `${v.col} = $${i + 3}`).join(", ")} where id = $1 and company_id = $2 returning ${cols}`,
        params,
      );
      if (!rows[0]) throw new HttpError(404, "Not found.");
      return NextResponse.json({ item: rows[0] });
    }),
    DELETE: handler(async (_req: Request, ctx: Ctx) => {
      const u = await requireUser("admin");
      const { id } = await ctx.params;
      if (hooks.inUse) {
        const used = await query(hooks.inUse, [id]);
        if (used.length) throw new HttpError(409, "This is used on an invoice, so it can't be deleted. Mark it inactive instead.");
      }
      const rows = await query(`delete from ${table} where id = $1 and company_id = $2 returning id`, [id, u.companyId]);
      if (!rows[0]) throw new HttpError(404, "Not found.");
      return NextResponse.json({ ok: true });
    }),
  };
}

/** Throws unless the customer belongs to the company. */
export async function checkDriver(companyId: string, driverId: unknown) {
  if (!driverId) return;
  const rows = await query("select 1 from users where id = $1 and company_id = $2 and role = 'driver'", [String(driverId), companyId]);
  if (!rows.length) throw new HttpError(400, "That driver doesn't exist.");
}

export async function checkCustomer(companyId: string, customerId: unknown) {
  if (!customerId) return;
  const rows = await query("select 1 from customers where id = $1 and company_id = $2", [String(customerId), companyId]);
  if (!rows.length) throw new HttpError(400, "That customer doesn't exist.");
}
