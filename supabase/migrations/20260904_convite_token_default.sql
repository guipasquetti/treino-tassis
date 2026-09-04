-- Token do convite passa a ser gerado no banco (gen_random_uuid), não no client.
--
-- A tela do profissional que gera o link de convite (src/app/pro/aluno/convite.tsx) insere
-- só nome/email/created_by/plan_id — deixando token para o default abaixo. Motivo: token é
-- o único segredo do fluxo público de anamnese (obter_convite/submeter_anamnese não conferem
-- auth.uid()), e crypto.randomUUID() não é garantido em todo runtime React Native (Hermes
-- em iOS/Android sem polyfill) — gerar no Postgres é mais forte e não depende de client.

alter table public.convites
  alter column token set default gen_random_uuid()::text;
