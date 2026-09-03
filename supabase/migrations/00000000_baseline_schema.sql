-- BASELINE do schema completo do projeto `treino-tassis`.
--
-- Capturado por introspecção em 03/set/2026. Até então o schema base existia SÓ na nuvem:
-- as tabelas originais, as policies e os triggers nunca tinham sido versionados — só as
-- migrações 20260902 e 20260903 estavam no git. Se o projeto Supabase sumisse, o schema
-- sumia junto.
--
-- Este arquivo representa o estado APÓS as migrações 20260902 e 20260903 (já inclui
-- `professionals`, `professional_plans`, `subscriptions`, `convites.plan_id` e as RLS
-- escopadas por assinatura). É o que precisa rodar num projeto novo e vazio.
--
-- Ordem importa: extensões → tabelas → constraints → índices → funções → trigger → RLS.

-- ============================================================ extensões
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- ============================================================ tabelas

create table public.alimentos_taco (
  id integer not null,
  nome text not null,
  categoria text not null,
  kcal numeric,
  proteina_g numeric,
  lipideos_g numeric,
  carboidrato_g numeric,
  fibra_g numeric,
  sodio_mg numeric,
  calcio_mg numeric,
  ferro_mg numeric
);

create table public.profiles (
  id uuid not null,
  nome text default ''::text not null,
  role text default 'client'::text not null,
  created_at timestamp with time zone default now() not null,
  email text,
  telefone text default ''::text,
  data_nascimento date,
  altura_cm numeric,
  peso_kg numeric
);

create table public.professionals (
  id uuid not null,
  especialidade text default 'personal_trainer'::text not null,
  created_at timestamp with time zone default now() not null
);

create table public.professional_plans (
  id uuid default gen_random_uuid() not null,
  professional_id uuid not null,
  nome text not null,
  inclui_dieta boolean default false not null,
  inclui_treino boolean default false not null,
  preco_centavos integer,
  periodicidade text default 'mensal'::text not null,
  ativo boolean default true not null,
  created_at timestamp with time zone default now() not null
);

create table public.subscriptions (
  id uuid default gen_random_uuid() not null,
  patient_id uuid not null,
  professional_id uuid not null,
  plan_id uuid,
  status text default 'ativa'::text not null,
  started_at timestamp with time zone default now() not null,
  current_period_end timestamp with time zone,
  created_at timestamp with time zone default now() not null
);

create table public.anamnese (
  client_id uuid not null,
  objetivo_principal text default ''::text not null,
  nivel_atividade text default ''::text not null,
  lesoes_dores text default ''::text not null,
  condicoes_medicas text default ''::text not null,
  medicamentos text default ''::text not null,
  cirurgias text default ''::text not null,
  historico_familiar text default ''::text not null,
  restricoes_alimentares text default ''::text not null,
  alergias text default ''::text not null,
  observacoes text default ''::text not null,
  updated_at timestamp with time zone default now() not null,
  respostas_completas jsonb
);

create table public.convites (
  id uuid default gen_random_uuid() not null,
  token text not null,
  nome text default ''::text not null,
  email text not null,
  status text default 'pendente'::text not null,
  respostas jsonb,
  client_id uuid,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  respondido_em timestamp with time zone,
  plan_id uuid
);

create table public.plans (
  id uuid default gen_random_uuid() not null,
  client_id uuid not null,
  periodo text default ''::text not null,
  treinador text default ''::text not null,
  dias jsonb default '[]'::jsonb not null,
  updated_at timestamp with time zone default now() not null,
  professional_id uuid not null
);

create table public.planos_alimentares (
  id uuid default gen_random_uuid() not null,
  client_id uuid not null,
  periodo text default ''::text not null,
  nutricionista text default ''::text not null,
  meta_kcal numeric,
  meta_proteina_g numeric,
  meta_carboidrato_g numeric,
  meta_gordura_g numeric,
  refeicoes jsonb default '[]'::jsonb not null,
  observacoes text default ''::text not null,
  updated_at timestamp with time zone default now() not null,
  professional_id uuid not null
);

create table public.workout_logs (
  id uuid default gen_random_uuid() not null,
  client_id uuid not null,
  exercise_id text not null,
  session_date date not null,
  sets jsonb not null,
  created_at timestamp with time zone default now() not null
);

