export type InvoiceRow = {
  id: string;
  number: string;
  customerName: string;
  issueDate: string;
  dueDate: string;
  status: "draft" | "sent" | "paid" | "void";
  total: number;
  overdue: boolean;
};

export const invoiceBadge = (i: Pick<InvoiceRow, "status" | "overdue">) =>
  i.overdue
    ? { text: "⚠ Overdue", cls: "bg-red-100 text-red-700" }
    : ({
        draft: { text: "Draft", cls: "bg-slate-100 text-slate-700" },
        sent: { text: "Sent", cls: "bg-amber-100 text-amber-800" },
        paid: { text: "✓ Paid", cls: "bg-emerald-100 text-emerald-800" },
        void: { text: "Void", cls: "bg-slate-100 text-slate-500 line-through" },
      })[i.status];
