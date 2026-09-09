-- Fundação de especialidades: um check-in pertence ao acompanhamento contratado
-- (patient ↔ professional ↔ service), não apenas ao paciente. A migração é expansiva:
-- mantém client_id/professional_id enquanto as telas antigas e novas coexistem.
--
-- Segurança/LGPD: o vínculo explícito elimina a leitura de check-ins de outro profissional
-- que também atende o mesmo paciente. Nenhum dado clínico é removido ou reescrito.

alter table public.check_ins
  add column if not exists subscription_id uuid references public.subscriptions(id);

-- Backfill determinístico. Em bases legadas que tenham mais de um vínculo para o mesmo par,
-- prioriza o vínculo ativo mais recente. Se um check-in não encontrar seu vínculo, a migração
-- falha explicitamente antes de tornar a coluna obrigatória — não há fallback inseguro.
update public.check_ins ci
set subscription_id = (
  select s.id
  from public.subscriptions s
  where s.patient_id = ci.client_id
    and s.professional_id = ci.professional_id
  order by (s.status = 'ativa') desc, s.started_at desc, s.created_at desc
  limit 1
)
where ci.subscription_id is null;

do $migration$
begin
  if exists (select 1 from public.check_ins where subscription_id is null) then
    raise exception 'Há check-ins sem assinatura correspondente; revise os vínculos antes de concluir a migração.';
  end if;
end;
$migration$;

alter table public.check_ins
  alter column subscription_id set not null;

create index if not exists check_ins_subscription_id_created_at_idx
  on public.check_ins (subscription_id, created_at desc);

-- FK simples não garante que a assinatura seja do mesmo paciente e profissional gravados na
-- linha. O trigger preserva essa invariável para escrita do app, SQL administrativo e futuras
-- integrações.
create or replace function public.validar_assinatura_do_checkin()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  v_patient_id uuid;
  v_professional_id uuid;
begin
  select patient_id, professional_id
    into v_patient_id, v_professional_id
  from public.subscriptions
  where id = new.subscription_id;

  if v_patient_id is null then
    raise exception 'A assinatura do check-in não existe.';
  end if;

  if new.client_id <> v_patient_id or new.professional_id <> v_professional_id then
    raise exception 'O check-in precisa pertencer ao mesmo paciente e profissional da assinatura.';
  end if;

  return new;
end;
$function$;

drop trigger if exists check_ins_validar_assinatura on public.check_ins;
create trigger check_ins_validar_assinatura
  before insert or update of client_id, professional_id, subscription_id
  on public.check_ins
  for each row execute function public.validar_assinatura_do_checkin();

-- O paciente só cria check-in no próprio acompanhamento ativo. A leitura profissional fica
-- limitada à assinatura que originou a linha, e não a qualquer vínculo ativo com o paciente.
drop policy if exists check_ins_insert_self on public.check_ins;
create policy check_ins_insert_self on public.check_ins
  for insert to authenticated
  with check (
    client_id = auth.uid()
    and exists (
      select 1
      from public.subscriptions s
      where s.id = subscription_id
        and s.patient_id = auth.uid()
        and s.professional_id = professional_id
        and s.status = 'ativa'
    )
  );

drop policy if exists check_ins_select on public.check_ins;
create policy check_ins_select on public.check_ins
  for select to authenticated
  using (
    client_id = auth.uid()
    or exists (
      select 1
      from public.subscriptions s
      where s.id = subscription_id
        and s.professional_id = auth.uid()
        and s.status = 'ativa'
    )
  );

-- Fotos antigas e novas são verificadas contra o caminho gravado no check-in. Isso evita que
-- um segundo profissional do mesmo paciente abra imagens de outro acompanhamento.
create or replace function public.pode_ler_foto_checkin(p_caminho text)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1
    from public.check_ins ci
    join public.subscriptions s on s.id = ci.subscription_id
    where p_caminho in (
      ci.foto_perfil_esquerdo_path,
      ci.foto_perfil_direito_path,
      ci.foto_costas_path
    )
      and s.professional_id = auth.uid()
      and s.status = 'ativa'
  );
$function$;

revoke all on function public.pode_ler_foto_checkin(text) from public;
grant execute on function public.pode_ler_foto_checkin(text) to authenticated;

drop policy if exists fotos_checkin_select on storage.objects;
create policy fotos_checkin_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'fotos-checkin'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.pode_ler_foto_checkin(name)
    )
  );

-- Rollback operacional: antes de remover subscription_id, restaurar as policies anteriores
-- de check_ins e storage, depois remover o trigger/funções/índice/coluna. A coluna antiga e
-- os dados originais são preservados justamente para esse retorno ser possível.
