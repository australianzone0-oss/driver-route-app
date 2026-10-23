import nodemailer from "nodemailer";
import { normalizePhone } from "@/lib/phone";

export type NoticeInput = {
  email?: string;
  phone?: string;
  customerName: string;
  reference?: string;
  address: string;
  completedAt: string;
  receivedBy?: string;
  driverName: string;
  companyName?: string;
};

export type Result = { channel: "email" | "sms"; to: string; ok: boolean; demo: boolean; error?: string };

/**
 * Sends the job-completed notice to whichever contact details the job has.
 * Without provider keys it runs in demo mode: nothing is sent, but the result
 * says what would have gone out.
 */
export async function sendCompletionNotice(body: NoticeInput): Promise<Result[]> {
  const when = new Date(body.completedAt).toLocaleString("en-AU", {
    timeZone: "Australia/Sydney",
    dateStyle: "medium",
    timeStyle: "short",
  });
  const ref = body.reference ? ` (ref ${body.reference})` : "";
  const received = body.receivedBy ? ` Received by ${body.receivedBy}.` : "";
  const from = body.companyName ? ` from ${body.companyName}` : "";
  const text = `Hi ${body.customerName}, your delivery${ref} to ${body.address} was completed at ${when} by ${body.driverName}${from}.${received}`;

  const results: Result[] = [];
  if (body.email) results.push(await sendEmail(body.email, `Delivery completed${ref}`, text));
  if (body.phone) results.push(await sendSms(body.phone, text));
  return results;
}

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function emailConfigured() {
  return smtpConfigured() || Boolean(process.env.RESEND_API_KEY && process.env.NOTIFY_EMAIL_FROM);
}

/**
 * Sends through SMTP (e.g. Titan: smtp.titan.email, port 465) when SMTP_* is set,
 * otherwise through Resend. SMTP mailboxes only send as themselves, so FROM
 * defaults to the SMTP login.
 */
export async function sendEmail(to: string, subject: string, text: string): Promise<Result> {
  if (!emailConfigured()) return { channel: "email", to, ok: true, demo: true };
  try {
    if (smtpConfigured()) {
      const port = Number(process.env.SMTP_PORT || 465);
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transport.sendMail({ from: process.env.NOTIFY_EMAIL_FROM || process.env.SMTP_USER, to, subject, text });
      return { channel: "email", to, ok: true, demo: false };
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.NOTIFY_EMAIL_FROM, to: [to], subject, text }),
    });
    if (!res.ok) return { channel: "email", to, ok: false, demo: false, error: await res.text() };
    return { channel: "email", to, ok: true, demo: false };
  } catch (err) {
    return { channel: "email", to, ok: false, demo: false, error: String(err) };
  }
}

async function sendSms(phone: string, text: string): Promise<Result> {
  const to = normalizePhone(phone) ?? phone;
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
