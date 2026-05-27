-- 名字注册：允许新建 profile + 名字唯一
-- 在 Supabase SQL Editor 运行（若注册报 permission denied）

create unique index if not exists profiles_display_name_unique
  on public.profiles (display_name);

drop policy if exists "profiles_insert_anon" on public.profiles;
create policy "profiles_insert_anon"
  on public.profiles for insert
  to anon, authenticated
  with check (true);

grant insert on public.profiles to anon, authenticated;

-- 推荐再运行：supabase/register-profile.sql（注册 RPC，更稳定）
