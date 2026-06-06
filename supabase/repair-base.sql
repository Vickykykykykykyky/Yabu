-- 补救脚本：基础表已部分存在时用（可重复运行）
-- 1) 先跑 diagnose-schema.sql 看缺什么
-- 2) 若 profiles 不存在 → 跑 setup-all.sql（已支持 app_role 重复）
-- 3) 若 profiles 已存在 → 只跑本文件 + auth-passwords.sql

do $$ begin
  create type public.app_role as enum ('member', 'admin');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id text primary key,
  display_name text not null,
  avatar_url text not null default '',
  role public.app_role not null default 'member',
  auth_user_id uuid unique references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_display_name_unique
  on public.profiles (display_name);

alter table public.profiles
  add column if not exists contact_email text;

create unique index if not exists profiles_contact_email_unique
  on public.profiles (contact_email)
  where contact_email is not null;

-- 不写入固定演示名（线上用户已是真实昵称）。若表为空，请用注册或自行 insert。
select 'repair-base done' as status, count(*) as profile_count from public.profiles;
