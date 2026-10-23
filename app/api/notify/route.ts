import { NextResponse } from "next/server";

type Body = {
  email?: string;
  phone?: string;
  customerName: string;
  reference?: string;
  address: string;
  completedAt: string;
  receivedBy?: string;
  driverName: string;
};

type Result = { channel: "email" | "sms"; to: string; ok: boolean; demo: boolean; error?: string };

/**
 * Sends the job-completed notice to whichever contact details the job has.
 * Without provider keys it runs in demo mode: nothing is sent, but the result
 * says what would have gone out.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const when = new Date(body.completedAt).toLocaleString("en-AU", {
    timeZone: "Australia/Sydney",
    dateStyle: "medium",
    timeStyle: "short",
  });
  const ref = body.reference ? ` (ref ${body.reference})` : "";
  const received = body.receivedBy ? ` Received by ${body.receivedBy}.` : "";
  const text = `Hi ${body.customerName}, your delivery${ref} to ${body.address} was completed at ${when} by ${body.driverName}.${received}`;

  const results: Result[] = [];
  if (body.email) results.push(await sendEmail(body.email, `Delivery completed${ref}`, text));
  if (body.phone) results.push(await sendSms(body.phone, text));
  return NextResponse.json({ results, message: text });
}

async function sendEmail(to: string, subject: string, text: string): Promise<Result> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_EMAIL_FROM;
  if (!key || !from) return { channel: "email", to, ok: true, demo: true };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    if (!res.ok) return { channel: "email", to, ok: false, demo: false, error: await res.text() };
    return { channel: "email", to, ok: true, demo: false };
  } catch (err) {
    return { channel: "email", to, ok: false, demo: false, error: String(err) };
  }
}

/** Australian mobiles: 04xx xxx xxx -> +614xxxxxxxx. */
function toE164(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("0")) return `+61${digits.slice(1)}`;
  if (digits.startsWith("61")) return `+${digits}`;
  return digits;
}

async function sendSms(phone: string, text: string): Promise<Result> {
  const to = toE164(phone);
  const user = process.env.CLICKSEND_USERNAME;
  const key = process.env.CLICKSEND_API_KEY;
  if (!user || !key) return { channel: "sms", to, ok: true, demo: true };
  try {
    const res = await fetch("https://rest.clicksend.com/v3/sms/send", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${user}:${key}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [{ source: "driver-route-app", to, body: text, ...(process.env.CLICKSEND_SENDER_ID ? { from: process.env.CLICKSEND_SENDER_ID } : {}) }],
      }),
    });
    const data = await res.json().catch(() => ({}));
    const status = data?.data?.messages?.[0]?.status;
    if (!res.ok || (status && status !== "SUCCESS")) {
      return { channel: "sms", to, ok: false, demo: false, error: status ?? data?.response_msg ?? `HTTP ${res.status}` };
    }
    return { channel: "sms", to, ok: true, demo: false };
  } catch (err) {
    return { channel: "sms", to, ok: false, demo: false, error: String(err) };
  }
}
