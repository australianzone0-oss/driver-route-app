# RouteRun (prototype)

A simple app for transport drivers and the office:

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

Open http://localhost:3000. Pick a driver, then **Load sample run (Sydney)** to try it.

## Demo mode vs real features

Every outside service is optional. Without its key the app still works:

| Feature | Without a key | With a key |
| --- | --- | --- |
| Address search | OpenStreetMap (free, light use only) | `GOOGLE_MAPS_API_KEY`: Google Geocoding, better Australian addresses |
| Reading dropped documents | File is attached, form filled by hand | `ANTHROPIC_API_KEY`: fields filled in automatically |
| Email notice | Shown as "demo", not sent | `RESEND_API_KEY` + `NOTIFY_EMAIL_FROM` |
| SMS notice | Shown as "demo", not sent | `CLICKSEND_USERNAME` + `CLICKSEND_API_KEY` |
| Road route and drive time | Public OSRM demo server | Swap to Google Routes API for production |

## What the prototype does not do yet

- **Data is saved in the browser only** (`lib/store.ts`). The office and drivers only share data on the same device. The next step is Supabase: the database design is in `supabase/schema.sql`, with sign-in and per-driver access rules.
- Photos and signatures are kept as small images in the browser; in production they go to Supabase Storage.
- Truck-safe routing (low bridges, weight limits) needs HERE or TomTom.

## Code map

- `lib/planner.ts`: nearest-next-stop ordering with pickup-before-drop-off.
- `app/run/page.tsx`: driver screen. `app/office/page.tsx`: office board. `app/jobs/new/page.tsx`: add job.
- `app/api/extract`: reads documents with the Claude API. `app/api/notify`: email and SMS. `app/api/geocode`, `app/api/route`: maps.

## Deploy

Push to GitHub, import the repo in [Vercel](https://vercel.com), add the keys from `.env.example` as environment variables, deploy. Drivers open the link on their phone and use "Add to Home Screen" to install it like an app.
