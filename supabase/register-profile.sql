-- 名字注册 RPC（演示模式：不依赖 Supabase Auth）
-- 在 Supabase SQL Editor 运行（可与 auth-register.sql 一起跑）

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

  if exists (
    select 1 from public.profiles where display_name = v_name
  ) then
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
