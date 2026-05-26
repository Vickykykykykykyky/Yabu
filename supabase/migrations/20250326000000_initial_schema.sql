-- Yabu：用户资料 + 照片 + 角色（member / admin）
-- 在 Supabase Dashboard → SQL Editor 中执行，或使用 supabase db push

create type public.app_role as enum ('member', 'admin');

create table public.profiles (
  id text primary key,
  display_name text not null,
  avatar_url text not null default '',
  role public.app_role not null default 'member',
  -- 若该栏位对应真实登录账号，填 auth.users.id（在 Dashboard 创建用户后复制 UUID）
  auth_user_id uuid unique references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null references public.profiles (id) on delete cascade,
  url text not null,
  created_at timestamptz not null default now()
);

create index photos_profile_id_idx on public.photos (profile_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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

-- 开发阶段：允许匿名读取（上线前请收紧）
create policy "profiles_select_anon"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "photos_select_anon"
  on public.photos for select
  to anon, authenticated
  using (true);

-- 已登录用户可改自己的资料（auth_user_id 匹配）
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- 管理员可改任意资料（role = admin 且已绑定 auth）
create policy "profiles_update_admin"
  on public.profiles for update
  to authenticated
  using (public.is_admin());

-- 照片：登录用户可为自己 profile 上传（profile 已绑定 auth）
create policy "photos_insert_own"
  on public.photos for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.auth_user_id = auth.uid()
    )
  );

-- 管理员可插入任意用户照片
create policy "photos_insert_admin"
  on public.photos for insert
  to authenticated
  with check (public.is_admin());

-- 暴露给 Data API（若 Dashboard 未自动开启）
grant usage on schema public to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant select on public.photos to anon, authenticated;
grant update on public.profiles to authenticated;
grant insert on public.photos to authenticated;
grant execute on function public.is_admin() to authenticated;
