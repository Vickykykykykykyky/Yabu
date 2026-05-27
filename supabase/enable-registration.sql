-- 一键开启「名字注册」— 在 SQL Editor 粘贴整文件并 Run
-- https://supabase.com/dashboard/project/pmajmgryddjdgstpfcfn/sql/new

-- 1) 名字唯一
create unique index if not exists profiles_display_name_unique
  on public.profiles (display_name);

-- 2) 允许注册写入 profiles
drop policy if exists "profiles_insert_anon" on public.profiles;
create policy "profiles_insert_anon"
  on public.profiles for insert
  to anon, authenticated
  with check (true);

grant insert on public.profiles to anon, authenticated;

-- 3) 注册 RPC（校验重名 + 生成 user id）
create or replace function public.register_profile(p_display_name text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_id text;
  v_row public.profiles%rowtype;
begin
  v_name := trim(regexp_replace(p_display_name, '\s+', ' ', 'g'));
  if char_length(v_name) < 2 then
    raise exception using message = '名字至少需要 2 个字符';
  end if;
  if char_length(v_name) > 24 then
    raise exception using message = '名字不能超过 24 个字符';
  end if;
  if exists (select 1 from public.profiles where display_name = v_name) then
    raise exception using message = '该名字已被注册，请切换到「登录」';
  end if;
  v_id := 'user-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  insert into public.profiles (id, display_name, avatar_url, role)
  values (v_id, v_name, '', 'member')
  returning * into v_row;
  return json_build_object(
    'id', v_row.id,
    'display_name', v_row.display_name,
    'avatar_url', v_row.avatar_url,
    'role', v_row.role
  );
end;
$$;

revoke all on function public.register_profile(text) from public;
grant execute on function public.register_profile(text) to anon, authenticated;

-- 4) 允许删除自己的作品（否则点删除只改界面，刷新会回来）
grant delete on public.photos to anon, authenticated;

drop policy if exists "photos_delete_anon_dev" on public.photos;
create policy "photos_delete_anon_dev"
  on public.photos for delete
  to anon, authenticated
  using (true);
