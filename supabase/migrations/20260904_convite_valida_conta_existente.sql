-- Lead pode já ter conta no app (outro profissional, ou de antes) — decisão do Guilherme,
-- 04/set: em vez de buscar a base de usuários (superfície nova, exporia quem é paciente do
-- app pra qualquer profissional), o link já resolve isso sozinho: `obter_convite` passa a
-- dizer se o e-mail DAQUELE convite específico já tem conta. Não é busca aberta — só quem já
-- tem o token (e portanto já sabe o e-mail da pessoa) aprende isso, pra um e-mail só.
--
-- `finalizar_cadastro_convite` não precisa mudar: já só confere que a sessão autenticada bate
-- com o e-mail do convite, não importa se veio de signUp ou signIn — cria a assinatura nova
-- pra ESTE profissional de qualquer jeito (e se a pessoa já tem `anamnese` de outro
-- profissional, o gate de onboarding em `aluno/_layout.tsx` já pula direto pras abas).
drop function public.obter_convite(text);

create function public.obter_convite(p_token text)
returns table (nome text, email text, status text, conta_existe boolean)
language sql
stable security definer
set search_path to 'public'
as $function$
  select
    c.nome, c.email, c.status,
    exists (select 1 from auth.users u where lower(u.email) = lower(c.email)) as conta_existe
  from public.convites c
  where c.token = p_token;
$function$;
