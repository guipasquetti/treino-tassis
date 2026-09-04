-- Passo 1 do funil (HANDOFF §12): consulta de sensibilização, antes de qualquer convite.
-- `leads` é quem ainda não virou paciente (sem conta, sem profiles.id); `atendimentos` é o
-- registro de cada consulta, podendo pendurar num lead (pré-conta) ou num cliente já
-- cadastrado (follow-up depois que virou paciente). Constraint do §12 se aplica: como
-- profiles.id só existe depois do signUp, lead precisa de tabela própria com client_id nulo
-- até a conversão.

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id),
  nome text not null,
  telefone text,
  email text,
  status text not null default 'lead' check (status in ('lead', 'convertido', 'perdido')),
  data_retomada date,
  observacoes text,
  client_id uuid references public.profiles(id),
  convite_id uuid references public.convites(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.atendimentos (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id),
  lead_id uuid references public.leads(id),
  client_id uuid references public.profiles(id),
  data_atendimento timestamptz not null default now(),
  notas text,
  created_at timestamptz not null default now(),
  constraint atendimentos_alvo_check check (lead_id is not null or client_id is not null)
);

create index leads_professional_id_idx on public.leads(professional_id);
create index atendimentos_professional_id_idx on public.atendimentos(professional_id);
create index atendimentos_lead_id_idx on public.atendimentos(lead_id);
create index atendimentos_client_id_idx on public.atendimentos(client_id);

alter table public.leads enable row level security;
alter table public.atendimentos enable row level security;

-- Mesmo padrão de professional_plans_write: só o profissional dono mexe no próprio lead/
-- atendimento. Não depende de is_professional_of() porque, por definição, ainda não existe
-- assinatura (o paciente pode nem ter conta).
create policy leads_write on public.leads
  for all
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());

create policy atendimentos_write on public.atendimentos
  for all
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());

-- Convite pode nascer a partir de um lead (pré-preenchendo nome/e-mail na tela); guardamos o
-- vínculo pra fechar o ciclo quando a conta for criada.
alter table public.convites add column lead_id uuid references public.leads(id);

-- Ao finalizar o cadastro, se o convite veio de um lead, marca o lead como convertido e
-- amarra o client_id — sem isso o lead ficaria "aberto" pra sempre mesmo já sendo paciente.
create or replace function public.finalizar_cadastro_convite(p_token text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_email text;
  v_respostas jsonb;
  v_uid uuid := auth.uid();
  v_user_email text;
  v_created_by uuid;
  v_plan_id uuid;
  v_lead_id uuid;
begin
  if v_uid is null then return false; end if;
  select email into v_user_email from auth.users where id = v_uid;

  select email, respostas, created_by, plan_id, lead_id
    into v_email, v_respostas, v_created_by, v_plan_id, v_lead_id
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

  if v_lead_id is not null then
    update public.leads set status = 'convertido', client_id = v_uid, updated_at = now()
    where id = v_lead_id;
  end if;

  update public.convites set status = 'concluido', client_id = v_uid where token = p_token;
  return true;
end;
$function$;
