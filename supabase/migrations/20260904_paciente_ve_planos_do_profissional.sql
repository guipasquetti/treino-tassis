-- Paciente recém-cadastrado precisa ver os `professional_plans` do próprio profissional pra
-- escolher qual quer contratar (onboarding em app, ver `20260904_anamnese_pos_login.sql`) —
-- mas a policy antiga só deixava ver um plano se `subscriptions.plan_id` já apontasse pra ele,
-- e é exatamente esse campo que ainda está nulo nesse momento (ovo-e-galinha). `is_client_of`
-- já existe e já é usado pra isso em outras tabelas — mesmo critério, sem RLS nova de verdade.
drop policy professional_plans_select on public.professional_plans;

create policy professional_plans_select on public.professional_plans
  for select
  using (
    professional_id = auth.uid()
    or is_client_of(professional_id)
    or exists (
      select 1 from public.subscriptions s
      where s.plan_id = professional_plans.id and s.patient_id = auth.uid()
    )
  );
