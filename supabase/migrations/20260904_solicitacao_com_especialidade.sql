-- Solicitação pendente (`20260904_solicitacao_acesso_existente.sql`) mostrava só o nome do
-- profissional — Guilherme testou de verdade e pediu a especialidade também (Nutri x
-- Treinador), pra saber que tipo de acompanhamento está sendo oferecido antes de aceitar.
drop function public.obter_solicitacoes_pendentes();

create function public.obter_solicitacoes_pendentes()
returns table (token text, profissional_nome text, especialidade text, created_at timestamptz)
language sql
stable security definer
set search_path to 'public'
as $function$
  select
    c.token,
    coalesce(nullif(p.nome, ''), 'Seu profissional') as profissional_nome,
    prof.especialidade,
    c.created_at
  from public.convites c
  join public.professionals prof on prof.id = c.created_by
  join public.profiles p on p.id = prof.id
  where c.status = 'pendente'
    and lower(c.email) = lower(coalesce((select email from auth.users where id = auth.uid()), ''))
  order by c.created_at desc;
$function$;
