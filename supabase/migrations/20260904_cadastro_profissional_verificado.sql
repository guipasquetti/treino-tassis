-- Cadastro de profissional com verificação de CREF/CRN (decisão do Guilherme, 04/set):
-- "não podemos abrir isso pra qualquer um se cadastrar" — precisa de registro válido,
-- conferido por um humano (não existe API pública de CREF/CRN no Brasil, só consulta manual
-- no site do conselho).
--
-- Lente de segurança/LGPD (§0), achado ANTES de construir: a RLS atual de `professionals`
-- (`professionals_insert_self`, with_check `id = auth.uid()`) deixa QUALQUER usuário
-- autenticado se auto-inserir como profissional, sem gate nenhum — é exatamente o buraco que
-- essa mudança fecha. Cadastro de profissional passa a sair só pela RPC
-- `cadastrar_profissional` (SECURITY DEFINER); a tabela não aceita mais INSERT direto do
-- client.
drop policy professionals_insert_self on public.professionals;

-- Sem papel de admin formal (RBAC) — só uma flag simples. Hoje existe um aprovador (o
-- Guilherme); formalizar múltiplos papéis agora seria estrutura sem uso.
alter table public.profiles add column is_admin boolean not null default false;

create function public.is_admin()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$function$;

-- CPF e documento NUNCA vão em `professionals` — essa tabela já é lida pelos próprios
-- pacientes do profissional (`professionals_select`: id = auth.uid() OR is_client_of(id)),
-- então qualquer dado sensível ali vazaria pra paciente sem motivo nenhum. Tabela própria,
-- só o próprio profissional e o admin conseguem ler.
create table public.professional_verificacoes (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null unique references public.professionals(id),
  cpf text,
  numero_registro text not null,
  uf_registro text not null,
  documento_path text,
  bio text,
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'rejeitado')),
  motivo_rejeicao text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.professional_verificacoes enable row level security;

create policy professional_verificacoes_select on public.professional_verificacoes
  for select
  using (professional_id = auth.uid() or public.is_admin());

-- Sem policy de INSERT: só a RPC (security definer, bypassa RLS) cria a linha — o client não
-- grava status nenhum diretamente.

-- Profissional pode reenviar depois de rejeitado (edita e o status sempre volta pra
-- 'pendente' — nunca consegue se auto-aprovar, o with_check trava isso).
create policy professional_verificacoes_update_self on public.professional_verificacoes
  for update
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid() and status = 'pendente');

create policy professional_verificacoes_update_admin on public.professional_verificacoes
  for update
  using (public.is_admin())
  with check (public.is_admin());

-- Cria conta de profissional (perfil + professionals + verificação pendente) num passo só,
-- sempre que o próprio auth.uid() bate. `on conflict` permite reenvio via este mesmo RPC.
create function public.cadastrar_profissional(
  p_nome text,
  p_especialidade text,
  p_cpf text,
  p_numero_registro text,
  p_uf_registro text,
  p_documento_path text,
  p_bio text default null
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return false; end if;

  update public.profiles set nome = coalesce(nullif(p_nome, ''), nome) where id = v_uid;

  insert into public.professionals (id, especialidade)
  values (v_uid, p_especialidade)
  on conflict (id) do update set especialidade = excluded.especialidade;

  insert into public.professional_verificacoes
    (professional_id, cpf, numero_registro, uf_registro, documento_path, bio, status)
  values (v_uid, p_cpf, p_numero_registro, p_uf_registro, p_documento_path, p_bio, 'pendente')
  on conflict (professional_id) do update set
    cpf = excluded.cpf,
    numero_registro = excluded.numero_registro,
    uf_registro = excluded.uf_registro,
    documento_path = excluded.documento_path,
    bio = excluded.bio,
    status = 'pendente',
    motivo_rejeicao = null,
    reviewed_by = null,
    reviewed_at = null,
    updated_at = now();

  return true;
end;
$function$;

-- Admin precisa ler nome/e-mail/especialidade de QUALQUER solicitante pra revisar o pedido —
-- hoje `professionals_select`/`profiles_select` só liberam pro próprio dono ou pra quem já
-- tem vínculo de assinatura, e um candidato a profissional ainda não tem vínculo nenhum com
-- ninguém. Escopo: só nome/e-mail/especialidade (nunca CPF/anamnese/dado de saúde) — e só
-- pra quem já é admin (hoje, só o Guilherme).
create policy profiles_select_admin on public.profiles
  for select
  using (public.is_admin());

create policy professionals_select_admin on public.professionals
  for select
  using (public.is_admin());

-- Bucket privado (primeiro uso de Storage no projeto) — carteirinha do conselho é documento
-- de identidade profissional, não é público.
insert into storage.buckets (id, name, public)
values ('documentos-profissionais', 'documentos-profissionais', false);

-- Caminho do arquivo é sempre prefixado pelo próprio uid (`{uid}/carteirinha.ext`) — cada
-- profissional só mexe na própria pasta; admin lê qualquer uma pra revisar.
create policy documentos_profissionais_insert on storage.objects
  for insert
  with check (
    bucket_id = 'documentos-profissionais'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy documentos_profissionais_update on storage.objects
  for update
  using (
    bucket_id = 'documentos-profissionais'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy documentos_profissionais_select on storage.objects
  for select
  using (
    bucket_id = 'documentos-profissionais'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- Profissional pode apagar o próprio documento (reenviar, ou desistir do cadastro).
create policy documentos_profissionais_delete on storage.objects
  for delete
  using (
    bucket_id = 'documentos-profissionais'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
