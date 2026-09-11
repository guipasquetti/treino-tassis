-- Config de cálculo de meta calórica/macro por fórmula (Mifflin-St Jeor, Harris-Benedict,
-- Cunningham) dentro do plano alimentar atual — não é histórico novo, é config do mesmo
-- registro 1-por-aluno que já existe (planos_alimentares_client_id_key).
-- Insumo determinístico que a futura fase de IA vai consumir (HANDOFF.md §5/ROADMAP.md):
-- "toda sugestão baseada no que o profissional seta, nas fórmulas presentes".
-- Lente LGPD: config numérica só gravável pelo profissional, sob a RLS já existente
-- (dieta_insert_professional/dieta_update_professional, is_professional_of(client_id));
-- nenhuma superfície nova.

alter table public.planos_alimentares
  add column formula_calculo text,
  add column fator_atividade numeric,
  add column percentual_gordura numeric,
  add column tmb_calculada numeric,
  add column get_calculado numeric;

alter table public.planos_alimentares
  add constraint planos_alimentares_formula_calculo_check
  check (formula_calculo is null or formula_calculo in ('mifflin_st_jeor', 'harris_benedict', 'cunningham'));
