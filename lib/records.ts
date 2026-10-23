/**
 * Field lists for simple office records. The same list drives the form on the
 * page and the validation and columns on the server.
 */
export type FieldType = "text" | "email" | "tel" | "number" | "money" | "date" | "bool" | "select" | "textarea" | "customer";

export type FieldSpec = {
  key: string;
  col: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  half?: boolean;
  upper?: boolean;
};

export type Customer = {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  deliveryAddress: string | null;
  abn: string | null;
  defaultRate: number | null;
  creditLimit: number | null;
  creditHold: boolean;
  paymentTermsDays: number | null;
  notes: string | null;
  active: boolean;
};

export const customerFields: FieldSpec[] = [
  { key: "name", col: "name", label: "Business name", type: "text", required: true },
  { key: "contactName", col: "contact_name", label: "Contact person", type: "text", half: true },
  { key: "phone", col: "phone", label: "Phone", type: "tel", half: true },
  { key: "email", col: "email", label: "Email", type: "email", placeholder: "Gets job-completed notices and invoices" },
  { key: "address", col: "address", label: "Billing address", type: "text" },
  { key: "deliveryAddress", col: "delivery_address", label: "Delivery address", type: "text", placeholder: "Where containers are delivered, if different" },
  { key: "abn", col: "abn", label: "ABN", type: "text", half: true },
  { key: "paymentTermsDays", col: "payment_terms_days", label: "Payment terms (days)", type: "number", half: true, placeholder: "Company default" },
  { key: "defaultRate", col: "default_rate", label: "Default rate per job ($, ex GST)", type: "money", half: true },
  { key: "creditLimit", col: "credit_limit", label: "Credit limit ($)", type: "money", half: true },
  { key: "creditHold", col: "credit_hold", label: "On credit hold", type: "bool" },
  { key: "notes", col: "notes", label: "Notes", type: "textarea" },
  { key: "active", col: "active", label: "Active customer", type: "bool" },
];

export const CONTAINER_STATUS = [
  { value: "at_wharf", label: "At wharf" },
  { value: "in_transit", label: "In transit" },
  { value: "at_customer", label: "At customer" },
  { value: "at_depot", label: "At our depot" },
  { value: "empty_park", label: "At empty park" },
  { value: "returned", label: "Returned (dehired)" },
];

export type Container = {
  id: string;
  containerNumber: string;
  customerId: string | null;
  size: string | null;
  containerType: string | null;
  fullEmpty: "full" | "empty";
  movement: "import" | "export";
  status: string;
  held: boolean;
  holdReason: string | null;
  vessel: string | null;
  voyage: string | null;
  wharfPickupDate: string | null;
  wharfDropoffDate: string | null;
  dehireDate: string | null;
  emptyPark: string | null;
  weightKg: number | null;
  notes: string | null;
};

export const containerFields: FieldSpec[] = [
  { key: "containerNumber", col: "container_number", label: "Container number", type: "text", required: true, upper: true, placeholder: "e.g. CSQU3054383", half: true },
  { key: "customerId", col: "customer_id", label: "Customer", type: "customer", half: true },
  {
    key: "size", col: "size", label: "Size", type: "select", half: true,
    options: ["20", "40", "40HC", "45"].map((v) => ({ value: v, label: v === "40HC" ? "40' high cube" : `${v}'` })),
  },
  {
    key: "containerType", col: "container_type", label: "Type", type: "select", half: true,
    options: [
      { value: "GP", label: "General purpose" },
      { value: "RF", label: "Reefer" },
      { value: "OT", label: "Open top" },
      { value: "FR", label: "Flat rack" },
      { value: "TK", label: "Tank" },
    ],
  },
  { key: "movement", col: "movement", label: "Import or export", type: "select", half: true, options: [{ value: "import", label: "Import" }, { value: "export", label: "Export" }] },
  { key: "fullEmpty", col: "full_empty", label: "Full or empty", type: "select", half: true, options: [{ value: "full", label: "Full" }, { value: "empty", label: "Empty" }] },
  { key: "status", col: "status", label: "Where is it", type: "select", options: CONTAINER_STATUS },
  { key: "vessel", col: "vessel", label: "Vessel", type: "text", half: true },
  { key: "voyage", col: "voyage", label: "Voyage", type: "text", half: true },
  { key: "wharfPickupDate", col: "wharf_pickup_date", label: "Wharf pickup date", type: "date", half: true },
  { key: "wharfDropoffDate", col: "wharf_dropoff_date", label: "Wharf drop-off date", type: "date", half: true },
  { key: "dehireDate", col: "dehire_date", label: "Dehire (return empty) by", type: "date", half: true },
  { key: "emptyPark", col: "empty_park", label: "Empty park", type: "text", half: true },
  { key: "weightKg", col: "weight_kg", label: "Gross weight (kg)", type: "number", half: true },
  { key: "held", col: "held", label: "On hold (customs, quarantine or shipping line)", type: "bool" },
  { key: "holdReason", col: "hold_reason", label: "Hold reason", type: "text" },
  { key: "notes", col: "notes", label: "Notes", type: "textarea" },
];

/** ISO 6346 check digit for the first 10 characters of a container number. */
export function containerCheckDigit(first10: string): number | null {
  if (!/^[A-Z]{4}\d{6}$/.test(first10)) return null;
  const letter = (c: string) => {
    // A=10, skipping multiples of 11 (11, 22, 33).
    let v = 10;
    for (let code = 65; code < c.charCodeAt(0); code++) {
      v++;
      if (v % 11 === 0) v++;
    }
    return v;
  };
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const c = first10[i];
    sum += (i < 4 ? letter(c) : Number(c)) * 2 ** i;
  }
  return (sum % 11) % 10;
}

/** Checks a container number. Returns null when valid, otherwise what's wrong. */
export function checkContainerNumber(raw: string): string | null {
  const n = raw.replace(/[\s-]/g, "").toUpperCase();
  if (!/^[A-Z]{3}[UJZ]\d{7}$/.test(n)) return "A container number is 4 letters (ending in U, J or Z) then 7 digits, e.g. CSQU3054383.";
  const digit = containerCheckDigit(n.slice(0, 10));
  if (digit !== Number(n[10])) return `The last digit should be ${digit}. Check the number for a typo.`;
  return null;
}

export const money = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("en-AU", { style: "currency", currency: "AUD" });
