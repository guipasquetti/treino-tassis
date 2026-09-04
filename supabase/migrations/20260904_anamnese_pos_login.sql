-- Anamnese e escolha de plano migram pra DENTRO do app autenticado (decisão do Guilherme,
-- 04/set): lead baixa o app a partir do link do convite, cria conta, entra, e só então
-- responde a anamnese e escolhe o plano que quer comprar — tudo sem sair do app. O convite
-- público deixa de coletar qualquer coisa: vira só "criar conta".
--
-- Lente de segurança/LGPD (§0): paciente não tem (e não vai ganhar) permissão de RLS pra
-- escrever direto em `anamnese` ou `subscriptions` (conferido: só existe
-- `anamnese_insert_professional`/`anamnese_update_professional` e `subscriptions_write` com
-- `professional_id = auth.uid()` — paciente só tem SELECT). Se desse pra escrever direto,
-- o paciente poderia setar o próprio `plan_id` e se auto-liberar, destruindo o controle do
-- profissional que é o objetivo desta mudança. Por isso a escrita continua saindo por uma
-- RPC `SECURITY DEFINER` nova (`submeter_anamnese_autenticado`), igual ao padrão já usado em
-- `finalizar_cadastro_convite`/`submeter_anamnese` — e essa RPC só mexe no que pertence ao
-- próprio `auth.uid()` que a chamou, nunca em dado de outra pessoa.
--
-- `subscriptions.plano_solicitado_id` guarda o que o paciente PEDIU (soft, escolha própria);
-- `subscriptions.plan_id` continua sendo o que vale de verdade (hard) — só o profissional
-- muda isso (RLS já permite, `subscriptions_write` com `professional_id = auth.uid()`),
-- confirmando que revisou a anamnese e o pagamento. Enquanto `plan_id` for nulo, o app não
-- libera treino/dieta (checagem no client, não precisa mudar RLS pra isso).
alter table public.subscriptions
  add column plano_solicitado_id uuid references public.professional_plans(id);

-- Simplificado: não depende mais de anamnese ter sido preenchida (`status = 'preenchido'`)
-- nem lê `convites.respostas` — a conta é criada só com nome/e-mail do convite, a anamnese
-- vem depois, autenticado. Continua exigindo que o e-mail da sessão bata com o do convite.
create or replace function public.finalizar_cadastro_convite(p_token text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_email text;
  v_uid uuid := auth.uid();
  v_user_email text;
  v_created_by uuid;
  v_lead_id uuid;
begin
  if v_uid is null then return false; end if;
  select email into v_user_email from auth.users where id = v_uid;

  select email, created_by, lead_id
    into v_email, v_created_by, v_lead_id
  from public.convites
  where token = p_token and status = 'pendente';

  if v_email is null or lower(v_email) <> lower(coalesce(v_user_email,'')) then
    return false;
  end if;

  if v_created_by is not null
     and exists (select 1 from public.professionals where id = v_created_by)
     and not exists (
       select 1 from public.subscriptions
       where patient_id = v_uid and professional_id = v_created_by
     )
  then
    insert into public.subscriptions (patient_id, professional_id, plan_id, status)
    values (v_uid, v_created_by, null, 'ativa');
  end if;

  if v_lead_id is not null then
    update public.leads set status = 'convertido', client_id = v_uid, updated_at = now()
    where id = v_lead_id;
  end if;

  update public.convites set status = 'concluido', client_id = v_uid where token = p_token;
  return true;
end;
$function$;

-- Nova: paciente autenticado grava a própria anamnese + o plano que quer comprar (fica em
-- `plano_solicitado_id`, não em `plan_id` — quem confirma é o profissional). Mesma extração
-- de campos de `profiles` que `finalizar_cadastro_convite` fazia antes (nome/telefone/
-- nascimento/altura/peso vêm da respostas, não do signup).
create function public.submeter_anamnese_autenticado(p_respostas jsonb, p_plano_id uuid default null)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return false; end if;

  update public.profiles set
    nome = coalesce(nullif(p_respostas->>'nome_completo',''), nome),
    telefone = coalesce(nullif(p_respostas->>'telefone',''), telefone),
    data_nascimento = nullif(p_respostas->>'data_nascimento','')::date,
    altura_cm = nullif(p_respostas->>'altura_cm','')::numeric,
    peso_kg = nullif(p_respostas->>'peso_atual','')::numeric
  where id = v_uid;

  insert into public.anamnese (client_id, objetivo_principal, nivel_atividade, lesoes_dores, condicoes_medicas,
    medicamentos, cirurgias, historico_familiar, restricoes_alimentares, alergias, observacoes,
    respostas_completas, updated_at)
  values (v_uid,
    coalesce(p_respostas->>'objetivo_principal',''),
    coalesce(p_respostas->>'pratica_atividade',''),
    coalesce(p_respostas->>'limitacao_fisica',''),
    coalesce(p_respostas->>'patologias',''),
    coalesce(p_respostas->>'medicamentos',''),
    coalesce(p_respostas->>'cirurgias',''),
    coalesce(p_respostas->>'historico_familiar',''),
    coalesce(p_respostas->>'nao_consome',''),
    coalesce(p_respostas->>'intolerancias_alergias',''),
    coalesce(p_respostas->>'observacoes_finais',''),
    p_respostas, now()
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

  if p_plano_id is not null then
    update public.subscriptions
    set plano_solicitado_id = p_plano_id
    where patient_id = v_uid and plan_id is null;
  end if;

  return true;
end;
$function$;