create table public.workout_drafts (
  client_id uuid not null,
  exercise_id text not null,
  session_date date not null,
  sets jsonb default '[]'::jsonb not null,
  updated_at timestamp with time zone default now() not null
);

-- ============================================================ constraints

alter table public.alimentos_taco add constraint alimentos_taco_pkey PRIMARY KEY (id);

alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_role_check CHECK ((role = ANY (ARRAY['client'::text, 'trainer'::text])));

alter table public.professionals add constraint professionals_pkey PRIMARY KEY (id);
alter table public.professionals add constraint professionals_id_fkey FOREIGN KEY (id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table public.professional_plans add constraint professional_plans_pkey PRIMARY KEY (id);
alter table public.professional_plans add constraint professional_plans_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES professionals(id) ON DELETE CASCADE;

alter table public.subscriptions add constraint subscriptions_pkey PRIMARY KEY (id);
alter table public.subscriptions add constraint subscriptions_patient_id_professional_id_plan_id_key UNIQUE (patient_id, professional_id, plan_id);
alter table public.subscriptions add constraint subscriptions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.subscriptions add constraint subscriptions_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES professionals(id) ON DELETE CASCADE;
alter table public.subscriptions add constraint subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES professional_plans(id);

alter table public.anamnese add constraint anamnese_pkey PRIMARY KEY (client_id);
alter table public.anamnese add constraint anamnese_client_id_fkey FOREIGN KEY (client_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table public.convites add constraint convites_pkey PRIMARY KEY (id);
alter table public.convites add constraint convites_token_key UNIQUE (token);
alter table public.convites add constraint convites_client_id_fkey FOREIGN KEY (client_id) REFERENCES profiles(id);
alter table public.convites add constraint convites_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);
alter table public.convites add constraint convites_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES professional_plans(id);
alter table public.convites add constraint convites_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'preenchido'::text, 'concluido'::text])));

