"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { api, useApi, useMe } from "@/lib/api";
import { invoiceBadge, type InvoiceRow } from "@/lib/invoices";
import { money } from "@/lib/records";

type Detail = {
  invoice: InvoiceRow & { subtotal: number; gst: number; notes: string | null; customerEmail: string | null; customerAddress: string | null; customerAbn: string | null };
  lines: { id: string; description: string; quantity: number; unitPrice: number; amount: number }[];
  company: { name: string; abn: string | null; address: string | null; phone: string | null; email: string | null; gstRate: number };
};

const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

export default function InvoicePage() {
  const me = useMe("admin");
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const detail = useApi<Detail>(me ? `/api/invoices/${id}` : null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [busy, setBusy] = useState(false);

  if (!me) return null;
  const d = detail.data;

  async function run(fn: () => Promise<string | void>) {
    setBusy(true);
    setMsg(undefined);
    try {
      const text = await fn();
      if (text) setMsg({ ok: true, text });
      detail.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }
  const status = (s: string) => run(async () => void (await api(`/api/invoices/${id}`, { method: "PATCH", body: { status: s } })));

  return (
    <div className="min-h-dvh">
      <div className="print:hidden">
        <AppHeader me={me} title={d ? `Invoice ${d.invoice.number}` : "Invoice"} back="/office/finance" />
      </div>
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-4 print:max-w-none print:p-0">
        {detail.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{detail.error}</p>}
        {d && (
          <>
            <div className="flex flex-wrap gap-2 print:hidden">
              {d.invoice.status !== "void" && (
                <button className="btn-primary py-2" disabled={busy} onClick={() => run(async () => `Emailed to ${(await api<{ to: string }>(`/api/invoices/${id}/email`, { body: {} })).to}.`)}>
                  Email to customer
                </button>
              )}
              <button className="btn-ghost py-2" onClick={() => window.print()}>
                Print or save PDF
              </button>
              {d.invoice.status === "draft" && (
                <button className="btn-ghost py-2" disabled={busy} onClick={() => status("sent")}>
                  Mark sent
                </button>
              )}
              {(d.invoice.status === "draft" || d.invoice.status === "sent") && (
                <button className="btn-success py-2" disabled={busy} onClick={() => status("paid")}>
                  Mark paid
                </button>
              )}
              {d.invoice.status === "paid" && (
                <button className="btn-ghost py-2" disabled={busy} onClick={() => status("sent")}>
                  Mark unpaid
                </button>
              )}
              {d.invoice.status === "draft" ? (
                <button
                  className="btn-ghost py-2 text-red-600"
                  disabled={busy}
                  onClick={() => confirm("Delete this draft? Its jobs go back to Ready to invoice.") && run(async () => {
                    await api(`/api/invoices/${id}`, { method: "DELETE" });
                    router.push("/office/finance");
                  })}
                >
                  Delete draft
                </button>
              ) : (
                d.invoice.status !== "void" && (
                  <button className="btn-ghost py-2 text-red-600" disabled={busy} onClick={() => confirm("Void this invoice? Its jobs go back to Ready to invoice.") && status("void")}>
                    Void
                  </button>
                )
              )}
            </div>
            {msg && <p className={`rounded-lg px-3 py-2 text-sm print:hidden ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}

            <article className="card space-y-6 p-6 print:shadow-none print:ring-0 sm:p-8">
              <header className="flex flex-wrap justify-between gap-4">
                <div>
                  <p className="text-lg font-bold">{d.company.name}</p>
                  <p className="whitespace-pre-line text-sm text-slate-600">
                    {[d.company.abn && `ABN ${d.company.abn}`, d.company.address, d.company.phone, d.company.email].filter(Boolean).join("\n")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold tracking-tight">TAX INVOICE</p>
                  <p className="font-mono">{d.invoice.number}</p>
                  {(() => {
                    const b = invoiceBadge(d.invoice);
                    return <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold print:hidden ${b.cls}`}>{b.text}</span>;
                  })()}
                </div>
              </header>

              <div className="grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="label">Bill to</p>
                  <p className="font-semibold">{d.invoice.customerName}</p>
                  <p className="whitespace-pre-line text-slate-600">
                    {[d.invoice.customerAbn && `ABN ${d.invoice.customerAbn}`, d.invoice.customerAddress, d.invoice.customerEmail].filter(Boolean).join("\n")}
                  </p>
                </div>
                <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 sm:justify-self-end">
                  <dt className="text-slate-500">Issued</dt>
                  <dd>{fmt(d.invoice.issueDate)}</dd>
                  <dt className="text-slate-500">Due</dt>
                  <dd className="font-semibold">{fmt(d.invoice.dueDate)}</dd>
                </dl>
              </div>

              <table className="w-full text-left text-sm">
                <thead className="border-b-2 border-slate-800 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="py-2">Description</th>
                    <th className="py-2 text-right">Qty</th>
                    <th className="py-2 text-right">Unit</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {d.lines.map((l) => (
                    <tr key={l.id} className="border-b border-slate-100">
                      <td className="py-2 pr-2">{l.description}</td>
                      <td className="py-2 text-right tabular-nums">{l.quantity}</td>
                      <td className="py-2 text-right tabular-nums">{money(l.unitPrice)}</td>
                      <td className="py-2 text-right tabular-nums">{money(l.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <dl className="ml-auto grid w-full max-w-xs grid-cols-2 gap-y-1 text-sm">
                <dt className="text-slate-500">Subtotal</dt>
                <dd className="text-right tabular-nums">{money(d.invoice.subtotal)}</dd>
                <dt className="text-slate-500">GST ({d.company.gstRate}%)</dt>
                <dd className="text-right tabular-nums">{money(d.invoice.gst)}</dd>
                <dt className="border-t border-slate-800 pt-1 font-bold">Total due</dt>
                <dd className="border-t border-slate-800 pt-1 text-right font-bold tabular-nums">{money(d.invoice.total)}</dd>
              </dl>
              {d.invoice.notes && <p className="text-sm text-slate-600">{d.invoice.notes}</p>}
            </article>
          </>
        )}
      </main>
    </div>
  );
}
