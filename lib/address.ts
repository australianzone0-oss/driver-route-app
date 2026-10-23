/**
 * Addresses are entered as parts (number, street, suburb, state, postcode)
 * and stored as one line, e.g. "12 Smith St, Botany NSW 2019", so maps,
 * invoices and search keep working with plain text.
 */
export const AU_STATES = [
  { value: "NSW", label: "New South Wales" },
  { value: "VIC", label: "Victoria" },
  { value: "QLD", label: "Queensland" },
  { value: "WA", label: "Western Australia" },
  { value: "SA", label: "South Australia" },
  { value: "TAS", label: "Tasmania" },
  { value: "ACT", label: "Australian Capital Territory" },
  { value: "NT", label: "Northern Territory" },
];

export type AddressParts = { number: string; street: string; suburb: string; state: string; postcode: string };

export const emptyParts: AddressParts = { number: "", street: "", suburb: "", state: "", postcode: "" };

export function formatAddress(p: AddressParts): string {
  const line1 = [p.number.trim(), p.street.trim()].filter(Boolean).join(" ");
  const line2 = [p.suburb.trim(), p.state, p.postcode.trim()].filter(Boolean).join(" ");
  return [line1, line2].filter(Boolean).join(", ");
}

const STATE_NAMES: Record<string, string> = Object.fromEntries(
  AU_STATES.flatMap((s) => [[s.value.toLowerCase(), s.value], [s.label.toLowerCase(), s.value]]),
);
const STATE_RE = new RegExp(`\\b(${AU_STATES.flatMap((s) => [s.value, s.label]).join("|")})\\b`, "i");

/** Best-effort split of a one-line address back into parts. Anything it can't place stays in street. */
export function parseAddress(text: string | null | undefined): AddressParts {
  const parts = { ...emptyParts };
  let s = (text ?? "").replace(/,?\s*Australia\s*$/i, "").trim();
  if (!s) return parts;

  const pc = s.match(/\b(\d{4})\s*$/);
  if (pc) {
    parts.postcode = pc[1];
    s = s.slice(0, pc.index).replace(/[,\s]+$/, "");
  }
  const st = s.match(STATE_RE);
  if (st && s.slice(st.index! + st[0].length).replace(/[,\s]/g, "") === "") {
    parts.state = STATE_NAMES[st[1].toLowerCase()];
    s = s.slice(0, st.index).replace(/[,\s]+$/, "");
  }
  const comma = s.lastIndexOf(",");
  let line1 = s;
  if (comma > 0) {
    parts.suburb = s.slice(comma + 1).trim();
    line1 = s.slice(0, comma).trim();
  } else if ((parts.state || parts.postcode) && !/\d/.test(s)) {
    // Just a place, like "Melbourne VIC 3000".
    parts.suburb = s;
    return parts;
  }
  const num = line1.match(/^((?:unit\s+)?[\w/-]*\d[\w/-]*)\s+(.+)$/i);
  if (num) {
    parts.number = num[1];
    parts.street = num[2];
  } else {
    parts.street = line1;
  }
  return parts;
}
