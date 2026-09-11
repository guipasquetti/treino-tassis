-- Adiciona sexo biológico estruturado a profiles.
-- Motivo: insumo obrigatório das fórmulas de gasto energético (Mifflin-St Jeor,
-- Harris-Benedict, Cunningham) que o painel de dieta vai usar (ver HANDOFF.md §5).
-- Vive em profiles, não em anamnese: é dado de identidade transversal ao vínculo
-- paciente-profissional, mesma categoria de peso_kg/altura_cm que já moram aqui.
-- Nenhuma superfície LGPD nova: mesma sensibilidade de nome/telefone/data_nascimento
-- já coletados, cobertos pelas mesmas RLS existentes (profiles_update_own,
-- profiles_update_trainer), sem alteração de policy necessária.

alter table public.profiles
  add column sexo text;

alter table public.profiles
  add constraint profiles_sexo_check
  check (sexo is null or sexo in ('feminino', 'masculino', 'outro'));

-- Backfill best-effort a partir do texto livre já coletado na anamnese (onboarding
-- pré-04/set podia ter capturado isso como texto solto dentro de respostas_completas).
-- Não normalizável fica null — o profissional completa na revisão de anamnese.
update public.profiles p
set sexo = case
  when lower(trim(a.respostas_completas->>'sexo')) in ('m', 'masc', 'masculino', 'homem') then 'masculino'
  when lower(trim(a.respostas_completas->>'sexo')) in ('f', 'fem', 'feminino', 'mulher') then 'feminino'
  else null
end
from public.anamnese a
where a.client_id = p.id
  and p.sexo is null
  and a.respostas_completas ? 'sexo';
