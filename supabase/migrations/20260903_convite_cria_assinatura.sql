-- Corrige o vínculo paciente↔profissional no fim do convite.
--
-- Problema: `finalizar_cadastro_convite` criava profile + anamnese e fechava o convite,
-- mas nunca inseria em `subscriptions`. Depois da migração multi-tenant
-- (20260902_multi_tenant_professionals_subscriptions.sql), a RLS passou a exigir
-- assinatura ativa (`is_professional_of`) pro profissional enxergar o paciente — ou seja,
-- o profissional NÃO veria o paciente que ele mesmo acabou de convidar.
--
-- Também adiciona `convites.plan_id`: o convite precisa saber qual produto foi vendido,
-- porque é isso que define os módulos liberados (dieta / treino) e, mais pra frente,
-- quais perguntas a anamnese faz.

alter table public.convites
  add column if not exists plan_id uuid references public.professional_plans(id);

comment on column public.convites.plan_id is
  'Produto vendido neste convite. Vira subscriptions.plan_id ao finalizar o cadastro.';

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

  -- NOVO: cria a assinatura que liga o paciente ao profissional que o convidou.
  -- Sem isso o paciente entra e fica invisível pro profissional (RLS por assinatura ativa).
  --
  -- Checagem por (patient_id, professional_id) em vez de ON CONFLICT porque o índice único
  -- inclui plan_id, e no Postgres NULLs são distintos entre si — com plano nulo, chamadas
  -- repetidas criariam assinaturas duplicadas.
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
