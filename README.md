# RouteRun (prototype)

A simple app for transport companies, their office staff and their drivers:

- **Each company gets its own portal** at `/c/your-company`. Companies sign up at `/signup` and only ever see their own drivers, vehicles and jobs.
- **Office** adds drivers (name, mobile, licence, vehicle) and vehicles (rego, make and model, type, capacity).
- **Drivers log in with their mobile number and a 6-digit PIN** set by the office. After 5 wrong PINs the login locks for 15 minutes; the office can reset a PIN at any time.
- **Drivers** see their run on a map. The app always sends them to the **closest stop they can do next**, and a drop-off only unlocks once its pickup is done. Drivers can tap "Go here next" to override the order.
- **Navigate** opens Google Maps or Waze for turn-by-turn directions.
- **Add jobs** by hand, or **drop in a consignment note, PDF or photo** and the app fills in the form.
- **Office** can create jobs, assign or reassign them to drivers, and see progress.
- **Complete a job** with an optional name, photo and signature. If the job has an email and/or mobile number, the customer gets a "job completed" notice.

## Run it

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
cp .env.example .env.local   # optional: add keys to turn on real features
npm run dev
```

Open http://localhost:3000, choose **Create a company account**, add a vehicle and a driver, then **Load sample jobs** on the Jobs tab. Log out and log in on your portal as the driver with their mobile number and PIN.

Locally, data is kept in a built-in database in `.data/`. Delete that folder to start fresh.

## Demo mode vs real features

Every outside service is optional. Without its key the app still works:

| Feature | Without a key | With a key |
| --- | --- | --- |
| Database | Built-in, on this computer only | `DATABASE_URL`: Supabase, Neon or any Postgres. **Required when deployed** |
| Address search | OpenStreetMap (free, light use only) | `GOOGLE_MAPS_API_KEY`: Google Geocoding, better Australian addresses |
| Reading dropped documents | File is attached, form filled by hand | `ANTHROPIC_API_KEY`: fields filled in automatically |
| Email notice and password reset | Shown as "demo"; reset unavailable | `SMTP_HOST` + `SMTP_USER` + `SMTP_PASS` (e.g. Titan: `smtp.titan.email`), or `RESEND_API_KEY` + `NOTIFY_EMAIL_FROM` |
| SMS notice | Shown as "demo", not sent | `CLICKSEND_USERNAME` + `CLICKSEND_API_KEY` |
| Road route and drive time | Public OSRM demo server | Swap to Google Routes API for production |

## Not done yet

- Photos and signatures are stored as small images in the database; move them to file storage (Supabase Storage or Vercel Blob) as volume grows.
- Uploaded documents are read but not stored; only the file name is kept.
- Login by SMS code instead of PIN (needs the SMS provider).
- Truck-safe routing (low bridges, weight limits) needs HERE or TomTom.

## Code map

- `lib/planner.ts`: nearest-next-stop ordering with pickup-before-drop-off.
- `app/run/page.tsx`: driver screen. `app/office/page.tsx`: office board. `app/jobs/new/page.tsx`: add job.
- `app/office/drivers`, `app/office/vehicles`: fleet management. `app/c/[slug]`: company login portal. `app/signup`: new company.
- `lib/server/schema.ts`: database tables (created automatically). `lib/server/auth.ts`: sessions, PIN and password hashing.
- `app/api/extract`: reads documents with the Claude API. `lib/server/notify.ts`: email and SMS. `app/api/geocode`, `app/api/route`: maps.

## Deploy

Push to GitHub, import the repo in [Vercel](https://vercel.com), and add the keys from `.env.example` as environment variables. **Set `DATABASE_URL` before real use**: without it the deployed app falls back to a temporary database that is wiped regularly. A free Supabase project works: copy its connection string (Transaction pooler) from Project Settings, Database. Drivers open the link on their phone and use "Add to Home Screen" to install it like an app.
