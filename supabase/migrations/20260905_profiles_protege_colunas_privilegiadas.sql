-- Achado de segurança (§0 do HANDOFF): profiles_update_own/profiles_update_trainer
-- não restringem coluna nenhuma — qualquer usuário autenticado podia, via chamada
-- direta à API (fora do app), setar o próprio is_admin=true ou trocar role, virando
-- admin sozinho e furando toda a fila de verificação do §8. Trigger bloqueia mudança
-- de is_admin/role a menos que quem já é admin esteja fazendo a mudança.

create or replace function public.profiles_protege_colunas_privilegiadas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.is_admin is distinct from old.is_admin or new.role is distinct from old.role)
     and not public.is_admin() then
    raise exception 'não autorizado a alterar is_admin/role';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protege_colunas_privilegiadas on public.profiles;
create trigger profiles_protege_colunas_privilegiadas
  before update on public.profiles
  for each row
  execute function public.profiles_protege_colunas_privilegiadas();

-- Mesmo padrão do handle_new_user (§0): trigger function não precisa ser RPC pública.
revoke execute on function public.profiles_protege_colunas_privilegiadas() from anon, authenticated, public;
