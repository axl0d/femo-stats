-- ============================================================
-- FEMO Stats — Supabase schema
-- Run in: Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- ---------- companies ----------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  tax_id text,
  industry_code text,
  created_at timestamptz not null default now()
);

create index idx_companies_doctor_id on public.companies(doctor_id);
alter table public.companies enable row level security;

create policy "doctor_select_companies" on public.companies for select to authenticated
  using ((select auth.uid()) = doctor_id);
create policy "doctor_insert_companies" on public.companies for insert to authenticated
  with check ((select auth.uid()) = doctor_id);
create policy "doctor_update_companies" on public.companies for update to authenticated
  using ((select auth.uid()) = doctor_id) with check ((select auth.uid()) = doctor_id);
create policy "doctor_delete_companies" on public.companies for delete to authenticated
  using ((select auth.uid()) = doctor_id);


-- ---------- workers ----------
create table public.workers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  full_name text not null,
  sex text check (sex in ('M', 'F')),
  birth_date date,
  age int,
  blood_type text,
  position text,
  created_at timestamptz not null default now()
);

create index idx_workers_company_id on public.workers(company_id);
alter table public.workers enable row level security;

create policy "doctor_select_workers" on public.workers for select to authenticated
  using (company_id in (select id from public.companies where doctor_id = (select auth.uid())));
create policy "doctor_insert_workers" on public.workers for insert to authenticated
  with check (company_id in (select id from public.companies where doctor_id = (select auth.uid())));
create policy "doctor_update_workers" on public.workers for update to authenticated
  using (company_id in (select id from public.companies where doctor_id = (select auth.uid())))
  with check (company_id in (select id from public.companies where doctor_id = (select auth.uid())));
create policy "doctor_delete_workers" on public.workers for delete to authenticated
  using (company_id in (select id from public.companies where doctor_id = (select auth.uid())));


-- ---------- exams ----------
create table public.exams (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete cascade,
  exam_date date,
  exam_type text check (exam_type in ('INGRESO', 'PERIODICO', 'REINTEGRO', 'RETIRO', 'UNSPECIFIED')),
  source_file text,
  temperature numeric(4,1),
  blood_pressure text,
  heart_rate numeric(5,1),
  respiratory_rate numeric(5,1),
  o2_saturation numeric(5,1),
  weight_kg numeric(5,1),
  height_m numeric(4,2),
  bmi numeric(4,1),
  waist_cm numeric(5,1),
  smoker text check (smoker in ('Yes', 'No', 'No data')),
  fitness text check (fitness in ('Fit', 'Fit with restrictions', 'Unfit', 'No data')),
  created_at timestamptz not null default now()
);

create index idx_exams_worker_id on public.exams(worker_id);
create index idx_exams_date on public.exams(exam_date);
alter table public.exams enable row level security;

create policy "doctor_select_exams" on public.exams for select to authenticated
  using (worker_id in (
    select w.id from public.workers w
    join public.companies c on c.id = w.company_id
    where c.doctor_id = (select auth.uid())
  ));
create policy "doctor_insert_exams" on public.exams for insert to authenticated
  with check (worker_id in (
    select w.id from public.workers w
    join public.companies c on c.id = w.company_id
    where c.doctor_id = (select auth.uid())
  ));
create policy "doctor_update_exams" on public.exams for update to authenticated
  using (worker_id in (
    select w.id from public.workers w
    join public.companies c on c.id = w.company_id
    where c.doctor_id = (select auth.uid())
  ))
  with check (worker_id in (
    select w.id from public.workers w
    join public.companies c on c.id = w.company_id
    where c.doctor_id = (select auth.uid())
  ));
create policy "doctor_delete_exams" on public.exams for delete to authenticated
  using (worker_id in (
    select w.id from public.workers w
    join public.companies c on c.id = w.company_id
    where c.doctor_id = (select auth.uid())
  ));


-- ---------- risk_factors ----------
create table public.risk_factors (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  category text not null,
  factor text not null
);

create index idx_risk_factors_exam_id on public.risk_factors(exam_id);
alter table public.risk_factors enable row level security;

create policy "doctor_select_risks" on public.risk_factors for select to authenticated
  using (exam_id in (
    select e.id from public.exams e
    join public.workers w on w.id = e.worker_id
    join public.companies c on c.id = w.company_id
    where c.doctor_id = (select auth.uid())
  ));
create policy "doctor_insert_risks" on public.risk_factors for insert to authenticated
  with check (exam_id in (
    select e.id from public.exams e
    join public.workers w on w.id = e.worker_id
    join public.companies c on c.id = w.company_id
    where c.doctor_id = (select auth.uid())
  ));
create policy "doctor_delete_risks" on public.risk_factors for delete to authenticated
  using (exam_id in (
    select e.id from public.exams e
    join public.workers w on w.id = e.worker_id
    join public.companies c on c.id = w.company_id
    where c.doctor_id = (select auth.uid())
  ));


-- Grants required for the Supabase Data API (PostgREST)
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.companies, public.workers, public.exams, public.risk_factors to authenticated;
