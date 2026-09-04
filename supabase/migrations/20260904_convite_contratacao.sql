-- Etapa de "contratação" dentro do link de convite (decisão do Guilherme, 04/set): a call de
-- sensibilização já decide o plano (§12); o link que o lead recebe passa a mostrar esse plano
-- e um jeito de pagar ANTES da anamnese, não só a anamnese sozinha.
--
-- Lente de segurança/LGPD (§0): o app NUNCA coleta dado de cartão/pagamento — mesmo padrão já
-- usado pra teleconsulta (`teleconsultas.link_meet`, §8): o profissional gera o link de
-- cobrança fora do app (Asaas/Pix/o que for) e só a URL é armazenada. Zero superfície PCI nova.
alter table public.convites add column link_pagamento text;

-- `obter_convite` (RPC pública, chamada sem sessão pelo lead) passa a devolver também o plano
-- escolhido na call e o link de pagamento, pra tela pública renderizar a etapa de contratação
-- antes da anamnese. Continua STABLE/SECURITY DEFINER, mesmo formato de antes — mudou o
-- retorno (colunas novas), então precisa dropar antes de recriar (Postgres não deixa alterar
-- o formato de OUT parameters com CREATE OR REPLACE).
drop function public.obter_convite(text);

create function public.obter_convite(p_token text)
returns table (
  nome text,
  email text,
  status text,
  link_pagamento text,
  plano_nome text,
  plano_preco_centavos integer,
  plano_periodicidade text,
  plano_inclui_treino boolean,
  plano_inclui_dieta boolean
)
language sql
stable security definer
set search_path to 'public'
as $function$
  select
    c.nome, c.email, c.status, c.link_pagamento,
    p.nome, p.preco_centavos, p.periodicidade, p.inclui_treino, p.inclui_dieta
  from public.convites c
  left join public.professional_plans p on p.id = c.plan_id
  where c.token = p_token;
$function$;
