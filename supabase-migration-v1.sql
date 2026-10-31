-- Finanças · estrutura de perfis, conteúdo e administração
-- Execute no Supabase SQL Editor. Não contém senhas nem chaves privadas.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  role text not null default 'common' check (role in ('common','master')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);
alter table public.profiles enable row level security;

create or replace function public.sync_financas_profile()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  insert into public.profiles(user_id,email,display_name)
  values(new.id,coalesce(new.email,''),coalesce(new.raw_user_meta_data->>'display_name',''))
  on conflict(user_id) do update set email=excluded.email;
  return new;
end; $$;

drop trigger if exists financas_auth_profile on auth.users;
create trigger financas_auth_profile after insert or update of email on auth.users
for each row execute procedure public.sync_financas_profile();

insert into public.profiles(user_id,email,display_name)
select id,coalesce(email,''),coalesce(raw_user_meta_data->>'display_name','')
from auth.users on conflict(user_id) do nothing;

create or replace function public.is_financas_master()
returns boolean language sql stable security definer set search_path=public
as $$
  select exists(select 1 from public.profiles where user_id=auth.uid() and role='master');
$$;

drop policy if exists "profile read self or master" on public.profiles;
create policy "profile read self or master" on public.profiles for select to authenticated
using (user_id=auth.uid() or public.is_financas_master());
drop policy if exists "profile update own display name" on public.profiles;
create policy "profile update own display name" on public.profiles for update to authenticated
using (user_id=auth.uid()) with check (user_id=auth.uid());
revoke update on public.profiles from authenticated;
grant update(display_name) on public.profiles to authenticated;

create table if not exists public.education_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  excerpt text not null default '',
  category text not null default 'Organização financeira',
  body_html text not null default '',
  cover_url text not null default '',
  external_url text not null default '',
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);
alter table public.education_posts enable row level security;

drop policy if exists "published posts readable" on public.education_posts;
create policy "published posts readable" on public.education_posts for select to authenticated
using (status='published' or public.is_financas_master());
drop policy if exists "master create posts" on public.education_posts;
create policy "master create posts" on public.education_posts for insert to authenticated
with check (public.is_financas_master() and author_id=auth.uid());
drop policy if exists "master update posts" on public.education_posts;
create policy "master update posts" on public.education_posts for update to authenticated
using (public.is_financas_master()) with check (public.is_financas_master());
drop policy if exists "master delete posts" on public.education_posts;
create policy "master delete posts" on public.education_posts for delete to authenticated
using (public.is_financas_master());

-- PROMOÇÃO DO PRIMEIRO ADMINISTRADOR:
-- Após criar a conta master no Auth, execute uma instrução separada:
-- update public.profiles set role='master' where email='SEU_EMAIL_ASCII_CONFIRMADO';
-- Use o endereço exato confirmado pelo provedor; nunca coloque senha neste arquivo.

create or replace function public.set_financas_user_role(target_user uuid,new_role text)
returns void language plpgsql security definer set search_path=public
as $$
begin
  if not public.is_financas_master() then raise exception 'Acesso restrito ao administrador master'; end if;
  if new_role not in ('common','master') then raise exception 'Perfil inválido'; end if;
  update public.profiles set role=new_role where user_id=target_user;
end; $$;
revoke all on function public.set_financas_user_role(uuid,text) from public;
grant execute on function public.set_financas_user_role(uuid,text) to authenticated;

create or replace function public.touch_financas_last_seen()
returns void language sql security definer set search_path=public
as $$
  update public.profiles set last_seen_at=now() where user_id=auth.uid();
$$;
revoke all on function public.touch_financas_last_seen() from public;
grant execute on function public.touch_financas_last_seen() to authenticated;

-- Permissões SQL para as políticas RLS acima.
grant select, insert, update, delete on public.education_posts to authenticated;
grant select on public.profiles to authenticated;
grant update(display_name) on public.profiles to authenticated;
