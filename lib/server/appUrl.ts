/**
 * The app's own address, for links in emails. Taken from configuration rather
 * than the request's Host header so a forged header can't redirect reset links.
 */
export function appUrl(req: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const vercel =
    process.env.VERCEL_ENV === "production"
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL
      : process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return new URL(req.url).origin; // local development
}
