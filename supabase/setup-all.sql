-- Yabu 一键建表 + 开发写入策略 + 种子数据
-- 在 https://supabase.com/dashboard/project/pmajmgryddjdgstpfcfn/sql/new 粘贴整文件并 Run

-- ========== migration: initial_schema ==========
create type public.app_role as enum ('member', 'admin');

create table if not exists public.profiles (
  id text primary key,
  display_name text not null,
  avatar_url text not null default '',
  role public.app_role not null default 'member',
  auth_user_id uuid unique references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null references public.profiles (id) on delete cascade,
  url text not null,
  created_at timestamptz not null default now()
);

create index if not exists photos_profile_id_idx on public.photos (profile_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where auth_user_id = auth.uid() and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.photos enable row level security;

drop policy if exists "profiles_select_anon" on public.profiles;
create policy "profiles_select_anon"
  on public.profiles for select
  to anon, authenticated
  using (true);

drop policy if exists "photos_select_anon" on public.photos;
create policy "photos_select_anon"
  on public.photos for select
  to anon, authenticated
  using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
  on public.profiles for update
  to authenticated
  using (public.is_admin());

drop policy if exists "photos_insert_own" on public.photos;
create policy "photos_insert_own"
  on public.photos for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.auth_user_id = auth.uid()
    )
  );

drop policy if exists "photos_insert_admin" on public.photos;
create policy "photos_insert_admin"
  on public.photos for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "profiles_update_anon_dev" on public.profiles;
create policy "profiles_update_anon_dev"
  on public.profiles for update
  to anon
  using (true)
  with check (true);

drop policy if exists "photos_insert_anon_dev" on public.photos;
create policy "photos_insert_anon_dev"
  on public.photos for insert
  to anon
  with check (true);

grant usage on schema public to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant select on public.photos to anon, authenticated;
grant update on public.profiles to anon, authenticated;
grant insert on public.photos to anon, authenticated;
grant update on public.profiles to authenticated;
grant insert on public.photos to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ========== seed ==========
insert into public.profiles (id, display_name, avatar_url, role)
values
  ('user-1', '小蓝', '', 'member'),
  ('user-2', '小橙', '', 'member'),
  ('user-3', '小绿', '', 'member')
on conflict (id) do update set
  display_name = excluded.display_name,
  role = excluded.role;
