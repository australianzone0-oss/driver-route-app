// Applied automatically on first connection (safe to run repeatedly).
export const schema = /* sql */ `
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies on delete cascade,
  rego text not null,
  description text,          -- make and model
  vehicle_type text,         -- van, ute, rigid truck, semi...
  capacity text,             -- e.g. "2 pallets", "8 t"
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, rego)
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies on delete cascade,
  role text not null check (role in ('admin', 'driver')),
  name text not null,
  email text,                -- office login
  phone text,                -- driver login, E.164 e.g. +61412345678
  password_hash text not null,
  vehicle_id uuid references vehicles on delete set null,
  licence_number text,
  active boolean not null default true,
  failed_logins integer not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  unique (company_id, email),
  unique (company_id, phone)
);

create table if not exists sessions (
  token_hash text primary key,
  user_id uuid not null references users on delete cascade,
  expires_at timestamptz not null
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies on delete cascade,
  reference text,
  customer_name text not null,
  customer_email text,
  customer_phone text,
  notify_on_complete boolean not null default true,
  notes text,
  driver_id uuid not null references users on delete restrict,
  created_by text not null check (created_by in ('driver', 'office')),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  attachments jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table if not exists stops (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs on delete cascade,
  type text not null check (type in ('pickup', 'dropoff')),
  address text not null,
  lat double precision not null,
  lng double precision not null,
  status text not null default 'pending' check (status in ('pending', 'done')),
  completed_at timestamptz,
  received_by text,
  photo text,                -- small JPEG data URL for now; move to file storage later
  signature text
);

create table if not exists notices (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs on delete cascade,
  channel text not null check (channel in ('email', 'sms')),
  sent_to text not null,
  ok boolean not null,
  demo boolean not null default false,
  error text,
  sent_at timestamptz not null default now()
);

create index if not exists jobs_company_driver on jobs (company_id, driver_id, status);
create index if not exists stops_job on stops (job_id);
create index if not exists notices_job on notices (job_id);

-- The app talks to the database directly as its owner. Row level security with
-- no policies stops Supabase's public Data API from reading these tables.
alter table companies enable row level security;
alter table vehicles enable row level security;
alter table users enable row level security;
alter table sessions enable row level security;
alter table jobs enable row level security;
alter table stops enable row level security;
alter table notices enable row level security;
`;
