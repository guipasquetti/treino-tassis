-- Prontuário evolutivo por sessão (HANDOFF §30, gap #4 do benchmark de concorrentes:
-- WebDiet/Dietbox/LiveClin têm, Vytra não tinha). Decisão do Guilherme (12/set): estender
-- `atendimentos` em vez de criar tabela nova `sessoes_clinicas` — já tem client_id +
-- professional_id, só faltava ligar a uma teleconsulta específica quando existir uma.
--
-- `atendimentos` já cobre a fase de lead (pré-conversão, §12); esta coluna estende o mesmo
-- registro pra cobrir também a nota clínica pós-cadastro, pendurada numa `teleconsulta_id`
-- quando a consulta foi agendada no app, ou solta (null) quando é uma nota avulsa entre
-- consultas. Não retroativo — nenhuma linha antiga tinha teleconsulta pra ligar.
alter table public.atendimentos
  add column teleconsulta_id uuid references public.teleconsultas(id);

-- teleconsultas.patient_id só existe pra quem já é paciente (profiles.id) — uma nota ligada
-- a uma consulta não pode pendurar num lead ainda sem conta.
alter table public.atendimentos
  add constraint atendimentos_teleconsulta_requires_client
  check (teleconsulta_id is null or client_id is not null);

create index atendimentos_teleconsulta_id_idx on public.atendimentos(teleconsulta_id);

-- Sem mudança de RLS: `atendimentos_write` já restringe por professional_id = auth.uid(),
-- independente do alvo ser lead_id ou client_id — a nota é sempre privada do profissional,
-- mesma lógica de prontuário clínico (paciente não lê nota do profissional sobre si).
