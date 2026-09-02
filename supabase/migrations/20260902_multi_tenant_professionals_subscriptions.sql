-- 1. professionals (tenant identity: a profile becomes a professional)
create table public.professionals (
  id uuid primary key references public.profiles(id) on delete cascade,
  especialidade text not null default 'personal_trainer',
  created_at timestamptz not null default now()
);
alter table public.professionals enable row level security;

-- 2. products a professional sells
create table public.professional_plans (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  nome text not null,
  inclui_dieta boolean not null default false,
  inclui_treino boolean not null default false,
  preco_centavos integer,
  periodicidade text not null default 'mensal',
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.professional_plans enable row level security;

-- 3. the real patient<->professional<->plan link
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  plan_id uuid references public.professional_plans(id),
  status text not null default 'ativa',
  started_at timestamptz not null default now(),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  unique (patient_id, professional_id, plan_id)
);
alter table public.subscriptions enable row level security;

-- helper functions: scoped replacements for the old global is_trainer()
create or replace function public.is_professional_of(p_patient_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.patient_id = p_patient_id
      and s.professional_id = auth.uid()
      and s.status = 'ativa'
  );
$$;

create or replace function public.is_client_of(p_professional_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.professional_id = p_professional_id
      and s.patient_id = auth.uid()
      and s.status = 'ativa'
  );
$$;

create or replace function public.is_professional()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.professionals where id = auth.uid());
$$;

-- 4. scope plans / planos_alimentares to the professional that owns them
alter table public.plans add column professional_id uuid references public.professionals(id);
alter table public.planos_alimentares add column professional_id uuid references public.professionals(id);

-- === BACKFILL (single professional today: Tassis) ===
insert into public.professionals (id, especialidade)
select id, 'personal_trainer' from public.profiles where role = 'trainer'
on conflict (id) do nothing;

insert into public.professional_plans (professional_id, nome, inclui_dieta, inclui_treino, ativo)
select id, 'Padrão (migração)', true, true, true from public.professionals;

insert into public.subscriptions (patient_id, professional_id, plan_id, status)
select p.id, pr.id, pp.id, 'ativa'
from public.profiles p
cross join public.professionals pr
join public.professional_plans pp on pp.professional_id = pr.id and pp.nome = 'Padrão (migração)'
where p.role = 'client'
on conflict do nothing;

update public.plans set professional_id = (select id from public.professionals limit 1) where professional_id is null;
update public.planos_alimentares set professional_id = (select id from public.professionals limit 1) where professional_id is null;

alter table public.plans alter column professional_id set not null;
alter table public.planos_alimentares alter column professional_id set not null;

-- === RLS rewrite: replace global is_trainer() with scoped checks ===

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or is_professional_of(id) or is_client_of(id));

drop policy if exists profiles_update_trainer on public.profiles;
create policy profiles_update_trainer on public.profiles for update
  using (is_professional_of(id));

drop policy if exists anamnese_select on public.anamnese;
create policy anamnese_select on public.anamnese for select
  using (client_id = auth.uid() or is_professional_of(client_id));

drop policy if exists anamnese_insert_trainer on public.anamnese;
create policy anamnese_insert_professional on public.anamnese for insert
  with check (is_professional_of(client_id));

drop policy if exists anamnese_update_trainer on public.anamnese;
create policy anamnese_update_professional on public.anamnese for update
  using (is_professional_of(client_id));

drop policy if exists plans_select on public.plans;
create policy plans_select on public.plans for select
  using (client_id = auth.uid() or is_professional_of(client_id));

drop policy if exists plans_insert_trainer on public.plans;
create policy plans_insert_professional on public.plans for insert
  with check (professional_id = auth.uid() and is_professional_of(client_id));

drop policy if exists plans_update_trainer on public.plans;
create policy plans_update_professional on public.plans for update
  using (professional_id = auth.uid() and is_professional_of(client_id));

drop policy if exists plans_delete_trainer on public.plans;
create policy plans_delete_professional on public.plans for delete
  using (professional_id = auth.uid() and is_professional_of(client_id));

drop policy if exists dieta_select on public.planos_alimentares;
create policy dieta_select on public.planos_alimentares for select
  using (client_id = auth.uid() or is_professional_of(client_id));

drop policy if exists dieta_insert_trainer on public.planos_alimentares;
create policy dieta_insert_professional on public.planos_alimentares for insert
  with check (professional_id = auth.uid() and is_professional_of(client_id));

drop policy if exists dieta_update_trainer on public.planos_alimentares;
create policy dieta_update_professional on public.planos_alimentares for update
  using (professional_id = auth.uid() and is_professional_of(client_id));

drop policy if exists dieta_delete_trainer on public.planos_alimentares;
create policy dieta_delete_professional on public.planos_alimentares for delete
  using (professional_id = auth.uid() and is_professional_of(client_id));

drop policy if exists logs_select on public.workout_logs;
create policy logs_select on public.workout_logs for select
  using (client_id = auth.uid() or is_professional_of(client_id));

drop policy if exists drafts_select on public.workout_drafts;
create policy drafts_select on public.workout_drafts for select
  using (client_id = auth.uid() or is_professional_of(client_id));

drop policy if exists convites_trainer_all on public.convites;
create policy convites_professionals_all on public.convites for all
  using (is_professional() and (created_by = auth.uid() or created_by is null))
  with check (is_professional() and created_by = auth.uid());

-- RLS for the new tables
create policy professionals_select on public.professionals for select
  using (id = auth.uid() or is_client_of(id));
create policy professionals_update_self on public.professionals for update
  using (id = auth.uid());
create policy professionals_insert_self on public.professionals for insert
  with check (id = auth.uid());

create policy professional_plans_select on public.professional_plans for select
  using (
    professional_id = auth.uid()
    or exists (select 1 from public.subscriptions s where s.plan_id = professional_plans.id and s.patient_id = auth.uid())
  );
create policy professional_plans_write on public.professional_plans for all
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());

create policy subscriptions_select on public.subscriptions for select
  using (patient_id = auth.uid() or professional_id = auth.uid());
create policy subscriptions_write on public.subscriptions for all
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());
