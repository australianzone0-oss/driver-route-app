/**
 * Normalises a phone number to E.164. Australian numbers written locally
 * (0412 345 678) become +61412345678. Returns null if it doesn't look valid.
 */
export function normalizePhone(input: string): string | null {
  const raw = input.replace(/[\s\-().]/g, "");
  let e164: string;
  if (raw.startsWith("+")) e164 = raw;
  else if (raw.startsWith("0")) e164 = `+61${raw.slice(1)}`;
  else if (raw.startsWith("61")) e164 = `+${raw}`;
  else e164 = `+61${raw}`;
  return /^\+\d{8,15}$/.test(e164) ? e164 : null;
}

/** +61412345678 -> 0412 345 678 */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const m = /^\+61(4\d{2})(\d{3})(\d{3})$/.exec(e164);
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : e164;
}

export function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
