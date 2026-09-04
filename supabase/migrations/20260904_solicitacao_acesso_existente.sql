-- Lead que já tem conta (outro profissional, ou de antes) NÃO loga com senha real num link
-- (decisão do Guilherme, 04/set, quarta correção do funil): o profissional não ganha acesso
-- à conta de ninguém, nem pede senha. Ele libera o acesso pra um e-mail; se já existir conta,
-- a pessoa vê a solicitação DENTRO do app (já logada, do jeito normal) e aceita ou recusa —
-- sem senha, sem código, sem link de terceiros.
--
-- Lente de segurança/LGPD (§0): igual ao resto do fluxo, isso é escopado por RPC
-- `security definer`, nunca por RLS aberta em `convites` — a paciente só aprende sobre
-- convites endereçados ao PRÓPRIO e-mail autenticado (`auth.users` via `auth.uid()`), nunca
-- navega ou busca outros. `finalizar_cadastro_convite` (já existe) serve de "aceitar" sem
-- mudar nada; falta só "recusar" e "listar o que está esperando resposta".

-- 'recusado' é status novo — precisa entrar no CHECK que já existia (só aceitava
-- pendente/preenchido/concluido).
alter table public.convites drop constraint convites_status_check;
alter table public.convites add constraint convites_status_check
  check (status = any (array['pendente', 'preenchido', 'concluido', 'recusado']));

create function public.obter_solicitacoes_pendentes()
returns table (token text, profissional_nome text, created_at timestamptz)
language sql
stable security definer
set search_path to 'public'
as $function$
  select c.token, coalesce(nullif(p.nome, ''), 'Seu profissional') as profissional_nome, c.created_at
  from public.convites c
  join public.professionals prof on prof.id = c.created_by
  join public.profiles p on p.id = prof.id
  where c.status = 'pendente'
    and lower(c.email) = lower(coalesce((select email from auth.users where id = auth.uid()), ''))
  order by c.created_at desc;
$function$;

create function public.recusar_convite(p_token text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_email text;
  v_user_email text := (select email from auth.users where id = auth.uid());
begin
  if auth.uid() is null then return false; end if;

  select email into v_email from public.convites where token = p_token and status = 'pendente';
  if v_email is null or lower(v_email) <> lower(coalesce(v_user_email, '')) then
    return false;
  end if;

  update public.convites set status = 'recusado' where token = p_token;
  return true;
end;
$function$;
