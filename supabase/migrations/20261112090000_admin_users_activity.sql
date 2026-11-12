-- Back-office : suivi d'activité des clients et accès admin aux tables de monitoring

-- 1. Dernière connexion / confirmation email tenues par Supabase Auth (auth.users),
--    illisibles depuis le navigateur : exposées aux seuls admins.
create or replace function public.admin_users_activity()
returns table (
  id uuid,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if coalesce(public.current_user_role(), '') not in ('admin', 'super_admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select a.id, a.last_sign_in_at, a.email_confirmed_at
    from auth.users a;
end;
$$;

revoke all on function public.admin_users_activity() from public, anon;
grant execute on function public.admin_users_activity() to authenticated;

-- Rattrapage : renseigne last_login_at pour les comptes déjà connectés
update public.users u
set last_login_at = a.last_sign_in_at
from auth.users a
where a.id = u.id
  and a.last_sign_in_at is not null
  and (u.last_login_at is null or u.last_login_at < a.last_sign_in_at);

-- 2. credit_transactions : RLS actif sans règle, personne ne pouvait lire.
drop policy if exists credit_transactions_read on public.credit_transactions;
create policy credit_transactions_read on public.credit_transactions
  for select
  using (
    organization_id = public.current_user_org()
    or public.current_user_role() in ('admin', 'super_admin')
  );

-- 3. api_errors : était lisible par tout le monde (RLS désactivé).
--    Les fonctions Edge écrivent avec la clé service_role, non concernée par le RLS.
alter table public.api_errors enable row level security;
drop policy if exists api_errors_admin_read on public.api_errors;
create policy api_errors_admin_read on public.api_errors
  for select
  using (public.current_user_role() in ('admin', 'super_admin'));

-- 4. admin_connections : journal des connexions au back-office.
alter table public.admin_connections enable row level security;
drop policy if exists admin_connections_insert on public.admin_connections;
create policy admin_connections_insert on public.admin_connections
  for insert
  with check (user_id = auth.uid() and public.current_user_role() in ('admin', 'super_admin'));
drop policy if exists admin_connections_read on public.admin_connections;
create policy admin_connections_read on public.admin_connections
  for select
  using (public.current_user_role() in ('admin', 'super_admin'));
