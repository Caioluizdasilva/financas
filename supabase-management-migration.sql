-- Finanças · gestão de contas e permissões por módulo
-- Execute uma vez no Supabase SQL Editor antes de publicar a nova versão.

alter table public.profiles
  add column if not exists module_access jsonb not null default '{}'::jsonb;

comment on column public.profiles.module_access is
  'Módulos liberados por usuário comum. Chaves com false ficam ocultas e bloqueadas na navegação.';

create index if not exists profiles_role_idx on public.profiles(role);

-- A Edge Function admin-users usa service_role no servidor para criar/alterar
-- contas do Supabase Auth. A chave service_role NUNCA deve ir para o navegador.
