-- Database for the production version (Supabase / Postgres).
-- The prototype keeps data in the browser; this is the next step.

create table drivers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users on delete set null,
  name text not null,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table office_users (
  user_id uuid primary key references auth.users on delete cascade
);

create type job_status as enum ('pending', 'in_progress', 'completed');
create type stop_type as enum ('pickup', 'dropoff');

create table jobs (
  id uuid primary key default gen_random_uuid(),
  reference text,
  customer_name text not null,
  customer_email text,
  customer_phone text,
  notify_on_complete boolean not null default true,
  notes text,
  driver_id uuid not null references drivers on delete restrict,
  created_by text not null check (created_by in ('driver', 'office')),
  status job_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table stops (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs on delete cascade,
  type stop_type not null,
  address text not null,
  lat double precision not null,
  lng double precision not null,
  status text not null default 'pending' check (status in ('pending', 'done')),
  completed_at timestamptz,
  received_by text,
  photo_path text,      -- Supabase Storage: pod/<job_id>/<stop_id>.jpg
  signature_path text
);

create table attachments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs on delete cascade,
  name text not null,
  storage_path text not null,
  content_type text,
  size_bytes integer,
  created_at timestamptz not null default now()
);

create table notices (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs on delete cascade,
  channel text not null check (channel in ('email', 'sms')),
  sent_to text not null,
  ok boolean not null,
  error text,
  sent_at timestamptz not null default now()
);

create index on jobs (driver_id, status);
create index on stops (job_id);

-- Row level security: drivers see their own jobs, office sees everything.
alter table drivers enable row level security;
alter table jobs enable row level security;
alter table stops enable row level security;
alter table attachments enable row level security;
alter table notices enable row level security;

create function is_office() returns boolean language sql stable as $$
  select exists (select 1 from office_users where user_id = auth.uid())
$$;

create function my_driver_id() returns uuid language sql stable as $$
  select id from drivers where user_id = auth.uid()
$$;

create policy "drivers readable" on drivers for select using (true);
create policy "office manages drivers" on drivers for all using (is_office());

create policy "own or office jobs" on jobs for all
  using (is_office() or driver_id = my_driver_id())
  with check (is_office() or driver_id = my_driver_id());

create policy "stops follow jobs" on stops for all
  using (exists (select 1 from jobs j where j.id = job_id and (is_office() or j.driver_id = my_driver_id())));

create policy "attachments follow jobs" on attachments for all
  using (exists (select 1 from jobs j where j.id = job_id and (is_office() or j.driver_id = my_driver_id())));

create policy "notices follow jobs" on notices for all
  using (exists (select 1 from jobs j where j.id = job_id and (is_office() or j.driver_id = my_driver_id())));
