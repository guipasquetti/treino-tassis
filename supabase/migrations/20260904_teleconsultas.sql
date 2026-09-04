-- Agenda de teleconsultas — versão simples (§0/HANDOFF): link do Meet colado manualmente
-- pelo profissional (gerado em meet.google.com/new), sem integração OAuth com Google
-- Calendar. Vídeo em si nunca passa pelo Supabase — só a URL da chamada é armazenada.

create table public.teleconsultas (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id),
  patient_id uuid not null references public.profiles(id),
  data_hora timestamptz not null,
  link_meet text not null,
  status text not null default 'agendada' check (status in ('agendada', 'realizada', 'cancelada')),
  observacoes text not null default '',
  created_at timestamptz not null default now()
);

create index teleconsultas_professional_idx on public.teleconsultas (professional_id, data_hora);
create index teleconsultas_patient_idx on public.teleconsultas (patient_id, data_hora);

alter table public.teleconsultas enable row level security;

-- Leitura: o profissional dono ou o próprio paciente.
create policy teleconsultas_select on public.teleconsultas
  for select using (professional_id = auth.uid() or patient_id = auth.uid());

-- Escrita: só o profissional, e só sobre paciente que é dele de verdade (RLS multi-tenant).
create policy teleconsultas_insert on public.teleconsultas
  for insert with check (professional_id = auth.uid() and is_professional_of(patient_id));

create policy teleconsultas_update on public.teleconsultas
  for update using (professional_id = auth.uid());

-- Sem policy de delete: cancelamento é status = 'cancelada', não remoção — mantém histórico
-- (mesma lógica de nunca sobrescrever usada em versionamento de plano/termo, ver §14).
