-- Reverte 20260904_convite_contratacao.sql (decisão do Guilherme, mesmo dia): a etapa de
-- "contratação" dentro do link estava errada — não existe link de pagamento nesse fluxo.
-- O momento real é: call de sensibilização (fora do app) → lead + atendimento no sistema →
-- se o cliente topa continuar, o profissional gera UM link só de anamnese a partir do lead
-- (plano já vai junto em `convites.plan_id`, decidido na call — isso fica, não é o que
-- estava errado). Convite deixa de ter jeito de guardar link de pagamento.
alter table public.convites drop column link_pagamento;

drop function public.obter_convite(text);

create function public.obter_convite(p_token text)
returns table (nome text, email text, status text)
language sql
stable security definer
set search_path to 'public'
as $function$
  select nome, email, status from public.convites where token = p_token;
$function$;
