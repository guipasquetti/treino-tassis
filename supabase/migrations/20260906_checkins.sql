-- FA (Fase de Ataque) do roadmap: check-in recorrente automatizado — a maior lacuna do
-- benchmark (3-4 de 4 concorrentes pesquisados já têm). Série temporal respondida pelo
-- PACIENTE (não é nota do profissional, isso já existe em `atendimentos`) — nunca
-- sobrescrita, cada envio vira uma linha nova (mesma lógica de nunca apagar histórico do
-- §14). Fotos (as 3 mais sensíveis do questionário) ficam em bucket privado, acesso
-- restrito ao próprio paciente e ao profissional vinculado — nunca público, nunca
-- indexado por nome de arquivo previsível fora do prefixo de pasta.

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  respostas jsonb not null default '{}'::jsonb,
  pontuacao_geral numeric,
  pontuacao_categorias jsonb not null default '{}'::jsonb,
  foto_perfil_esquerdo_path text,
  foto_perfil_direito_path text,
  foto_costas_path text,
  created_at timestamptz not null default now()
);

create index check_ins_client_id_idx on public.check_ins (client_id, created_at desc);
create index check_ins_professional_id_idx on public.check_ins (professional_id, created_at desc);

alter table public.check_ins enable row level security;

-- Só o próprio paciente cria — é ele quem responde, nunca o profissional em nome dele.
create policy check_ins_insert_self on public.check_ins for insert to public
  with check (client_id = auth.uid());

-- Paciente lê o próprio histórico; profissional lê o de quem é cliente ativo dele.
create policy check_ins_select on public.check_ins for select to public
  using (client_id = auth.uid() or is_professional_of(client_id));

-- Sem update/delete: série temporal, nunca sobrescrita — mesma regra do §14 (plano,
-- termo de consentimento). Um check-in errado vira um novo check-in, não uma correção.

insert into storage.buckets (id, name, public)
values ('fotos-checkin', 'fotos-checkin', false);

-- Caminho sempre prefixado pelo client_id (`{client_id}/{checkin_id}/{tipo}.ext`) — só o
-- próprio paciente escreve na própria pasta; profissional vinculado só lê.
create policy fotos_checkin_insert on storage.objects
  for insert
  with check (
    bucket_id = 'fotos-checkin'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy fotos_checkin_select on storage.objects
  for select
  using (
    bucket_id = 'fotos-checkin'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or is_professional_of(((storage.foldername(name))[1])::uuid)
    )
  );

-- Paciente pode apagar a própria foto (reenviar).
create policy fotos_checkin_delete on storage.objects
  for delete
  using (
    bucket_id = 'fotos-checkin'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
