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

create table if not exists password_resets (
  token_hash text primary key,
  user_id uuid not null references users on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz
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

-- Company details used on invoices and in Settings.
alter table companies add column if not exists abn text;
alter table companies add column if not exists address text;
alter table companies add column if not exists phone text;
alter table companies add column if not exists email text;
alter table companies add column if not exists gst_rate numeric(5,2) not null default 10;
alter table companies add column if not exists invoice_prefix text not null default 'INV';
alter table companies add column if not exists next_invoice_no integer not null default 1001;
alter table companies add column if not exists payment_terms_days integer not null default 14;

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies on delete cascade,
  name text not null,
  contact_name text,
  email text,
  phone text,
  address text,
  abn text,
  default_rate numeric(12,2),  -- price per job when none is set
  credit_limit numeric(12,2),
  credit_hold boolean not null default false,
  payment_terms_days integer,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, name)
);

create table if not exists containers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies on delete cascade,
  customer_id uuid references customers on delete set null,
  container_number text not null,  -- ISO 6346, e.g. MSCU1234565
  size text,                       -- 20, 40, 40HC, 45
  container_type text,             -- GP, RF, OT, FR, TK
  full_empty text not null default 'full' check (full_empty in ('full', 'empty')),
  movement text not null default 'import' check (movement in ('import', 'export')),
  status text not null default 'at_wharf'
    check (status in ('at_wharf', 'in_transit', 'at_customer', 'at_depot', 'empty_park', 'returned')),
  held boolean not null default false,
  hold_reason text,
  vessel text,
  voyage text,
  wharf_pickup_date date,   -- import: when it can be collected
  wharf_dropoff_date date,  -- export: receival date at the wharf
  dehire_date date,         -- empty must be returned by
  empty_park text,
  weight_kg numeric(10,1),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies on delete cascade,
  customer_id uuid not null references customers on delete restrict,
  number text not null,
  issue_date date not null default current_date,
  due_date date not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'void')),
  subtotal numeric(12,2) not null default 0,
  gst numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notes text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (company_id, number)
);

create table if not exists invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices on delete cascade,
  job_id uuid references jobs on delete set null,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0
);

alter table jobs add column if not exists customer_id uuid references customers on delete set null;
alter table jobs add column if not exists container_id uuid references containers on delete set null;
alter table jobs add column if not exists price numeric(12,2);
alter table jobs add column if not exists invoice_id uuid references invoices on delete set null;

create index if not exists customers_company on customers (company_id);
create index if not exists containers_company on containers (company_id, status);
create index if not exists invoices_company on invoices (company_id, status);
create index if not exists invoice_lines_invoice on invoice_lines (invoice_id);

-- The app talks to the database directly as its owner. Row level security with
-- no policies stops Supabase's public Data API from reading these tables.
alter table companies enable row level security;
alter table vehicles enable row level security;
alter table users enable row level security;
alter table sessions enable row level security;
alter table password_resets enable row level security;
alter table jobs enable row level security;
alter table stops enable row level security;
alter table notices enable row level security;
alter table customers enable row level security;
alter table containers enable row level security;
alter table invoices enable row level security;
alter table invoice_lines enable row level security;
`;