alter table public.plans add constraint plans_pkey PRIMARY KEY (id);
alter table public.plans add constraint plans_client_id_fkey FOREIGN KEY (client_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.plans add constraint plans_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES professionals(id);

alter table public.planos_alimentares add constraint planos_alimentares_pkey PRIMARY KEY (id);
alter table public.planos_alimentares add constraint planos_alimentares_client_id_key UNIQUE (client_id);
alter table public.planos_alimentares add constraint planos_alimentares_client_id_fkey FOREIGN KEY (client_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.planos_alimentares add constraint planos_alimentares_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES professionals(id);

alter table public.workout_logs add constraint workout_logs_pkey PRIMARY KEY (id);
alter table public.workout_logs add constraint workout_logs_unico UNIQUE (client_id, exercise_id, session_date);
alter table public.workout_logs add constraint workout_logs_client_id_fkey FOREIGN KEY (client_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table public.workout_drafts add constraint workout_drafts_pkey PRIMARY KEY (client_id, exercise_id);
alter table public.workout_drafts add constraint workout_drafts_client_id_fkey FOREIGN KEY (client_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ============================================================ índices
-- ⚠️ `plans_client_id_key` é a dívida técnica conhecida: um plano de treino por aluno,
-- o que impede dois profissionais atenderem o mesmo paciente (ver §5 do HANDOFF).
-- Reproduzido aqui por fidelidade ao estado atual — corrigir em migração própria.

CREATE INDEX alimentos_taco_nome_idx ON public.alimentos_taco USING gin (to_tsvector('portuguese'::regconfig, nome));
CREATE UNIQUE INDEX plans_client_id_key ON public.plans USING btree (client_id);
CREATE INDEX workout_logs_client_idx ON public.workout_logs USING btree (client_id, exercise_id, session_date);

-- ============================================================ funções

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, nome, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', ''), new.email, 'client');
  return new;
end;
$function$;

-- Legado: não é mais usada em nenhuma policy desde a migração multi-tenant.
create or replace function public.is_trainer()
returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'trainer');
$function$;

create or replace function public.is_professional()
returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select exists (select 1 from public.professionals where id = auth.uid());
$function$;

create or replace function public.is_professional_of(p_patient_id uuid)
returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select exists (
    select 1 from public.subscriptions s
    where s.patient_id = p_patient_id
      and s.professional_id = auth.uid()
      and s.status = 'ativa'
  );
$function$;

create or replace function public.is_client_of(p_professional_id uuid)
returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select exists (
    select 1 from public.subscriptions s
    where s.professional_id = p_professional_id
      and s.patient_id = auth.uid()
      and s.status = 'ativa'
  );
$function$;

create or replace function public.obter_convite(p_token text)
returns table(nome text, email text, status text)
language sql stable security definer set search_path to 'public'
as $function$
  select nome, email, status from public.convites where token = p_token;
$function$;

create or replace function public.submeter_anamnese(p_token text, p_respostas jsonb)
returns boolean language plpgsql security definer set search_path to 'public'
as $function$
begin
  update public.convites set respostas = p_respostas, status = 'preenchido', respondido_em = now()
  where token = p_token and status = 'pendente';
  return found;
end;
$function$;

-- Ver 20260903_convite_cria_assinatura.sql para a explicação da criação da assinatura.
create or replace function public.finalizar_cadastro_convite(p_token text)
returns boolean language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_email text;
  v_respostas jsonb;
  v_uid uuid := auth.uid();
  v_user_email text;
  v_created_by uuid;
  v_plan_id uuid;
begin
  if v_uid is null then return false; end if;
  select email into v_user_email from auth.users where id = v_uid;

  select email, respostas, created_by, plan_id
    into v_email, v_respostas, v_created_by, v_plan_id
  from public.convites
  where token = p_token and status = 'preenchido';

  if v_email is null or v_respostas is null or lower(v_email) <> lower(coalesce(v_user_email,'')) then
    return false;
  end if;

  update public.profiles set
    nome = coalesce(nullif(v_respostas->>'nome_completo',''), nome),
    telefone = coalesce(nullif(v_respostas->>'telefone',''), telefone),
    data_nascimento = nullif(v_respostas->>'data_nascimento','')::date,
    altura_cm = nullif(v_respostas->>'altura_cm','')::numeric,
    peso_kg = nullif(v_respostas->>'peso_atual','')::numeric
  where id = v_uid;

  insert into public.anamnese (client_id, objetivo_principal, nivel_atividade, lesoes_dores, condicoes_medicas,
    medicamentos, cirurgias, historico_familiar, restricoes_alimentares, alergias, observacoes,
    respostas_completas, updated_at)
  values (v_uid,
    coalesce(v_respostas->>'objetivo_principal',''),
    coalesce(v_respostas->>'pratica_atividade',''),
    coalesce(v_respostas->>'limitacao_fisica',''),
    coalesce(v_respostas->>'patologias',''),
    coalesce(v_respostas->>'medicamentos',''),
    coalesce(v_respostas->>'cirurgias',''),
    coalesce(v_respostas->>'historico_familiar',''),
    coalesce(v_respostas->>'nao_consome',''),
    coalesce(v_respostas->>'intolerancias_alergias',''),
    coalesce(v_respostas->>'observacoes_finais',''),
    v_respostas, now()
  )
  on conflict (client_id) do update set
    objetivo_principal = excluded.objetivo_principal,
    nivel_atividade = excluded.nivel_atividade,
    lesoes_dores = excluded.lesoes_dores,
    condicoes_medicas = excluded.condicoes_medicas,
    medicamentos = excluded.medicamentos,
    cirurgias = excluded.cirurgias,
    historico_familiar = excluded.historico_familiar,
    restricoes_alimentares = excluded.restricoes_alimentares,
    alergias = excluded.alergias,
    observacoes = excluded.observacoes,
    respostas_completas = excluded.respostas_completas,
    updated_at = now();

  if v_created_by is not null
     and exists (select 1 from public.professionals where id = v_created_by)
     and not exists (
       select 1 from public.subscriptions
       where patient_id = v_uid and professional_id = v_created_by
     )
  then
    insert into public.subscriptions (patient_id, professional_id, plan_id, status)
    values (v_uid, v_created_by, v_plan_id, 'ativa');
  end if;

  update public.convites set status = 'concluido', client_id = v_uid where token = p_token;
  return true;
end;
$function$;

-- ============================================================ trigger

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================ RLS

alter table public.alimentos_taco enable row level security;
alter table public.profiles enable row level security;
alter table public.professionals enable row level security;
alter table public.professional_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.anamnese enable row level security;
alter table public.convites enable row level security;
alter table public.plans enable row level security;
alter table public.planos_alimentares enable row level security;
alter table public.workout_logs enable row level security;
alter table public.workout_drafts enable row level security;

-- TACO é tabela de referência pública (composição de alimentos), sem dado pessoal.
create policy taco_select_todos on public.alimentos_taco for select to public using (true);

create policy profiles_select on public.profiles for select to public
  using (((id = auth.uid()) OR is_professional_of(id) OR is_client_of(id)));
create policy profiles_insert_own on public.profiles for insert to public
  with check ((id = auth.uid()));
create policy profiles_update_own on public.profiles for update to public
  using ((id = auth.uid()));
create policy profiles_update_trainer on public.profiles for update to public
  using (is_professional_of(id));

create policy professionals_select on public.professionals for select to public
  using (((id = auth.uid()) OR is_client_of(id)));
create policy professionals_insert_self on public.professionals for insert to public
  with check ((id = auth.uid()));
create policy professionals_update_self on public.professionals for update to public
  using ((id = auth.uid()));

create policy professional_plans_select on public.professional_plans for select to public
  using (((professional_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM subscriptions s
  WHERE ((s.plan_id = professional_plans.id) AND (s.patient_id = auth.uid()))))));
create policy professional_plans_write on public.professional_plans for all to public
  using ((professional_id = auth.uid()))
  with check ((professional_id = auth.uid()));

create policy subscriptions_select on public.subscriptions for select to public
  using (((patient_id = auth.uid()) OR (professional_id = auth.uid())));
create policy subscriptions_write on public.subscriptions for all to public
  using ((professional_id = auth.uid()))
  with check ((professional_id = auth.uid()));

create policy anamnese_select on public.anamnese for select to public
  using (((client_id = auth.uid()) OR is_professional_of(client_id)));
create policy anamnese_insert_professional on public.anamnese for insert to public
  with check (is_professional_of(client_id));
create policy anamnese_update_professional on public.anamnese for update to public
  using (is_professional_of(client_id));

create policy convites_professionals_all on public.convites for all to public
  using ((is_professional() AND ((created_by = auth.uid()) OR (created_by IS NULL))))
  with check ((is_professional() AND (created_by = auth.uid())));

create policy plans_select on public.plans for select to public
  using (((client_id = auth.uid()) OR is_professional_of(client_id)));
create policy plans_insert_professional on public.plans for insert to public
  with check (((professional_id = auth.uid()) AND is_professional_of(client_id)));
create policy plans_update_professional on public.plans for update to public
  using (((professional_id = auth.uid()) AND is_professional_of(client_id)));
create policy plans_delete_professional on public.plans for delete to public
  using (((professional_id = auth.uid()) AND is_professional_of(client_id)));

create policy dieta_select on public.planos_alimentares for select to public
  using (((client_id = auth.uid()) OR is_professional_of(client_id)));
create policy dieta_insert_professional on public.planos_alimentares for insert to public
  with check (((professional_id = auth.uid()) AND is_professional_of(client_id)));
create policy dieta_update_professional on public.planos_alimentares for update to public
  using (((professional_id = auth.uid()) AND is_professional_of(client_id)));
create policy dieta_delete_professional on public.planos_alimentares for delete to public
  using (((professional_id = auth.uid()) AND is_professional_of(client_id)));

create policy logs_select on public.workout_logs for select to public
  using (((client_id = auth.uid()) OR is_professional_of(client_id)));
create policy logs_insert_own on public.workout_logs for insert to public
  with check ((client_id = auth.uid()));
create policy logs_update_own on public.workout_logs for update to public
  using ((client_id = auth.uid()));
create policy logs_delete_own on public.workout_logs for delete to public
  using ((client_id = auth.uid()));

create policy drafts_select on public.workout_drafts for select to public
  using (((client_id = auth.uid()) OR is_professional_of(client_id)));
create policy drafts_all_own on public.workout_drafts for all to public
  using ((client_id = auth.uid()))
  with check ((client_id = auth.uid()));
